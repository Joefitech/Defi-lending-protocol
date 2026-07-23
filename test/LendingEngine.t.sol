// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/LendingEngine.sol";
import "../src/mocks/MockERC20.sol";
import "../src/mocks/MockOracle.sol";

contract LendingEngineTest is Test {
    LendingEngine public engine;
    MockOracle public oracle;
    MockERC20 public weth;
    MockERC20 public usdc;

    address public user = address(0x1);
    address public lender = address(0x2);
    address public liquidator = address(0x3);

    // Asset Prices (Scaled to 1e8 for Chainlink format)
    uint256 public constant WETH_PRICE = 3000 * 1e8; // $3,000 per WETH
    uint256 public constant USDC_PRICE = 1 * 1e8;    // $1 per USDC

    function setUp() public {
        // 1. Deploy Mocks
        oracle = new MockOracle();
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);

        // 2. Deploy Engine
        engine = new LendingEngine(address(oracle));

        // 3. Set Oracle Prices
        oracle.setPrice(address(weth), WETH_PRICE);
        oracle.setPrice(address(usdc), USDC_PRICE);

        // 4. Configure Protocol Risk Parameters
        // WETH: Collateral asset (75% LTV, 80% Liquidation Threshold, 5% Bonus)
        engine.configureAsset(address(weth), true, false, 7500, 8000, 10500);
        // USDC: Borrowable liquidity asset
        engine.configureAsset(address(usdc), false, true, 0, 1, 0);

        // 5. Mint initial balances to actors
        weth.mint(user, 10 ether);           // User gets 10 WETH
        usdc.mint(lender, 50000 * 1e6);       // Lender gets 50,000 USDC
        usdc.mint(liquidator, 50000 * 1e6);   // Liquidator gets 50,000 USDC
    }

    function testDepositCollateral() public {
        vm.startPrank(user);
        weth.approve(address(engine), 1 ether);
        engine.depositCollateral(address(weth), 1 ether);
        vm.stopPrank();

        uint256 userDeposit = engine.s_collateralDeposits(user, address(weth));
        assertEq(userDeposit, 1 ether);
    }

    function testSupplyLiquidityAndBorrow() public {
        // 1. Lender supplies 10,000 USDC liquidity
        vm.startPrank(lender);
        usdc.approve(address(engine), 10000 * 1e6);
        engine.supplyLiquidity(address(usdc), 10000 * 1e6);
        vm.stopPrank();

        // 2. User deposits 1 WETH ($3,000 USD value)
        vm.startPrank(user);
        weth.approve(address(engine), 1 ether);
        engine.depositCollateral(address(weth), 1 ether);

        // 3. User borrows 1,500 USDC (50% LTV, well under the 75% max LTV)
        engine.borrow(address(usdc), 1500 * 1e6);
        vm.stopPrank();

        uint256 userDebt = engine.s_borrowedBalances(user, address(usdc));
        assertEq(userDebt, 1500 * 1e6);
        assertEq(usdc.balanceOf(user), 1500 * 1e6);
    }

    function testRevertWhenBorrowExceedsHealthFactor() public {
        // Lender supplies liquidity
        vm.startPrank(lender);
        usdc.approve(address(engine), 50000 * 1e6);
        engine.supplyLiquidity(address(usdc), 50000 * 1e6);
        vm.stopPrank();

        // User deposits 1 WETH ($3,000 USD value, Max Borrow = $3000 * 80% threshold = $2,400)
        vm.startPrank(user);
        weth.approve(address(engine), 1 ether);
        engine.depositCollateral(address(weth), 1 ether);

        // Attempting to borrow 2,500 USDC should trigger a revert due to low Health Factor
        vm.expectRevert("LendingEngine: Health factor too low!");
        engine.borrow(address(usdc), 2500 * 1e6);
        vm.stopPrank();
    }

    function testLiquidationWhenPriceDrops() public {
        // 1. Lender supplies liquidity
        vm.startPrank(lender);
        usdc.approve(address(engine), 10000 * 1e6);
        engine.supplyLiquidity(address(usdc), 10000 * 1e6);
        vm.stopPrank();

        // 2. User deposits 1 WETH ($3,000) and borrows 2,000 USDC
        vm.startPrank(user);
        weth.approve(address(engine), 1 ether);
        engine.depositCollateral(address(weth), 1 ether);
        engine.borrow(address(usdc), 2000 * 1e6);
        vm.stopPrank();

        // 3. Market Crash! WETH price drops from $3,000 to $2,000
        // Max borrow allowed drops to $2,000 * 80% = $1,600.
        // User's $2,000 debt makes Health Factor = 1600 / 2000 = 0.8 (< 1.0)
        oracle.setPrice(address(weth), 2000 * 1e8);

        // 4. Liquidator steps in to liquidate 1,000 USDC of debt
        vm.startPrank(liquidator);
        usdc.approve(address(engine), 1000 * 1e6);
        engine.liquidate(user, address(weth), address(usdc), 1000 * 1e6);
        vm.stopPrank();

        // 5. Verify Liquidator earned collateral + 5% bonus
        // $1,000 debt / $2,000 WETH price = 0.5 WETH + 5% bonus = 0.525 WETH
        assertEq(weth.balanceOf(liquidator), 0.525 ether);
    }
}