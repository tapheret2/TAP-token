// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title TAP Token
 * @dev A simple ERC-20 token with fixed supply.
 * 
 * Token Specifications:
 * - Name: TAP
 * - Symbol: TAP
 * - Decimals: 18 (inherited from ERC20)
 * - Total Supply: 101,902,975 TAP
 * - Initial Distribution: 100% minted to deployer
 * - Post-deployment Minting: Disabled (no mint function)
 * 
 * This contract inherits from OpenZeppelin's ERC20 implementation,
 * which provides battle-tested, secure token functionality.
 */
contract TAP is ERC20 {
    /**
     * @dev Fixed total supply of TAP tokens.
     * 101,902,975 tokens with 18 decimals = 101902975 * 10^18 smallest units
     */
    uint256 private constant TOTAL_SUPPLY = 101_902_975 * 10**18;

    /**
     * @dev Constructor that mints the entire supply to the deployer.
     * 
     * The deployer (msg.sender) receives 100% of the total supply.
     * No additional tokens can be minted after deployment as there
     * is no mint function exposed.
     */
    constructor() ERC20("TAP", "TAP") {
        // Mint the entire fixed supply to the deployer's address
        _mint(msg.sender, TOTAL_SUPPLY);
    }
}
