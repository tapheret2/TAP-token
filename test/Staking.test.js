/**
 * Staking Contract Unit Tests
 * Tests stake, withdraw, and rewards functionality
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Staking Contract", function () {
    let tap;
    let staking;
    let owner;
    let staker1;
    let staker2;

    const STAKE_AMOUNT = ethers.parseEther("1000");
    const MIN_STAKE = ethers.parseEther("100");
    const REWARD_POOL = ethers.parseEther("100000");
    const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

    beforeEach(async function () {
        [owner, staker1, staker2] = await ethers.getSigners();

        // Deploy TAP token
        const TAP = await ethers.getContractFactory("TAP");
        tap = await TAP.deploy();
        await tap.waitForDeployment();

        // Deploy Staking contract
        const Staking = await ethers.getContractFactory("Staking");
        staking = await Staking.deploy(await tap.getAddress());
        await staking.waitForDeployment();

        // Fund reward pool
        await tap.approve(await staking.getAddress(), REWARD_POOL);
        await staking.fundRewardPool(REWARD_POOL);

        // Transfer tokens to stakers
        await tap.transfer(staker1.address, STAKE_AMOUNT * 10n);
        await tap.transfer(staker2.address, STAKE_AMOUNT * 10n);

        // Approve staking contract
        await tap.connect(staker1).approve(await staking.getAddress(), STAKE_AMOUNT * 10n);
        await tap.connect(staker2).approve(await staking.getAddress(), STAKE_AMOUNT * 10n);
    });

    describe("Deployment", function () {
        it("should set correct staking token", async function () {
            expect(await staking.stakingToken()).to.equal(await tap.getAddress());
        });

        it("should have funded reward pool", async function () {
            expect(await staking.rewardPool()).to.equal(REWARD_POOL);
        });

        it("should have correct default APY (10%)", async function () {
            expect(await staking.getCurrentAPY()).to.equal(10n);
        });
    });

    describe("Staking", function () {
        it("should allow staking above minimum", async function () {
            await staking.connect(staker1).stake(STAKE_AMOUNT);

            const stakeInfo = await staking.getStakeInfo(staker1.address);
            expect(stakeInfo.amount).to.equal(STAKE_AMOUNT);
            expect(await staking.totalStaked()).to.equal(STAKE_AMOUNT);
        });

        it("should reject stake below minimum", async function () {
            await expect(
                staking.connect(staker1).stake(MIN_STAKE - 1n)
            ).to.be.revertedWith("First stake must be at least 100 TAP");
        });

        it("should emit Staked event", async function () {
            await expect(staking.connect(staker1).stake(STAKE_AMOUNT))
                .to.emit(staking, "Staked")
                .withArgs(staker1.address, STAKE_AMOUNT);
        });

        it("should allow additional stakes below minimum", async function () {
            await staking.connect(staker1).stake(STAKE_AMOUNT);

            // Additional stake can be smaller
            const smallAmount = ethers.parseEther("10");
            await staking.connect(staker1).stake(smallAmount);

            const stakeInfo = await staking.getStakeInfo(staker1.address);
            expect(stakeInfo.amount).to.equal(STAKE_AMOUNT + smallAmount);
        });
    });

    describe("Withdrawing", function () {
        beforeEach(async function () {
            await staking.connect(staker1).stake(STAKE_AMOUNT);
        });

        it("should allow withdrawing staked tokens", async function () {
            const balanceBefore = await tap.balanceOf(staker1.address);
            await staking.connect(staker1).withdraw(STAKE_AMOUNT);
            const balanceAfter = await tap.balanceOf(staker1.address);

            expect(balanceAfter - balanceBefore).to.equal(STAKE_AMOUNT);
            expect(await staking.totalStaked()).to.equal(0n);
        });

        it("should reject withdrawing more than staked", async function () {
            await expect(
                staking.connect(staker1).withdraw(STAKE_AMOUNT + 1n)
            ).to.be.revertedWith("Insufficient staked amount");
        });

        it("should emit Withdrawn event", async function () {
            await expect(staking.connect(staker1).withdraw(STAKE_AMOUNT))
                .to.emit(staking, "Withdrawn")
                .withArgs(staker1.address, STAKE_AMOUNT);
        });
    });

    describe("Rewards", function () {
        beforeEach(async function () {
            await staking.connect(staker1).stake(STAKE_AMOUNT);
        });

        it("should accrue rewards over time", async function () {
            // Advance time by 1 year
            await time.increase(SECONDS_PER_YEAR);

            const pending = await staking.pendingRewards(staker1.address);

            // Expected: 10% of 1000 TAP = 100 TAP
            const expectedReward = STAKE_AMOUNT / 10n;

            // Allow 1% tolerance for time-based calculations
            expect(pending).to.be.closeTo(expectedReward, expectedReward / 100n);
        });

        it("should allow claiming rewards", async function () {
            await time.increase(SECONDS_PER_YEAR);

            const pendingBefore = await staking.pendingRewards(staker1.address);
            const balanceBefore = await tap.balanceOf(staker1.address);

            await staking.connect(staker1).claimRewards();

            const balanceAfter = await tap.balanceOf(staker1.address);
            expect(balanceAfter - balanceBefore).to.be.closeTo(pendingBefore, pendingBefore / 100n);
        });

        it("should emit RewardsClaimed event", async function () {
            await time.increase(SECONDS_PER_YEAR);

            await expect(staking.connect(staker1).claimRewards())
                .to.emit(staking, "RewardsClaimed");
        });
    });

    describe("Exit", function () {
        it("should allow exit (withdraw all + claim rewards)", async function () {
            await staking.connect(staker1).stake(STAKE_AMOUNT);
            await time.increase(SECONDS_PER_YEAR);

            const balanceBefore = await tap.balanceOf(staker1.address);
            await staking.connect(staker1).exit();
            const balanceAfter = await tap.balanceOf(staker1.address);

            // Should receive stake + ~10% rewards
            const received = balanceAfter - balanceBefore;
            expect(received).to.be.gt(STAKE_AMOUNT);
        });
    });

    describe("Admin Functions", function () {
        it("should allow owner to update reward rate", async function () {
            await staking.setRewardRate(2000); // 20%
            expect(await staking.getCurrentAPY()).to.equal(20n);
        });

        it("should reject non-owner rate update", async function () {
            await expect(
                staking.connect(staker1).setRewardRate(2000)
            ).to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
        });

        it("should allow owner to fund reward pool", async function () {
            const additionalRewards = ethers.parseEther("10000");
            await tap.approve(await staking.getAddress(), additionalRewards);

            await staking.fundRewardPool(additionalRewards);
            expect(await staking.rewardPool()).to.equal(REWARD_POOL + additionalRewards);
        });
    });
});
