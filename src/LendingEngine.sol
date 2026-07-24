// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IMockOracle {
    function getPrice(address asset) external view returns (uint256);
}

contract LendingEngine is ReentrancyGuard {
    error LendingEngine__NeedsMoreThanZero();
    error LendingEngine__TokenNotSupported();
    error LendingEngine__NotAllowedAsCollateral();
    error LendingEngine__BreaksHealthFactor(uint256 healthFactor);
    error LendingEngine__HealthFactorOk();
    error LendingEngine__TransferFailed();

    struct AssetConfig {
        bool isSupported;
        bool isCollateral;
        bool isBorrowable;
        uint256 ltv;                  // Basis points (e.g., 8000 = 80%)
        uint256 liquidationThreshold; // Basis points (e.g., 8500 = 85%)
        uint256 liquidationBonus;     // Basis points (e.g., 500 = 5%)
        uint256 baseRate;             // Base APY (e.g., 200 = 2%)
        uint256 slope1;               // APY slope before kink (e.g., 400 = 4%)
        uint256 slope2;               // APY slope after kink (e.g., 6000 = 60%)
        uint256 optimalUtilization;   // Kink utilization (e.g., 8000 = 80%)
    }

    // Mappings
    mapping(address => AssetConfig) public s_assetConfigs;
    address[] public s_allowedAssets;

    mapping(address => mapping(address => uint256)) public s_collateralDeposits; // user => asset => amount
    mapping(address => mapping(address => uint256)) public s_liquiditySupplied;  // user => asset => amount
    mapping(address => mapping(address => uint256)) public s_borrowedBalances;   // user => asset => amount
    mapping(address => uint256) public s_totalBorrowed;                          // asset => amount
    mapping(address => uint256) public s_totalSupplied;                          // asset => amount

    IMockOracle public immutable i_oracle;
    uint256 private constant PRECISION = 1e18;
    uint256 private constant BPS_PRECISION = 10000;
    uint256 private constant MIN_HEALTH_FACTOR = 1e18;

    event CollateralDeposited(address indexed user, address indexed asset, uint256 amount);
    event LiquiditySupplied(address indexed user, address indexed asset, uint256 amount);
    event Borrowed(address indexed user, address indexed asset, uint256 amount);
    event Repaid(address indexed user, address indexed asset, uint256 amount);
    event Liquidated(address indexed borrower, address indexed collateral, address indexed debt, uint256 debtToCover);

    modifier moreThanZero(uint256 amount) {
        if (amount == 0) revert LendingEngine__NeedsMoreThanZero();
        _;
    }

    modifier isSupported(address asset) {
        if (!s_assetConfigs[asset].isSupported) revert LendingEngine__TokenNotSupported();
        _;
    }

    constructor(address oracleAddress) {
        i_oracle = IMockOracle(oracleAddress);
    }

    function configureAsset(
        address asset,
        bool isCollateral,
        bool isBorrowable,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationBonus,
        uint256 baseRate,
        uint256 slope1,
        uint256 slope2,
        uint256 optimalUtilization
    ) external {
        if (!s_assetConfigs[asset].isSupported) {
            s_allowedAssets.push(asset);
        }
        s_assetConfigs[asset] = AssetConfig({
            isSupported: true,
            isCollateral: isCollateral,
            isBorrowable: isBorrowable,
            ltv: ltv,
            liquidationThreshold: liquidationThreshold,
            liquidationBonus: liquidationBonus,
            baseRate: baseRate,
            slope1: slope1,
            slope2: slope2,
            optimalUtilization: optimalUtilization
        });
    }

    // --- Core Protocol Actions ---

    function depositCollateral(address asset, uint256 amount) external moreThanZero(amount) isSupported(asset) nonReentrant {
        if (!s_assetConfigs[asset].isCollateral) revert LendingEngine__NotAllowedAsCollateral();
        s_collateralDeposits[msg.sender][asset] += amount;
        emit CollateralDeposited(msg.sender, asset, amount);
        
        bool success = IERC20(asset).transferFrom(msg.sender, address(this), amount);
        if (!success) revert LendingEngine__TransferFailed();
    }

    function supplyLiquidity(address asset, uint256 amount) external moreThanZero(amount) isSupported(asset) nonReentrant {
        s_liquiditySupplied[msg.sender][asset] += amount;
        s_totalSupplied[asset] += amount;
        emit LiquiditySupplied(msg.sender, asset, amount);

        bool success = IERC20(asset).transferFrom(msg.sender, address(this), amount);
        if (!success) revert LendingEngine__TransferFailed();
    }

    function borrow(address asset, uint256 amount) external moreThanZero(amount) isSupported(asset) nonReentrant {
        require(s_assetConfigs[asset].isBorrowable, "Asset not borrowable");
        
        s_borrowedBalances[msg.sender][asset] += amount;
        s_totalBorrowed[asset] += amount;

        _revertIfHealthFactorIsBroken(msg.sender);
        emit Borrowed(msg.sender, asset, amount);

        bool success = IERC20(asset).transfer(msg.sender, amount);
        if (!success) revert LendingEngine__TransferFailed();
    }

    function repay(address asset, uint256 amount) external moreThanZero(amount) isSupported(asset) nonReentrant {
        uint256 currentDebt = s_borrowedBalances[msg.sender][asset];
        uint256 repayAmount = amount > currentDebt ? currentDebt : amount;

        s_borrowedBalances[msg.sender][asset] -= repayAmount;
        s_totalBorrowed[asset] -= repayAmount;

        emit Repaid(msg.sender, asset, repayAmount);

        bool success = IERC20(asset).transferFrom(msg.sender, address(this), repayAmount);
        if (!success) revert LendingEngine__TransferFailed();
    }

    // --- Dynamic Interest Rate Math ---

    function getUtilizationRate(address asset) public view returns (uint256) {
        uint256 totalCash = s_totalSupplied[asset];
        uint256 totalBorrows = s_totalBorrowed[asset];
        if (totalCash + totalBorrows == 0) return 0;
        return (totalBorrows * BPS_PRECISION) / (totalCash + totalBorrows);
    }

    function getBorrowRates(address asset) public view returns (uint256 borrowRateBps, uint256 supplyRateBps) {
        AssetConfig memory config = s_assetConfigs[asset];
        uint256 utilization = getUtilizationRate(asset);

        if (utilization <= config.optimalUtilization) {
            borrowRateBps = config.baseRate + ((utilization * config.slope1) / config.optimalUtilization);
        } else {
            uint256 excessUtilization = utilization - config.optimalUtilization;
            uint256 maxExcess = BPS_PRECISION - config.optimalUtilization;
            borrowRateBps = config.baseRate + config.slope1 + ((excessUtilization * config.slope2) / maxExcess);
        }

        supplyRateBps = (borrowRateBps * utilization) / BPS_PRECISION;
    }

    // --- Health Factor & Valuation Math ---

    function getAccountInformation(address user) public view returns (uint256 totalCollateralValueUsd, uint256 totalBorrowValueUsd, uint256 maxBorrowCapacityUsd) {
        for (uint256 i = 0; i < s_allowedAssets.length; i++) {
            address asset = s_allowedAssets[i];
            AssetConfig memory config = s_assetConfigs[asset];
            uint256 price = i_oracle.getPrice(asset); // 8 decimals USD
            uint8 decimals = IERC20Metadata(asset).decimals();

            // 1. Calculate Collateral
            uint256 deposited = s_collateralDeposits[user][asset];
            if (deposited > 0) {
                uint256 valueUsd = (deposited * price * PRECISION) / (10**decimals * 1e8);
                totalCollateralValueUsd += valueUsd;
                maxBorrowCapacityUsd += (valueUsd * config.liquidationThreshold) / BPS_PRECISION;
            }

            // 2. Calculate Debt
            uint256 borrowed = s_borrowedBalances[user][asset];
            if (borrowed > 0) {
                uint256 debtValueUsd = (borrowed * price * PRECISION) / (10**decimals * 1e8);
                totalBorrowValueUsd += debtValueUsd;
            }
        }
    }

    function getHealthFactor(address user) public view returns (uint256) {
        (uint256 totalCollateralValueUsd, uint256 totalBorrowValueUsd, uint256 maxBorrowCapacityUsd) = getAccountInformation(user);
        if (totalBorrowValueUsd == 0) return type(uint256).max;
        return (maxBorrowCapacityUsd * PRECISION) / totalBorrowValueUsd;
    }

    function _revertIfHealthFactorIsBroken(address user) internal view {
        uint256 userHealthFactor = getHealthFactor(user);
        if (userHealthFactor < MIN_HEALTH_FACTOR) {
            revert LendingEngine__BreaksHealthFactor(userHealthFactor);
        }
    }

    function getAllowedAssets() external view returns (address[] memory) {
        return s_allowedAssets;
    }
}