import { parseAbi } from 'viem';

export const LENDING_ENGINE_ADDRESS = "0x9A676e781A523b5d0C0e43731313A708CB607508";
export const MOCK_ORACLE_ADDRESS = "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82";

export const LENDING_ENGINE_ABI = parseAbi([
  "function getAllowedAssets() view returns (address[])",
  "function s_assetConfigs(address) view returns (bool isSupported, bool isCollateral, bool isBorrowable, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus, uint256 baseRate, uint256 slope1, uint256 slope2, uint256 optimalUtilization)",
  "function getAccountInformation(address) view returns (uint256 totalCollateralValueUsd, uint256 totalBorrowValueUsd, uint256 maxBorrowCapacityUsd)",
  "function getHealthFactor(address) view returns (uint256)",
  "function getUtilizationRate(address) view returns (uint256)",
  "function getBorrowRates(address) view returns (uint256 borrowRateBps, uint256 supplyRateBps)",
  "function s_collateralDeposits(address, address) view returns (uint256)",
  "function s_borrowedBalances(address, address) view returns (uint256)",
  "function depositCollateral(address asset, uint256 amount)",
  "function supplyLiquidity(address asset, uint256 amount)",
  "function borrow(address asset, uint256 amount)",
  "function repay(address asset, uint256 amount)"
]);

export const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function mint(address to, uint256 amount)"
]);

export const ORACLE_ABI = parseAbi([
  "function getPrice(address asset) view returns (uint256)",
  "function setPrice(address asset, uint256 price)"
]);