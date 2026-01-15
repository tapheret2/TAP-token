/**
 * TAP Token Unit Tests
 * 
 * This test suite verifies the TAP ERC-20 token implementation:
 * - Token metadata (name, symbol)
 * - Total supply and initial distribution
 * - Transfer functionality
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TAP Token", function () {
    // Contract instance and test accounts
    let tap;
    let owner;
    let addr1;
    let addr2;

    // Expected values
    const TOKEN_NAME = "TAP";
    const TOKEN_SYMBOL = "TAP";
    const TOTAL_SUPPLY = ethers.parseEther("101902975"); // 101,902,975 * 10^18

    /**
     * Deploy a fresh contract before each test
     */
    beforeEach(async function () {
        // Get test accounts
        [owner, addr1, addr2] = await ethers.getSigners();

        // Deploy TAP token
        const TAP = await ethers.getContractFactory("TAP");
        tap = await TAP.deploy();
        await tap.waitForDeployment();
    });

    /**
     * Test Suite: Token Metadata
     */
    describe("Token Metadata", function () {
        it("should have correct token name", async function () {
            expect(await tap.name()).to.equal(TOKEN_NAME);
        });

        it("should have correct token symbol", async function () {
            expect(await tap.symbol()).to.equal(TOKEN_SYMBOL);
        });

        it("should have 18 decimals", async function () {
            expect(await tap.decimals()).to.equal(18n);
        });
    });

    /**
     * Test Suite: Total Supply
     */
    describe("Total Supply", function () {
        it("should have correct total supply of 101,902,975 tokens", async function () {
            const totalSupply = await tap.totalSupply();
            expect(totalSupply).to.equal(TOTAL_SUPPLY);
        });
    });

    /**
     * Test Suite: Initial Distribution
     */
    describe("Initial Distribution", function () {
        it("should mint 100% of supply to deployer", async function () {
            const ownerBalance = await tap.balanceOf(owner.address);
            const totalSupply = await tap.totalSupply();

            expect(ownerBalance).to.equal(totalSupply);
            expect(ownerBalance).to.equal(TOTAL_SUPPLY);
        });

        it("should have zero balance for non-deployer accounts", async function () {
            expect(await tap.balanceOf(addr1.address)).to.equal(0n);
            expect(await tap.balanceOf(addr2.address)).to.equal(0n);
        });
    });

    /**
     * Test Suite: Token Transfers
     */
    describe("Token Transfers", function () {
        it("should transfer tokens between accounts", async function () {
            const transferAmount = ethers.parseEther("1000");

            // Transfer from owner to addr1
            await tap.transfer(addr1.address, transferAmount);
            expect(await tap.balanceOf(addr1.address)).to.equal(transferAmount);

            // Transfer from addr1 to addr2
            await tap.connect(addr1).transfer(addr2.address, transferAmount);
            expect(await tap.balanceOf(addr2.address)).to.equal(transferAmount);
            expect(await tap.balanceOf(addr1.address)).to.equal(0n);
        });

        it("should update balances correctly after transfer", async function () {
            const transferAmount = ethers.parseEther("50000");
            const initialOwnerBalance = await tap.balanceOf(owner.address);

            await tap.transfer(addr1.address, transferAmount);

            expect(await tap.balanceOf(owner.address)).to.equal(
                initialOwnerBalance - transferAmount
            );
            expect(await tap.balanceOf(addr1.address)).to.equal(transferAmount);
        });

        it("should fail when sender has insufficient balance", async function () {
            const transferAmount = ethers.parseEther("1");

            // addr1 has no tokens, should fail
            await expect(
                tap.connect(addr1).transfer(addr2.address, transferAmount)
            ).to.be.revertedWithCustomError(tap, "ERC20InsufficientBalance");
        });

        it("should emit Transfer event on successful transfer", async function () {
            const transferAmount = ethers.parseEther("100");

            await expect(tap.transfer(addr1.address, transferAmount))
                .to.emit(tap, "Transfer")
                .withArgs(owner.address, addr1.address, transferAmount);
        });
    });

    /**
     * Test Suite: Allowance and TransferFrom
     */
    describe("Allowance and TransferFrom", function () {
        it("should approve and allow transferFrom", async function () {
            const approveAmount = ethers.parseEther("5000");
            const transferAmount = ethers.parseEther("3000");

            // Owner approves addr1 to spend tokens
            await tap.approve(addr1.address, approveAmount);
            expect(await tap.allowance(owner.address, addr1.address)).to.equal(approveAmount);

            // addr1 transfers from owner to addr2
            await tap.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount);

            expect(await tap.balanceOf(addr2.address)).to.equal(transferAmount);
            expect(await tap.allowance(owner.address, addr1.address)).to.equal(
                approveAmount - transferAmount
            );
        });
    });
});
