import { parseAbi } from 'viem';

export const LENDING_ENGINE_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
export const MOCK_ORACLE_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
export const WETH_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
export const USDC_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

export const LENDING_ENGINE_ABI = parseAbi([
  "function depositCollateral(address asset, uint256 amount) external",
  "function supplyLiquidity(address asset, uint256 amount) external",
  "function borrow(address asset, uint256 amount) external",
  "function repay(address asset, uint256 amount) external",
  "function liquidate(address borrower, address collateralAsset, address debtAsset, uint256 debtToCover) external",
  "function getHealthFactor(address user) external view returns (uint256)",
  "function s_collateralDeposits(address user, address asset) external view returns (uint256)",
  "function s_borrowedBalances(address user, address asset) external view returns (uint256)"
]);

export const MOCK_ORACLE_ABI = parseAbi([
  "function setPrice(address asset, uint256 price) external",
  "function getPrice(address asset) external view returns (uint256)"
]);

export const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function mint(address to, uint256 amount) external"
]);