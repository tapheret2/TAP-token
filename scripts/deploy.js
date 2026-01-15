/**
 * TAP Token Deployment Script
 * 
 * This script deploys the TAP ERC-20 token to the configured network.
 * It validates environment variables before deployment to prevent accidents.
 * 
 * Usage:
 *   npm run deploy          - Deploy to BSC Testnet
 *   npm run deploy:local    - Deploy to local Hardhat network
 */

const hre = require("hardhat");

async function main() {
    console.log("=".repeat(60));
    console.log("TAP Token Deployment Script");
    console.log("=".repeat(60));

    // Validate environment variables for non-local networks
    const networkName = hre.network.name;
    console.log(`\nNetwork: ${networkName}`);

    if (networkName !== "hardhat" && networkName !== "localhost") {
        // Check for required environment variables
        if (!process.env.RPC_URL) {
            console.error("\n❌ ERROR: RPC_URL environment variable is not set!");
            console.error("Please copy .env.example to .env and configure it.");
            process.exit(1);
        }

        if (!process.env.PRIVATE_KEY) {
            console.error("\n❌ ERROR: PRIVATE_KEY environment variable is not set!");
            console.error("Please copy .env.example to .env and configure it.");
            process.exit(1);
        }

        // Validate private key format (basic check)
        if (process.env.PRIVATE_KEY.length !== 64) {
            console.error("\n❌ ERROR: PRIVATE_KEY appears to be invalid!");
            console.error("Private key should be 64 hex characters (without 0x prefix).");
            process.exit(1);
        }
    }

    // Get deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer address: ${deployer.address}`);

    // Check deployer balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    const balanceInEth = hre.ethers.formatEther(balance);
    console.log(`Deployer balance: ${balanceInEth} BNB`);

    if (balance === 0n) {
        console.error("\n❌ ERROR: Deployer account has no BNB for gas!");
        console.error("Please fund your wallet before deploying.");
        process.exit(1);
    }

    // Deploy TAP token
    console.log("\nDeploying TAP token...");

    const TAP = await hre.ethers.getContractFactory("TAP");
    const tap = await TAP.deploy();

    await tap.waitForDeployment();

    const contractAddress = await tap.getAddress();

    console.log("\n" + "=".repeat(60));
    console.log("✅ TAP Token deployed successfully!");
    console.log("=".repeat(60));
    console.log(`Contract Address: ${contractAddress}`);
    console.log(`Transaction Hash: ${tap.deploymentTransaction().hash}`);
    console.log("=".repeat(60));

    // Verify deployment
    const totalSupply = await tap.totalSupply();
    const deployerBalance = await tap.balanceOf(deployer.address);

    console.log("\nDeployment Verification:");
    console.log(`- Token Name: ${await tap.name()}`);
    console.log(`- Token Symbol: ${await tap.symbol()}`);
    console.log(`- Total Supply: ${hre.ethers.formatEther(totalSupply)} TAP`);
    console.log(`- Deployer Balance: ${hre.ethers.formatEther(deployerBalance)} TAP`);

    // Instructions for contract verification
    console.log("\n" + "=".repeat(60));
    console.log("Next Steps:");
    console.log("=".repeat(60));
    console.log("1. Verify your contract on BscScan:");
    console.log(`   npx hardhat verify --network ${networkName} ${contractAddress}`);
    console.log("\n2. Add TAP token to MetaMask:");
    console.log(`   - Token Contract Address: ${contractAddress}`);
    console.log("   - Token Symbol: TAP");
    console.log("   - Token Decimals: 18");
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed!");
        console.error(error);
        process.exit(1);
    });
