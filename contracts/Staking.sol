// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TAP Token Staking Contract
 * @dev Stake TAP tokens to earn TAP rewards
 * 
 * Features:
 * - Stake TAP tokens to earn rewards
 * - Configurable APY (default 10%)
 * - Minimum stake amount: 100 TAP
 * - Rewards accrue per second
 * - Owner funds reward pool
 * 
 * Reward Calculation:
 * - Rewards are calculated based on time staked and APY
 * - Formula: (stakedAmount * APY * timeStaked) / (365 days * 100)
 */
contract Staking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    /// @notice TAP token contract
    IERC20 public immutable stakingToken;
    
    /// @notice Minimum stake amount (100 TAP)
    uint256 public constant MIN_STAKE = 100 * 10**18;
    
    /// @notice APY in basis points (1000 = 10%)
    uint256 public rewardRateBps = 1000;
    
    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    /// @notice Seconds in a year (for APY calculation)
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    
    /// @notice Staker information
    struct StakeInfo {
        uint256 amount;           // Amount staked
        uint256 rewardDebt;       // Rewards already accounted for
        uint256 lastUpdateTime;   // Last time rewards were calculated
    }
    
    /// @notice Mapping of staker address to their stake info
    mapping(address => StakeInfo) public stakes;
    
    /// @notice Total tokens staked
    uint256 public totalStaked;
    
    /// @notice Total rewards available in the pool
    uint256 public rewardPool;
    
    /// @notice Total rewards claimed
    uint256 public totalRewardsClaimed;
    
    /// @notice Emitted when tokens are staked
    event Staked(address indexed user, uint256 amount);
    
    /// @notice Emitted when tokens are withdrawn
    event Withdrawn(address indexed user, uint256 amount);
    
    /// @notice Emitted when rewards are claimed
    event RewardsClaimed(address indexed user, uint256 amount);
    
    /// @notice Emitted when reward pool is funded
    event RewardPoolFunded(uint256 amount);
    
    /// @notice Emitted when reward rate is updated
    event RewardRateUpdated(uint256 oldRate, uint256 newRate);
    
    /**
     * @dev Constructor sets the staking token
     * @param _stakingToken TAP token address
     */
    constructor(address _stakingToken) Ownable(msg.sender) {
        require(_stakingToken != address(0), "Staking token cannot be zero");
        stakingToken = IERC20(_stakingToken);
    }
    
    /**
     * @notice Fund the reward pool
     * @param amount Amount of TAP to add to reward pool
     */
    function fundRewardPool(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPool += amount;
        emit RewardPoolFunded(amount);
    }
    
    /**
     * @notice Update reward rate (APY)
     * @param newRateBps New rate in basis points (1000 = 10%)
     */
    function setRewardRate(uint256 newRateBps) external onlyOwner {
        require(newRateBps <= 10000, "Rate cannot exceed 100%");
        uint256 oldRate = rewardRateBps;
        rewardRateBps = newRateBps;
        emit RewardRateUpdated(oldRate, newRateBps);
    }
    
    /**
     * @notice Stake TAP tokens
     * @param amount Amount to stake (must be >= MIN_STAKE for first stake)
     */
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot stake 0");
        
        StakeInfo storage userStake = stakes[msg.sender];
        
        // First stake must meet minimum
        if (userStake.amount == 0) {
            require(amount >= MIN_STAKE, "First stake must be at least 100 TAP");
        }
        
        // Calculate and store pending rewards before updating stake
        if (userStake.amount > 0) {
            uint256 pending = _calculatePendingRewards(msg.sender);
            userStake.rewardDebt += pending;
        }
        
        // Transfer tokens to contract
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Update stake info
        userStake.amount += amount;
        userStake.lastUpdateTime = block.timestamp;
        totalStaked += amount;
        
        emit Staked(msg.sender, amount);
    }
    
    /**
     * @notice Withdraw staked tokens
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        StakeInfo storage userStake = stakes[msg.sender];
        require(userStake.amount >= amount, "Insufficient staked amount");
        require(amount > 0, "Cannot withdraw 0");
        
        // Calculate and store pending rewards before updating stake
        uint256 pending = _calculatePendingRewards(msg.sender);
        userStake.rewardDebt += pending;
        
        // Update stake info
        userStake.amount -= amount;
        userStake.lastUpdateTime = block.timestamp;
        totalStaked -= amount;
        
        // Transfer tokens back to user
        stakingToken.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }
    
    /**
     * @notice Claim accumulated rewards
     */
    function claimRewards() external nonReentrant {
        StakeInfo storage userStake = stakes[msg.sender];
        
        // Calculate total rewards
        uint256 pending = _calculatePendingRewards(msg.sender);
        uint256 totalReward = userStake.rewardDebt + pending;
        
        require(totalReward > 0, "No rewards to claim");
        require(rewardPool >= totalReward, "Insufficient reward pool");
        
        // Reset reward tracking
        userStake.rewardDebt = 0;
        userStake.lastUpdateTime = block.timestamp;
        
        // Update pool and claimed totals
        rewardPool -= totalReward;
        totalRewardsClaimed += totalReward;
        
        // Transfer rewards
        stakingToken.safeTransfer(msg.sender, totalReward);
        
        emit RewardsClaimed(msg.sender, totalReward);
    }
    
    /**
     * @notice Withdraw all staked tokens and claim rewards
     */
    function exit() external nonReentrant {
        StakeInfo storage userStake = stakes[msg.sender];
        require(userStake.amount > 0, "Nothing staked");
        
        uint256 stakedAmount = userStake.amount;
        uint256 pending = _calculatePendingRewards(msg.sender);
        uint256 totalReward = userStake.rewardDebt + pending;
        
        // Reset user stake
        userStake.amount = 0;
        userStake.rewardDebt = 0;
        userStake.lastUpdateTime = block.timestamp;
        totalStaked -= stakedAmount;
        
        // Transfer staked tokens
        stakingToken.safeTransfer(msg.sender, stakedAmount);
        emit Withdrawn(msg.sender, stakedAmount);
        
        // Transfer rewards if any and pool has funds
        if (totalReward > 0 && rewardPool >= totalReward) {
            rewardPool -= totalReward;
            totalRewardsClaimed += totalReward;
            stakingToken.safeTransfer(msg.sender, totalReward);
            emit RewardsClaimed(msg.sender, totalReward);
        }
    }
    
    /**
     * @notice Get pending rewards for a user
     * @param user User address
     * @return Total pending rewards (including stored debt)
     */
    function pendingRewards(address user) external view returns (uint256) {
        StakeInfo storage userStake = stakes[user];
        return userStake.rewardDebt + _calculatePendingRewards(user);
    }
    
    /**
     * @notice Get stake info for a user
     * @param user User address
     * @return amount Staked amount
     * @return pending Total pending rewards
     */
    function getStakeInfo(address user) external view returns (uint256 amount, uint256 pending) {
        StakeInfo storage userStake = stakes[user];
        amount = userStake.amount;
        pending = userStake.rewardDebt + _calculatePendingRewards(user);
    }
    
    /**
     * @notice Calculate current APY based on reward rate
     * @return APY percentage (e.g., 10 for 10%)
     */
    function getCurrentAPY() external view returns (uint256) {
        return rewardRateBps / 100;
    }
    
    /**
     * @dev Calculate pending rewards based on time staked
     */
    function _calculatePendingRewards(address user) internal view returns (uint256) {
        StakeInfo storage userStake = stakes[user];
        
        if (userStake.amount == 0 || userStake.lastUpdateTime == 0) {
            return 0;
        }
        
        uint256 timeStaked = block.timestamp - userStake.lastUpdateTime;
        
        // Formula: (amount * rate * time) / (seconds_per_year * bps_denominator)
        return (userStake.amount * rewardRateBps * timeStaked) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);
    }
    
    /**
     * @notice Emergency withdraw by owner (for stuck tokens)
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(token != address(stakingToken), "Cannot withdraw staking token");
        IERC20(token).safeTransfer(owner(), amount);
    }
}
