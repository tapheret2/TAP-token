// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TAP Token Vesting Contract
 * @dev Locks tokens for beneficiaries with cliff period and linear vesting
 * 
 * Features:
 * - Cliff period: No tokens released before cliff ends
 * - Linear vesting: Tokens released gradually after cliff
 * - Multiple vesting schedules per beneficiary supported
 * - Owner can create vesting schedules
 * - Beneficiaries can claim vested tokens anytime
 * 
 * Use Cases:
 * - Team token allocation (e.g., 2 year vesting with 6 month cliff)
 * - Investor token allocation
 * - Advisor token allocation
 */
contract Vesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    /// @notice TAP token contract
    IERC20 public immutable token;
    
    /// @notice Vesting schedule structure
    struct VestingSchedule {
        uint256 totalAmount;      // Total tokens to vest
        uint256 startTime;        // Vesting start timestamp
        uint256 cliffDuration;    // Cliff period in seconds
        uint256 vestingDuration;  // Total vesting duration in seconds
        uint256 releasedAmount;   // Amount already released
        bool revoked;             // Whether vesting was revoked
    }
    
    /// @notice Mapping from beneficiary to their vesting schedules
    mapping(address => VestingSchedule[]) public vestingSchedules;
    
    /// @notice Total tokens locked in all vesting schedules
    uint256 public totalLocked;
    
    /// @notice Emitted when a vesting schedule is created
    event VestingCreated(
        address indexed beneficiary,
        uint256 indexed scheduleIndex,
        uint256 amount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 vestingDuration
    );
    
    /// @notice Emitted when tokens are released
    event TokensReleased(
        address indexed beneficiary,
        uint256 indexed scheduleIndex,
        uint256 amount
    );
    
    /// @notice Emitted when a vesting schedule is revoked
    event VestingRevoked(
        address indexed beneficiary,
        uint256 indexed scheduleIndex,
        uint256 refundAmount
    );
    
    /**
     * @dev Constructor sets the TAP token address
     * @param _token TAP token contract address
     */
    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "Token address cannot be zero");
        token = IERC20(_token);
    }
    
    /**
     * @notice Create a new vesting schedule for a beneficiary
     * @param beneficiary Address receiving vested tokens
     * @param amount Total tokens to vest
     * @param cliffDuration Cliff period in seconds (e.g., 180 days = 15552000)
     * @param vestingDuration Total vesting duration in seconds (e.g., 730 days = 63072000)
     */
    function createVesting(
        address beneficiary,
        uint256 amount,
        uint256 cliffDuration,
        uint256 vestingDuration
    ) external onlyOwner {
        require(beneficiary != address(0), "Beneficiary cannot be zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(vestingDuration > 0, "Vesting duration must be greater than 0");
        require(cliffDuration <= vestingDuration, "Cliff cannot exceed vesting duration");
        
        // Transfer tokens to this contract
        token.safeTransferFrom(msg.sender, address(this), amount);
        
        uint256 startTime = block.timestamp;
        
        vestingSchedules[beneficiary].push(VestingSchedule({
            totalAmount: amount,
            startTime: startTime,
            cliffDuration: cliffDuration,
            vestingDuration: vestingDuration,
            releasedAmount: 0,
            revoked: false
        }));
        
        totalLocked += amount;
        
        uint256 scheduleIndex = vestingSchedules[beneficiary].length - 1;
        emit VestingCreated(
            beneficiary,
            scheduleIndex,
            amount,
            startTime,
            cliffDuration,
            vestingDuration
        );
    }
    
    /**
     * @notice Release vested tokens for a specific schedule
     * @param scheduleIndex Index of the vesting schedule
     */
    function release(uint256 scheduleIndex) external nonReentrant {
        require(scheduleIndex < vestingSchedules[msg.sender].length, "Invalid schedule index");
        
        VestingSchedule storage schedule = vestingSchedules[msg.sender][scheduleIndex];
        require(!schedule.revoked, "Vesting was revoked");
        
        uint256 releasable = _releasableAmount(schedule);
        require(releasable > 0, "No tokens to release");
        
        schedule.releasedAmount += releasable;
        totalLocked -= releasable;
        
        token.safeTransfer(msg.sender, releasable);
        
        emit TokensReleased(msg.sender, scheduleIndex, releasable);
    }
    
    /**
     * @notice Release all vested tokens from all schedules
     */
    function releaseAll() external nonReentrant {
        uint256 totalReleasable = 0;
        VestingSchedule[] storage schedules = vestingSchedules[msg.sender];
        
        for (uint256 i = 0; i < schedules.length; i++) {
            if (!schedules[i].revoked) {
                uint256 releasable = _releasableAmount(schedules[i]);
                if (releasable > 0) {
                    schedules[i].releasedAmount += releasable;
                    totalReleasable += releasable;
                    emit TokensReleased(msg.sender, i, releasable);
                }
            }
        }
        
        require(totalReleasable > 0, "No tokens to release");
        totalLocked -= totalReleasable;
        token.safeTransfer(msg.sender, totalReleasable);
    }
    
    /**
     * @notice Revoke a vesting schedule (only owner)
     * @dev Returns unvested tokens to owner, vested tokens remain claimable
     * @param beneficiary Beneficiary address
     * @param scheduleIndex Index of the vesting schedule
     */
    function revoke(address beneficiary, uint256 scheduleIndex) external onlyOwner {
        require(scheduleIndex < vestingSchedules[beneficiary].length, "Invalid schedule index");
        
        VestingSchedule storage schedule = vestingSchedules[beneficiary][scheduleIndex];
        require(!schedule.revoked, "Already revoked");
        
        uint256 vestedAmount = _vestedAmount(schedule);
        uint256 refundAmount = schedule.totalAmount - vestedAmount;
        
        schedule.revoked = true;
        schedule.totalAmount = vestedAmount; // Reduce to only vested amount
        
        if (refundAmount > 0) {
            totalLocked -= refundAmount;
            token.safeTransfer(owner(), refundAmount);
        }
        
        emit VestingRevoked(beneficiary, scheduleIndex, refundAmount);
    }
    
    /**
     * @notice Get vested amount for a schedule
     * @param beneficiary Beneficiary address
     * @param scheduleIndex Index of the vesting schedule
     * @return Vested amount
     */
    function vestedAmount(address beneficiary, uint256 scheduleIndex) external view returns (uint256) {
        require(scheduleIndex < vestingSchedules[beneficiary].length, "Invalid schedule index");
        return _vestedAmount(vestingSchedules[beneficiary][scheduleIndex]);
    }
    
    /**
     * @notice Get releasable amount for a schedule
     * @param beneficiary Beneficiary address
     * @param scheduleIndex Index of the vesting schedule
     * @return Releasable amount
     */
    function releasableAmount(address beneficiary, uint256 scheduleIndex) external view returns (uint256) {
        require(scheduleIndex < vestingSchedules[beneficiary].length, "Invalid schedule index");
        return _releasableAmount(vestingSchedules[beneficiary][scheduleIndex]);
    }
    
    /**
     * @notice Get number of vesting schedules for a beneficiary
     * @param beneficiary Beneficiary address
     * @return Number of schedules
     */
    function getScheduleCount(address beneficiary) external view returns (uint256) {
        return vestingSchedules[beneficiary].length;
    }
    
    /**
     * @dev Calculate vested amount for a schedule
     */
    function _vestedAmount(VestingSchedule storage schedule) internal view returns (uint256) {
        if (schedule.revoked) {
            return schedule.totalAmount; // All remaining is vested if revoked
        }
        
        uint256 cliffEnd = schedule.startTime + schedule.cliffDuration;
        
        // Before cliff ends, nothing is vested
        if (block.timestamp < cliffEnd) {
            return 0;
        }
        
        uint256 vestingEnd = schedule.startTime + schedule.vestingDuration;
        
        // After vesting ends, everything is vested
        if (block.timestamp >= vestingEnd) {
            return schedule.totalAmount;
        }
        
        // Linear vesting between cliff and end
        uint256 timeFromStart = block.timestamp - schedule.startTime;
        return (schedule.totalAmount * timeFromStart) / schedule.vestingDuration;
    }
    
    /**
     * @dev Calculate releasable amount for a schedule
     */
    function _releasableAmount(VestingSchedule storage schedule) internal view returns (uint256) {
        return _vestedAmount(schedule) - schedule.releasedAmount;
    }
}
