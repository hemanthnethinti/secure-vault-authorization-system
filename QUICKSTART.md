# Quick Start Guide

## TL;DR - Get Running in 2 Commands

### Using Docker (Recommended - No Setup Required)
```bash
docker-compose up
```

This will:
1. Start a local blockchain (Hardhat node) on `localhost:8545`
2. Compile the smart contracts
3. Deploy both contracts
4. Output the contract addresses
5. Keep the system running for testing

### Local Development (Requires Node.js 18+)
```bash
npm install && npm run node
```

In another terminal:
```bash
npm run compile && npm run deploy && npm run test
```

---

## Deployed Contract Addresses

After running `docker-compose up` or `npm run deploy`, find the addresses in:
```
deployments/deployment-31337.json
```

Example output:
```json
{
  "contracts": {
    "AuthorizationManager": {
      "address": "0x5FbDB2315678afccb333f8a9c45c9c02b6a18a24"
    },
    "SecureVault": {
      "address": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
    }
  }
}
```

---

## How to Use

### 1. Deposit Funds
```javascript
const vaultAddress = "0x..."; // From deployment
const depositAmount = ethers.utils.parseEther("10.0");

await signer.sendTransaction({
  to: vaultAddress,
  value: depositAmount
});
```

### 2. Generate Authorization
```javascript
const vaultAddress = "0x...";
const recipientAddress = "0x...";
const withdrawAmount = ethers.utils.parseEther("5.0");
const nonce = 1;

// Get chain ID
const network = await ethers.provider.getNetwork();
const chainId = network.chainId;

// Compute authorization ID
const authorizationId = ethers.utils.keccak256(
  ethers.utils.solidityPacked(
    ["address", "address", "uint256", "uint256", "uint256"],
    [vaultAddress, recipientAddress, withdrawAmount, nonce, chainId]
  )
);
```

### 3. Withdraw with Authorization
```javascript
const vaultABI = require('./artifacts/contracts/SecureVault.sol/SecureVault.json').abi;
const vault = new ethers.Contract(vaultAddress, vaultABI, signer);

await vault.withdraw(
  recipientAddress,
  withdrawAmount,
  authorizationId,
  nonce
);
```

---

## Running Tests

```bash
npm run test
```

Expected output: **50+ tests passing**

For verbose output:
```bash
npm run test:verbose
```

---

## Troubleshooting

### Port 8545 Already in Use
```bash
# Option 1: Use different port
# Edit docker-compose.yml, change "8545:8545" to "9999:8545"

# Option 2: Kill existing process
# Windows:
Get-Process | Where-Object {$_.Port -eq 8545} | Stop-Process -Force

# Linux/Mac:
lsof -i :8545 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Docker Build Fails
```bash
docker-compose down -v
docker system prune
docker-compose up --build
```

### Tests Fail Locally
```bash
npm run clean
npm install
npm run compile
npm run test
```

---

## Architecture

The system is split into 2 secure components:

```
┌─────────────────────────────────────┐
│      AuthorizationManager           │
│  ✓ Validates permissions            │
│  ✓ Tracks authorization usage       │
│  ✓ Prevents replay attacks          │
└─────────────────────────────────────┘
         ▲
         │ verifyAuthorization()
         │
┌────────┴──────────────────────────┐
│      SecureVault                   │
│  ✓ Holds funds                     │
│  ✓ Accepts deposits                │
│  ✓ Delegates authorization         │
│  ✓ Executes withdrawals            │
└────────────────────────────────────┘
```

---

## Key Security Features

✓ **Single-Use Authorizations** - Each auth ID usable exactly once
✓ **Parameter Binding** - Auth bound to vault, network, recipient, amount
✓ **No Vault Verification** - Vault delegates all authorization logic
✓ **State Consistency** - Balance updated BEFORE transfer
✓ **Single Init** - Both contracts initialize once
✓ **Deterministic** - Same inputs = same results

---

## Documentation

See [README.md](README.md) for:
- Complete API documentation
- Detailed flow explanations
- Code examples
- System invariants
- Troubleshooting guide
- Architecture benefits

---

## Example: Complete Flow

```bash
# 1. Start blockchain
docker-compose up &

# 2. Wait for deployment to complete (watch the logs)

# 3. In another terminal, run tests
npm run test

# 4. Check deployment info
cat deployments/deployment-31337.json | jq .contracts
```

---

## Support

All code is extensively documented with comments. Check:
- [contracts/AuthorizationManager.sol](contracts/AuthorizationManager.sol) - Full contract documentation
- [contracts/SecureVault.sol](contracts/SecureVault.sol) - Full contract documentation  
- [tests/system.spec.js](tests/system.spec.js) - 50+ test examples
- [README.md](README.md) - Comprehensive guide
