// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/LendingEngine.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    uint8 private _customDecimals;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _customDecimals = decimals_;
        _mint(msg.sender, 10_000_000 * (10**decimals_));
    }

    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockOracle {
    mapping(address => uint256) public prices;

    function setPrice(address asset, uint256 price) external {
        prices[asset] = price;
    }

    function getPrice(address asset) external view returns (uint256) {
        return prices[asset];
    }
}

contract DeployMultiAsset is Script {
    function run() external returns (LendingEngine engine, MockOracle oracle) {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        oracle = new MockOracle();
        engine = new LendingEngine(address(oracle));

        // 1. Deploy 8 Test Assets
        MockToken weth = new MockToken("Wrapped Ether", "WETH", 18);
        MockToken wbtc = new MockToken("Wrapped Bitcoin", "WBTC", 8);
        MockToken link = new MockToken("Chainlink", "LINK", 18);
        MockToken uni  = new MockToken("Uniswap", "UNI", 18);
        MockToken usdc = new MockToken("USD Coin", "USDC", 6);
        MockToken usdt = new MockToken("Tether USD", "USDT", 6);
        MockToken dai  = new MockToken("Dai Stablecoin", "DAI", 18);
        MockToken frax = new MockToken("Frax", "FRAX", 18);

        // 2. Set Prices (Scaled to 8 decimals USD)
        oracle.setPrice(address(weth), 3000 * 1e8);
        oracle.setPrice(address(wbtc), 65000 * 1e8);
        oracle.setPrice(address(link), 18 * 1e8);
        oracle.setPrice(address(uni),  8 * 1e8);
        oracle.setPrice(address(usdc), 1 * 1e8);
        oracle.setPrice(address(usdt), 1 * 1e8);
        oracle.setPrice(address(dai),  1 * 1e8);
        oracle.setPrice(address(frax), 1 * 1e8);

        // 3. Configure Assets in Engine
        // Params: asset, isCollateral, isBorrowable, LTV, LiquidationThreshold, LiquidationBonus, BaseRate, Slope1, Slope2, OptimalUtil
        engine.configureAsset(address(weth), true, true, 8000, 8500, 500, 200, 400, 6000, 8000);
        engine.configureAsset(address(wbtc), true, true, 7500, 8000, 500, 200, 400, 6000, 8000);
        engine.configureAsset(address(link), true, true, 7000, 7500, 750, 300, 500, 8000, 8000);
        engine.configureAsset(address(uni),  true, true, 6500, 7000, 1000, 300, 500, 8000, 8000);
        engine.configureAsset(address(usdc), true, true, 9000, 9300, 300, 100, 300, 4000, 9000);
        engine.configureAsset(address(usdt), true, true, 9000, 9300, 300, 100, 300, 4000, 9000);
        engine.configureAsset(address(dai),  true, true, 9000, 9300, 300, 100, 300, 4000, 9000);
        engine.configureAsset(address(frax), false, true, 0, 0, 0, 200, 400, 5000, 8000);

        // 4. Seed Engine with Liquidity for Borrowing
        usdc.approve(address(engine), type(uint256).max);
        usdt.approve(address(engine), type(uint256).max);
        dai.approve(address(engine), type(uint256).max);
        frax.approve(address(engine), type(uint256).max);

        engine.supplyLiquidity(address(usdc), 1_000_000 * 1e6);
        engine.supplyLiquidity(address(usdt), 1_000_000 * 1e6);
        engine.supplyLiquidity(address(dai),  1_000_000 * 1e18);
        engine.supplyLiquidity(address(frax), 1_000_000 * 1e18);

        vm.stopBroadcast();

        console.log("----------------------------------------------");
        console.log("LendingEngine Deployed to:", address(engine));
        console.log("MockOracle Deployed to:   ", address(oracle));
        console.log("WETH Address:             ", address(weth));
        console.log("WBTC Address:             ", address(wbtc));
        console.log("USDC Address:             ", address(usdc));
        console.log("USDT Address:             ", address(usdt));
        console.log("DAI Address:              ", address(dai));
        console.log("----------------------------------------------");
    }
}