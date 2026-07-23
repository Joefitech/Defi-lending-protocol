// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice Standard ERC20 token used for local testing and protocol simulation.
 */
contract MockERC20 is ERC20 {
    uint8 private immutable i_decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) {
        i_decimals = decimals_;
    }

    /// @dev Overriding decimals to support non-18 decimal tokens like USDC (6) or WBTC (8)
    function decimals() public view virtual override returns (uint8) {
        return i_decimals;
    }

    /// @notice Allows minting tokens freely during testing
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}