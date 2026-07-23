// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./mocks/MockOracle.sol";

/**
 * @title LendingEngine
 * @notice Core contract managing multi-asset collateral, liquidity pools, borrowing, and liquidations.
 */
contract LendingEngine is ReentrancyGuard {
    // ------------------------------------------------------------------------
    // Structs & State Variables
    // ------------------------------------------------------------------------

    struct AssetConfig {
        bool isAllowedCollateral;
        bool isAllowedBorrow;
        uint256 ltv;                  // e.g. 7500 = 75%
        uint256 liquidationThreshold; // e.g. 8000 = 80%
        uint256 liquidationBonus;     // e.g. 10500 = 105% (5% bonus)
    }

    uint256 public constant PERCENTAGE_FACTOR = 10000; // 100% = 10000
    uint256 public constant MIN_HEALTH_FACTOR = 1e18;  // 1.0 in 18-decimal precision

    MockOracle public immutable i_oracle;

    // Track allowed assets
    address[] public s_allowedAssets;
    mapping(address => AssetConfig) public s_assetConfigs;

    // User Balances
    // user => token => collateral amount
    mapping(address => mapping(address => uint256)) public s_collateralDeposits;
    // user => token => liquidity supplied amount
    mapping(address => mapping(address => uint256)) public s_liquidityDeposits;
    // user => token => borrowed amount
    mapping(address => mapping(address => uint256)) public s_borrowedBalances;

    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------

    event AssetConfigured(address indexed asset, bool isCollateral, bool isBorrow);
    event CollateralDeposited(address indexed user, address indexed asset, uint256 amount);
    event CollateralWithdrawn(address indexed user, address indexed asset, uint256 amount);
    event LiquiditySupplied(address indexed user, address indexed asset, uint256 amount);
    event LiquidityWithdrawn(address indexed user, address indexed asset, uint256 amount);
    event Borrowed(address indexed user, address indexed asset, uint256 amount);
    event Repaid(address indexed user, address indexed asset, uint256 amount);
    event Liquidated(
        address indexed borrower,
        address indexed liquidator,
        address collateralAsset,
        address debtAsset,
        uint256 debtToCover,
        uint256 collateralSeized
    );

    // ------------------------------------------------------------------------
    // Modifiers & Constructor
    // ------------------------------------------------------------------------

    constructor(address oracleAddress) {
        require(oracleAddress != address(0), "LendingEngine: Zero address oracle");
        i_oracle = MockOracle(oracleAddress);
    }

    // ------------------------------------------------------------------------
    // Admin / Configuration
    // ------------------------------------------------------------------------

    function configureAsset(
        address asset,
        bool isCollateral,
        bool isBorrow,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationBonus
    ) external {
        require(asset != address(0), "LendingEngine: Zero address asset");
        require(ltv < liquidationThreshold, "LendingEngine: LTV must be < threshold");

        s_assetConfigs[asset] = AssetConfig({
            isAllowedCollateral: isCollateral,
            isAllowedBorrow: isBorrow,
            ltv: ltv,
            liquidationThreshold: liquidationThreshold,
            liquidationBonus: liquidationBonus
        });

        s_allowedAssets.push(asset);
        emit AssetConfigured(asset, isCollateral, isBorrow);
    }

    // ------------------------------------------------------------------------
    // Core User Actions: Collateral & Liquidity
    // ------------------------------------------------------------------------

    function depositCollateral(address asset, uint256 amount) external nonReentrant {
        require(s_assetConfigs[asset].isAllowedCollateral, "LendingEngine: Not allowed collateral");
        require(amount > 0, "LendingEngine: Amount must be > 0");

        s_collateralDeposits[msg.sender][asset] += amount;
        emit CollateralDeposited(msg.sender, asset, amount);

        bool success = IERC20(asset).transferFrom(msg.sender, address(this), amount);
        require(success, "LendingEngine: Transfer failed");
    }

    function supplyLiquidity(address asset, uint256 amount) external nonReentrant {
        require(s_assetConfigs[asset].isAllowedBorrow, "LendingEngine: Asset not borrowable");
        require(amount > 0, "LendingEngine: Amount must be > 0");

        s_liquidityDeposits[msg.sender][asset] += amount;
        emit LiquiditySupplied(msg.sender, asset, amount);

        bool success = IERC20(asset).transferFrom(msg.sender, address(this), amount);
        require(success, "LendingEngine: Transfer failed");
    }

    // ------------------------------------------------------------------------
    // Core User Actions: Borrowing & Repayments
    // ------------------------------------------------------------------------

    function borrow(address asset, uint256 amount) external nonReentrant {
        require(s_assetConfigs[asset].isAllowedBorrow, "LendingEngine: Asset not borrowable");
        require(amount > 0, "LendingEngine: Amount must be > 0");
        require(
            IERC20(asset).balanceOf(address(this)) >= amount,
            "LendingEngine: Insufficient pool liquidity"
        );

        s_borrowedBalances[msg.sender][asset] += amount;

        // Health Factor check after borrow calculation
        require(_getHealthFactor(msg.sender) >= MIN_HEALTH_FACTOR, "LendingEngine: Health factor too low!");

        emit Borrowed(msg.sender, asset, amount);

        bool success = IERC20(asset).transfer(msg.sender, amount);
        require(success, "LendingEngine: Borrow transfer failed");
    }

    function repay(address asset, uint256 amount) external nonReentrant {
        require(amount > 0, "LendingEngine: Amount must be > 0");
        require(s_borrowedBalances[msg.sender][asset] >= amount, "LendingEngine: Repaying more than debt");

        s_borrowedBalances[msg.sender][asset] -= amount;
        emit Repaid(msg.sender, asset, amount);

        bool success = IERC20(asset).transferFrom(msg.sender, address(this), amount);
        require(success, "LendingEngine: Repay transfer failed");
    }

    // ------------------------------------------------------------------------
    // Calculations & Health Factor Engine
    // ------------------------------------------------------------------------

    function getHealthFactor(address user) external view returns (uint256) {
        return _getHealthFactor(user);
    }

    function _getHealthFactor(address user) internal view returns (uint256) {
        (uint256 totalCollateralValueUsd, uint256 totalBorrowedValueUsd) = getUserAccountData(user);

        if (totalBorrowedValueUsd == 0) return type(uint256).max; // Infinite health factor if no borrow

        return (totalCollateralValueUsd * 1e18) / totalBorrowedValueUsd;
    }

    function getUserAccountData(address user)
        public
        view
        returns (uint256 totalCollateralAdjustedUsd, uint256 totalBorrowedValueUsd)
    {
        for (uint256 i = 0; i < s_allowedAssets.length; i++) {
            address asset = s_allowedAssets[i];

            // 1. Collateral Value
            uint256 collateralAmount = s_collateralDeposits[user][asset];
            if (collateralAmount > 0) {
                uint256 assetValueUsd = getUsdValue(asset, collateralAmount);
                uint256 threshold = s_assetConfigs[asset].liquidationThreshold;
                totalCollateralAdjustedUsd += (assetValueUsd * threshold) / PERCENTAGE_FACTOR;
            }

            // 2. Borrow Value
            uint256 borrowAmount = s_borrowedBalances[user][asset];
            if (borrowAmount > 0) {
                totalBorrowedValueUsd += getUsdValue(asset, borrowAmount);
            }
        }
    }

    function getUsdValue(address asset, uint256 amount) public view returns (uint256) {
        uint256 price = i_oracle.getPrice(asset);
        uint8 decimals = IERC20Metadata(asset).decimals();

        // Standardize output to 18 decimals
        return (amount * price * 10 ** 10) / (10 ** decimals);
    }
}