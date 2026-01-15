# TAP Token

A production-ready ERC-20 token with advanced DeFi features built with Solidity, OpenZeppelin, and Hardhat.

> ⚠️ **DISCLAIMER**: This project is for educational and development purposes only. This is NOT financial or investment advice.

## Token Specifications

| Property | Value |
|----------|-------|
| **Name** | TAP |
| **Symbol** | TAP |
| **Decimals** | 18 |
| **Total Supply** | 101,902,975 TAP |
| **Standard** | ERC-20 |

## Features

| Feature | Description |
|---------|-------------|
| 🔥 **Burn on Transfer** | 1% auto-burn on every transfer (deflationary) |
| 🔒 **Vesting** | Lock tokens with cliff and linear release |
| 💰 **Staking** | Stake TAP to earn 10% APY rewards |

## Contracts

| Contract | Description |
|----------|-------------|
| `TAP.sol` | Basic ERC-20 token |
| `TAPv2.sol` | ERC-20 with 1% burn-on-transfer |
| `Vesting.sol` | Token vesting with cliff period |
| `Staking.sol` | Stake tokens to earn rewards |

## Project Structure

```
TAP-token/
├── contracts/
│   ├── TAP.sol          # Basic ERC-20
│   ├── TAPv2.sol        # ERC-20 + burn
│   ├── Vesting.sol      # Token vesting
│   └── Staking.sol      # Staking rewards
├── scripts/
│   └── deploy.js
├── test/
│   ├── TAP.test.js
│   ├── TAPv2.test.js
│   ├── Vesting.test.js
│   └── Staking.test.js
├── hardhat.config.js
├── .env.example
└── README.md
```

## Installation

```bash
git clone https://github.com/tapheret2/TAP-token.git
cd TAP-token
npm install
cp .env.example .env
# Edit .env with your PRIVATE_KEY
```

## Testing

```bash
npm run test
```

**54 tests** covering all contracts and features.

## Deployment

```bash
# Deploy to BSC Testnet
npm run deploy

# Verify on BscScan
npx hardhat verify --network bscTestnet <CONTRACT_ADDRESS>
```

## Security

- ⚠️ **NEVER** commit `.env` or share private keys
- ⚠️ **ALWAYS** test on testnet first
- Uses audited [OpenZeppelin](https://openzeppelin.com/contracts/) libraries

## License

MIT
