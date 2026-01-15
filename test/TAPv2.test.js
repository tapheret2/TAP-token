/**
 * TAPv2 Token Unit Tests
 * Tests burn-on-transfer mechanism and exclusion functionality
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TAPv2 Token", function () {
    let tapv2;
    let owner;
    let addr1;
    let addr2;

    const TOTAL_SUPPLY = ethers.parseEther("101902975");
    const BURN_RATE = 100n; // 1% in basis points
    const BASIS_POINTS = 10000n;
    const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        const TAPv2 = await ethers.getContractFactory("TAPv2");
        tapv2 = await TAPv2.deploy();
        await tapv2.waitForDeployment();
    });

    describe("Deployment", function () {
        it("should have correct name and symbol", async function () {
            expect(await tapv2.name()).to.equal("TAP");
            expect(await tapv2.symbol()).to.equal("TAP");
        });

        it("should mint total supply to owner", async function () {
            expect(await tapv2.balanceOf(owner.address)).to.equal(TOTAL_SUPPLY);
        });

        it("should exclude owner from burn by default", async function () {
            expect(await tapv2.isExcludedFromBurn(owner.address)).to.be.true;
        });
    });

    describe("Burn on Transfer", function () {
        it("should burn 1% on transfer between non-excluded addresses", async function () {
            const transferAmount = ethers.parseEther("1000");
            const expectedBurn = (transferAmount * BURN_RATE) / BASIS_POINTS;
            const expectedReceived = transferAmount - expectedBurn;

            // First transfer to addr1 (owner is excluded, no burn)
            await tapv2.transfer(addr1.address, transferAmount);
            expect(await tapv2.balanceOf(addr1.address)).to.equal(transferAmount);

            // addr1 transfers to addr2 (both non-excluded, 1% burn)
            await tapv2.connect(addr1).transfer(addr2.address, transferAmount);

            expect(await tapv2.balanceOf(addr2.address)).to.equal(expectedReceived);
            expect(await tapv2.balanceOf(DEAD_ADDRESS)).to.equal(expectedBurn);
            expect(await tapv2.totalBurned()).to.equal(expectedBurn);
        });

        it("should not burn when sender is excluded", async function () {
            const transferAmount = ethers.parseEther("1000");

            // Owner is excluded, transfer should not burn
            await tapv2.transfer(addr1.address, transferAmount);
            expect(await tapv2.balanceOf(addr1.address)).to.equal(transferAmount);
            expect(await tapv2.totalBurned()).to.equal(0n);
        });

        it("should not burn when receiver is excluded", async function () {
            const transferAmount = ethers.parseEther("1000");

            // Exclude addr2 from burn
            await tapv2.setExcludedFromBurn(addr2.address, true);

            // Transfer from owner to addr1 (owner excluded)
            await tapv2.transfer(addr1.address, transferAmount);

            // Transfer from addr1 to addr2 (addr2 excluded, no burn)
            await tapv2.connect(addr1).transfer(addr2.address, transferAmount);

            expect(await tapv2.balanceOf(addr2.address)).to.equal(transferAmount);
            expect(await tapv2.totalBurned()).to.equal(0n);
        });

        it("should emit BurnOnTransfer event", async function () {
            const transferAmount = ethers.parseEther("1000");
            const expectedBurn = (transferAmount * BURN_RATE) / BASIS_POINTS;

            await tapv2.transfer(addr1.address, transferAmount);

            await expect(tapv2.connect(addr1).transfer(addr2.address, transferAmount))
                .to.emit(tapv2, "BurnOnTransfer")
                .withArgs(addr1.address, addr2.address, expectedBurn);
        });
    });

    describe("Exclusion Management", function () {
        it("should allow owner to exclude addresses", async function () {
            await tapv2.setExcludedFromBurn(addr1.address, true);
            expect(await tapv2.isExcludedFromBurn(addr1.address)).to.be.true;
        });

        it("should allow owner to remove exclusion", async function () {
            await tapv2.setExcludedFromBurn(addr1.address, true);
            await tapv2.setExcludedFromBurn(addr1.address, false);
            expect(await tapv2.isExcludedFromBurn(addr1.address)).to.be.false;
        });

        it("should allow batch exclusion", async function () {
            await tapv2.batchSetExcludedFromBurn(
                [addr1.address, addr2.address],
                [true, true]
            );
            expect(await tapv2.isExcludedFromBurn(addr1.address)).to.be.true;
            expect(await tapv2.isExcludedFromBurn(addr2.address)).to.be.true;
        });

        it("should reject non-owner exclusion changes", async function () {
            await expect(
                tapv2.connect(addr1).setExcludedFromBurn(addr2.address, true)
            ).to.be.revertedWithCustomError(tapv2, "OwnableUnauthorizedAccount");
        });
    });

    describe("Circulating Supply", function () {
        it("should return correct circulating supply after burns", async function () {
            const transferAmount = ethers.parseEther("1000");

            await tapv2.transfer(addr1.address, transferAmount);
            await tapv2.connect(addr1).transfer(addr2.address, transferAmount);

            const burned = await tapv2.totalBurned();
            const circulating = await tapv2.circulatingSupply();

            expect(circulating).to.equal(TOTAL_SUPPLY - burned);
        });
    });

    describe("Manual Burn", function () {
        it("should allow holders to burn their tokens", async function () {
            const burnAmount = ethers.parseEther("100");

            await tapv2.burn(burnAmount);
            expect(await tapv2.balanceOf(owner.address)).to.equal(TOTAL_SUPPLY - burnAmount);
        });
    });
});
