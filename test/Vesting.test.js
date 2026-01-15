/**
 * Vesting Contract Unit Tests
 * Tests token vesting with cliff and linear release
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Vesting Contract", function () {
    let tap;
    let vesting;
    let owner;
    let beneficiary;
    let other;

    const VEST_AMOUNT = ethers.parseEther("10000");
    const CLIFF_DURATION = 180 * 24 * 60 * 60; // 180 days in seconds
    const VESTING_DURATION = 365 * 24 * 60 * 60; // 365 days in seconds

    beforeEach(async function () {
        [owner, beneficiary, other] = await ethers.getSigners();

        // Deploy TAP token (using original TAP for simplicity)
        const TAP = await ethers.getContractFactory("TAP");
        tap = await TAP.deploy();
        await tap.waitForDeployment();

        // Deploy Vesting contract
        const Vesting = await ethers.getContractFactory("Vesting");
        vesting = await Vesting.deploy(await tap.getAddress());
        await vesting.waitForDeployment();

        // Approve vesting contract to spend tokens
        await tap.approve(await vesting.getAddress(), VEST_AMOUNT);
    });

    describe("Deployment", function () {
        it("should set correct token address", async function () {
            expect(await vesting.token()).to.equal(await tap.getAddress());
        });

        it("should set correct owner", async function () {
            expect(await vesting.owner()).to.equal(owner.address);
        });
    });

    describe("Create Vesting", function () {
        it("should create vesting schedule", async function () {
            await vesting.createVesting(
                beneficiary.address,
                VEST_AMOUNT,
                CLIFF_DURATION,
                VESTING_DURATION
            );

            expect(await vesting.getScheduleCount(beneficiary.address)).to.equal(1);
            expect(await vesting.totalLocked()).to.equal(VEST_AMOUNT);
        });

        it("should emit VestingCreated event", async function () {
            await expect(
                vesting.createVesting(
                    beneficiary.address,
                    VEST_AMOUNT,
                    CLIFF_DURATION,
                    VESTING_DURATION
                )
            ).to.emit(vesting, "VestingCreated");
        });

        it("should reject zero beneficiary", async function () {
            await expect(
                vesting.createVesting(
                    ethers.ZeroAddress,
                    VEST_AMOUNT,
                    CLIFF_DURATION,
                    VESTING_DURATION
                )
            ).to.be.revertedWith("Beneficiary cannot be zero address");
        });

        it("should reject zero amount", async function () {
            await expect(
                vesting.createVesting(
                    beneficiary.address,
                    0,
                    CLIFF_DURATION,
                    VESTING_DURATION
                )
            ).to.be.revertedWith("Amount must be greater than 0");
        });
    });

    describe("Vesting Release", function () {
        beforeEach(async function () {
            await vesting.createVesting(
                beneficiary.address,
                VEST_AMOUNT,
                CLIFF_DURATION,
                VESTING_DURATION
            );
        });

        it("should return 0 vested before cliff", async function () {
            expect(await vesting.vestedAmount(beneficiary.address, 0)).to.equal(0);
            expect(await vesting.releasableAmount(beneficiary.address, 0)).to.equal(0);
        });

        it("should vest linearly after cliff", async function () {
            // Move to 50% of vesting period
            await time.increase(VESTING_DURATION / 2);

            const vested = await vesting.vestedAmount(beneficiary.address, 0);
            const expectedVested = VEST_AMOUNT / 2n;

            // Allow 1% tolerance for time-based calculations
            expect(vested).to.be.closeTo(expectedVested, expectedVested / 100n);
        });

        it("should release all tokens after vesting ends", async function () {
            // Move past vesting end
            await time.increase(VESTING_DURATION + 1);

            expect(await vesting.vestedAmount(beneficiary.address, 0)).to.equal(VEST_AMOUNT);
        });

        it("should allow beneficiary to release vested tokens", async function () {
            // Move to end of vesting
            await time.increase(VESTING_DURATION + 1);

            await vesting.connect(beneficiary).release(0);

            expect(await tap.balanceOf(beneficiary.address)).to.equal(VEST_AMOUNT);
        });

        it("should emit TokensReleased event", async function () {
            await time.increase(VESTING_DURATION + 1);

            await expect(vesting.connect(beneficiary).release(0))
                .to.emit(vesting, "TokensReleased")
                .withArgs(beneficiary.address, 0, VEST_AMOUNT);
        });
    });

    describe("Revoke Vesting", function () {
        beforeEach(async function () {
            await vesting.createVesting(
                beneficiary.address,
                VEST_AMOUNT,
                CLIFF_DURATION,
                VESTING_DURATION
            );
        });

        it("should allow owner to revoke vesting", async function () {
            await time.increase(VESTING_DURATION / 2);

            const vestedBefore = await vesting.vestedAmount(beneficiary.address, 0);
            const ownerBalanceBefore = await tap.balanceOf(owner.address);

            await vesting.revoke(beneficiary.address, 0);

            const ownerBalanceAfter = await tap.balanceOf(owner.address);
            const refunded = ownerBalanceAfter - ownerBalanceBefore;

            // Refund should be approximately half (unvested portion)
            expect(refunded).to.be.closeTo(VEST_AMOUNT / 2n, VEST_AMOUNT / 100n);
        });

        it("should reject non-owner revoke", async function () {
            await expect(
                vesting.connect(other).revoke(beneficiary.address, 0)
            ).to.be.revertedWithCustomError(vesting, "OwnableUnauthorizedAccount");
        });
    });
});
