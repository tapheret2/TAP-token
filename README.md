# TAP Token

A production-ready ERC-20 token built with Solidity, OpenZeppelin, and Hardhat. Designed for educational purposes and DEX deployment on EVM-compatible blockchains.

> ⚠️ **DISCLAIMER**: This project is for educational and development purposes only. This is NOT financial or investment advice. Always do your own research and consult with professionals before engaging in cryptocurrency activities.

## Token Specifications

| Property | Value |
|----------|-------|
| **Name** | TAP |
| **Symbol** | TAP |
| **Decimals** | 18 |
| **Total Supply** | 101,902,975 TAP |
| **Standard** | ERC-20 |
| **Initial Distribution** | 100% to deployer |
| **Post-deployment Minting** | Disabled |

## Deployed Contract

| Network | Contract Address |
|---------|------------------|
| BSC Testnet | `<NOT DEPLOYED YET>` |
| BSC Mainnet | `<NOT DEPLOYED YET>` |

## Project Structure

```
TAP-token/
├── contracts/
│   └── TAP.sol          # ERC-20 token contract
├── scripts/
│   └── deploy.js        # Deployment script
├── test/
│   └── TAP.test.js      # Unit tests
├── hardhat.config.js    # Hardhat configuration
├── .env.example         # Environment template
├── .gitignore           # Git ignore rules
├── package.json         # Dependencies
└── README.md            # This file
```

## Prerequisites

- **Node.js** v18.0.0 or higher - [Download](https://nodejs.org/)
- **npm** v9.0.0 or higher
- **MetaMask** browser extension - [Download](https://metamask.io/)
- Test BNB for deployment - [BSC Testnet Faucet](https://testnet.bnbchain.org/faucet-smart)

## Installation

```bash
# Clone the repository
git clone https://github.com/tapheret2/TAP-token.git
cd TAP-token

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# PRIVATE_KEY=your_private_key_without_0x
# RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
```

## Running Tests

```bash
npm run test
```

Expected output:
```
TAP Token
  Token Metadata
    ✔ should have correct token name
    ✔ should have correct token symbol
    ✔ should have 18 decimals
  Total Supply
    ✔ should have correct total supply of 101,902,975 tokens
  Initial Distribution
    ✔ should mint 100% of supply to deployer
    ✔ should have zero balance for non-deployer accounts
  Token Transfers
    ✔ should transfer tokens between accounts
    ✔ should update balances correctly after transfer
    ✔ should fail when sender has insufficient balance
    ✔ should emit Transfer event on successful transfer
  Allowance and TransferFrom
    ✔ should approve and allow transferFrom
```

## Deployment to Testnet

1. **Fund your wallet** with test BNB from the [BSC Testnet Faucet](https://testnet.bnbchain.org/faucet-smart)

2. **Configure `.env`** with your private key (without 0x prefix)

3. **Deploy**:
   ```bash
   npm run deploy
   ```

4. **Verify on BscScan** (optional):
   ```bash
   npx hardhat verify --network bscTestnet <CONTRACT_ADDRESS>
   ```

## Networks

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| BSC Testnet | 97 | https://data-seed-prebsc-1-s1.binance.org:8545 |
| BSC Mainnet | 56 | https://bsc-dataseed.binance.org |

## Security

- ⚠️ **NEVER** commit your `.env` file or share private keys
- ⚠️ **ALWAYS** test on testnet before mainnet deployment
- ⚠️ **USE** a dedicated deployment wallet with limited funds
- This contract uses audited [OpenZeppelin](https://openzeppelin.com/contracts/) libraries

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
