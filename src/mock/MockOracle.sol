// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockOracle
 * @notice Simple mock price oracle for testing asset values.
 * Returns asset prices formatted to 8 decimals (Chainlink standard).
 */
contract MockOracle {
    // Maps token address -> price in USD (scaled by 1e8)
    mapping(address => uint256) private s_prices;

    event PriceUpdated(address indexed asset, uint256 newPrice);

    /// @notice Set or update the price of an asset (8 decimals)
    function setPrice(address asset, uint256 price) external {
        require(price > 0, "MockOracle: Price must be greater than zero");
        s_prices[asset] = price;
        emit PriceUpdated(asset, price);
    }

    /// @notice Get the USD price of an asset
    function getPrice(address asset) external view returns (uint256) {
        uint256 price = s_prices[asset];
        require(price > 0, "MockOracle: Price not set for asset");
        return price;
    }
}