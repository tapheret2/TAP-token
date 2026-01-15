// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TAP Token v2.0
 * @dev ERC-20 token with automatic burn on transfer (deflationary mechanism)
 * 
 * Token Specifications:
 * - Name: TAP
 * - Symbol: TAP
 * - Decimals: 18
 * - Total Supply: 101,902,975 TAP (initial, decreases over time due to burns)
 * - Burn Rate: 1% per transfer (configurable)
 * - Burn Exclusions: Owner, Staking contract, Vesting contract
 * 
 * Features:
 * - Automatic 1% burn on every transfer
 * - Excludable addresses from burn (for DEX liquidity, staking, etc.)
 * - Manual burn function available to all holders
 */
contract TAPv2 is ERC20, ERC20Burnable, Ownable {
    
    /// @notice Burn rate in basis points (100 = 1%)
    uint256 public constant BURN_RATE = 100;
    
    /// @notice Basis points denominator (10000 = 100%)
    uint256 public constant BASIS_POINTS = 10000;
    
    /// @notice Dead address for burned tokens
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    
    /// @notice Initial total supply: 101,902,975 tokens
    uint256 private constant INITIAL_SUPPLY = 101_902_975 * 10**18;
    
    /// @notice Total tokens burned
    uint256 public totalBurned;
    
    /// @notice Addresses excluded from burn (e.g., staking, vesting, liquidity pools)
    mapping(address => bool) public isExcludedFromBurn;
    
    /// @notice Emitted when tokens are burned during transfer
    event BurnOnTransfer(address indexed from, address indexed to, uint256 burnAmount);
    
    /// @notice Emitted when an address is excluded/included from burn
    event BurnExclusionUpdated(address indexed account, bool excluded);
    
    /**
     * @dev Constructor mints initial supply to deployer and sets up exclusions
     */
    constructor() ERC20("TAP", "TAP") Ownable(msg.sender) {
        // Mint initial supply to deployer
        _mint(msg.sender, INITIAL_SUPPLY);
        
        // Exclude deployer from burn by default
        isExcludedFromBurn[msg.sender] = true;
        emit BurnExclusionUpdated(msg.sender, true);
        
        // Exclude dead address from burn
        isExcludedFromBurn[DEAD_ADDRESS] = true;
    }
    
    /**
     * @notice Set burn exclusion for an address
     * @param account Address to update
     * @param excluded True to exclude from burn, false to include
     */
    function setExcludedFromBurn(address account, bool excluded) external onlyOwner {
        require(account != address(0), "Cannot set zero address");
        isExcludedFromBurn[account] = excluded;
        emit BurnExclusionUpdated(account, excluded);
    }
    
    /**
     * @notice Batch set burn exclusions
     * @param accounts Array of addresses
     * @param excluded Array of exclusion statuses
     */
    function batchSetExcludedFromBurn(
        address[] calldata accounts, 
        bool[] calldata excluded
    ) external onlyOwner {
        require(accounts.length == excluded.length, "Arrays length mismatch");
        for (uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] != address(0), "Cannot set zero address");
            isExcludedFromBurn[accounts[i]] = excluded[i];
            emit BurnExclusionUpdated(accounts[i], excluded[i]);
        }
    }
    
    /**
     * @dev Override _update to implement burn-on-transfer
     * Burns 1% of transfer amount unless sender or receiver is excluded
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        // Skip burn logic for minting (from == 0) or burning (to == 0)
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }
        
        // Check if burn should be applied
        bool shouldBurn = !isExcludedFromBurn[from] && !isExcludedFromBurn[to];
        
        if (shouldBurn && amount > 0) {
            // Calculate burn amount (1%)
            uint256 burnAmount = (amount * BURN_RATE) / BASIS_POINTS;
            uint256 transferAmount = amount - burnAmount;
            
            // Burn tokens by sending to dead address
            if (burnAmount > 0) {
                super._update(from, DEAD_ADDRESS, burnAmount);
                totalBurned += burnAmount;
                emit BurnOnTransfer(from, to, burnAmount);
            }
            
            // Transfer remaining amount
            super._update(from, to, transferAmount);
        } else {
            // No burn, regular transfer
            super._update(from, to, amount);
        }
    }
    
    /**
     * @notice Get circulating supply (total supply minus burned)
     * @return Current circulating supply
     */
    function circulatingSupply() external view returns (uint256) {
        return totalSupply() - balanceOf(DEAD_ADDRESS);
    }
}
