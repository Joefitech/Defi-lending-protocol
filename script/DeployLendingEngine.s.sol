// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/LendingEngine.sol";
import "../src/mocks/MockERC20.sol";
import "../src/mocks/MockOracle.sol";

contract DeployLendingEngine is Script {
    function run() external returns (LendingEngine engine, MockOracle oracle, MockERC20 weth, MockERC20 usdc) {
        vm.startBroadcast();

        // 1. Deploy Price Feed Oracle
        oracle = new MockOracle();

        // 2. Deploy Mock Assets
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        usdc = new MockERC20("USD Coin", "USDC", 6);

        // 3. Deploy Core Protocol Engine
        engine = new LendingEngine(address(oracle));

        // 4. Set Initial Market Prices ($3,000 WETH, $1 USDC)
        oracle.setPrice(address(weth), 3000 * 1e8);
        oracle.setPrice(address(usdc), 1 * 1e8);

        // 5. Configure Asset Risk Profiles
        // WETH: Collateral allowed (75% LTV, 80% Liq Threshold, 5% Liq Bonus)
        engine.configureAsset(address(weth), true, false, 7500, 8000, 10500);
        // USDC: Borrowing liquidity allowed
        engine.configureAsset(address(usdc), false, true, 0, 1, 0);

        vm.stopBroadcast();
    }
}