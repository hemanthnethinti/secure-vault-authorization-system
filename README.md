# Secure Vault Authorization System

A production-grade blockchain vault system that separates fund custody from permission validation across two independent smart contracts. This architecture ensures that fund transfers are only permitted after explicit authorization validation, reflecting real-world decentralized systems where trust boundaries are intentionally split to reduce risk.

## System Overview

The system consists of two core components:

### 1. **AuthorizationManager Contract**
- Validates withdrawal permissions from off-chain authorizations
- Tracks authorization consumption to prevent replay attacks
- Binds permissions to vault instance, network, recipient, and amount
- Each authorization can be used exactly once

### 2. **SecureVault Contract**
- Holds and manages pooled funds
- Accepts deposits from any address
- Delegates all authorization validation to AuthorizationManager
- Only executes withdrawals after successful authorization verification
- Updates internal accounting before transferring value

## Key Security Features

✓ **Single-Use Authorizations**: Each authorization can only be consumed once
✓ **Authorization Binding**: Permissions are bound to specific vault, network, recipient, and amount
✓ **No Signature Verification in Vault**: Vault delegates all permission logic to AuthorizationManager
✓ **State Consistency**: Balance updates occur before fund transfers
✓ **Initialization Protection**: Both contracts can only be initialized once
✓ **Observability**: All operations emit events for transparency and auditing

## Project Structure

```
secure-vault-authorization-system/
├── contracts/
│   ├── AuthorizationManager.sol    # Authorization validation and tracking
│   └── SecureVault.sol             # Vault fund management
├── scripts/
│   └── deploy.js                   # Deployment script for local blockchain
├── tests/
│   └── system.spec.js              # Comprehensive test suite
├── docker/
│   ├── Dockerfile                  # Container configuration
│   └── entrypoint.sh               # Container startup script
├── docker-compose.yml              # Multi-container orchestration
├── hardhat.config.js               # Hardhat configuration
├── package.json                    # Project dependencies
└── README.md                        # This file
```

## Getting Started

### Prerequisites

- Docker & Docker Compose (for containerized deployment)
- Node.js 18+ (for local development)
- npm (Node package manager)

### Option 1: Docker Deployment (Recommended)

The easiest way to run the entire system locally:

```bash
# Start the system
docker-compose up

# The system will:
# 1. Start a local Hardhat blockchain node on port 8545
# 2. Compile smart contracts
# 3. Deploy both contracts to the local blockchain
# 4. Output deployment information
```

After successful deployment, contract addresses will be displayed and saved to `deployments/deployment-31337.json`.

### Option 2: Local Development

For development and testing without Docker:

```bash
# Install dependencies
npm install

# Start local blockchain (in one terminal)
npm run node

# In another terminal, compile contracts
npm run compile

# Deploy contracts to local blockchain
npm run deploy

# Run tests
npm run test
```

## How It Works

### Authorization Flow

1. **Off-Chain Authorization Generation**
   - Parameters are hashed: `keccak256(vaultAddress, recipient, amount, nonce, chainId)`
   - This creates a unique authorization ID that binds permissions to specific context

2. **Deposit Funds**
   - Any address can send native currency to the vault
   - Balance is updated and event is emitted

3. **Withdrawal Request**
   - Caller provides: recipient address, amount, authorization ID, and nonce
   - Vault calls AuthorizationManager to verify authorization

4. **Authorization Verification**
   - AuthorizationManager checks if authorization was previously used
   - Reconstructs the authorization ID from parameters and chain ID
   - If parameters don't match original authorization ID, verification fails
   - Marks authorization as consumed (prevents reuse)
   - Emits AuthorizationConsumed event

5. **Fund Transfer**
   - Vault updates internal balance (BEFORE transfer)
   - Transfers funds to recipient
   - Emits Withdrawal event

### Example: Generating and Using an Authorization

```javascript
// Off-chain (e.g., in a frontend)
const hre = require("hardhat");

// Parameters for authorization
const vaultAddress = "0x..."; // Deployed vault address
const recipient = "0x...";     // Who receives the funds
const amount = ethers.utils.parseEther("1.0");
const nonce = 1;               // Unique identifier

// Get current chain ID
const network = await ethers.provider.getNetwork();
const chainId = network.chainId;

// Compute authorization ID (same as contract logic)
const authorizationId = ethers.utils.keccak256(
  ethers.utils.solidityPacked(
    ["address", "address", "uint256", "uint256", "uint256"],
    [vaultAddress, recipient, amount, nonce, chainId]
  )
);

// On-chain (in contract transaction)
// User calls: vault.withdraw(recipient, amount, authorizationId, nonce)
```

## Smart Contract API

### AuthorizationManager

#### `initialize()`
Initializes the contract (can only be called once). Sets the caller as owner.

#### `verifyAuthorization(vaultAddress, recipient, amount, authorizationId, nonce) → bool`
Verifies an authorization and marks it as consumed.
- **Parameters:**
  - `vaultAddress`: The vault address the authorization is bound to
  - `recipient`: The recipient address the authorization permits
  - `amount`: The amount the authorization permits
  - `authorizationId`: The authorization identifier to verify
  - `nonce`: The nonce used in computing the authorization ID
- **Returns:** `true` if authorization is valid and successfully consumed
- **Reverts if:**
  - Authorization has already been used
  - Authorization parameters don't match the ID
  - Any parameter is invalid

#### `isAuthorizationUsed(authorizationId) → bool`
Returns whether an authorization has been consumed.

#### `computeAuthorizationId(vaultAddress, recipient, amount, nonce) → bytes32`
Utility function to compute authorization ID (for off-chain use).

### SecureVault

#### `initialize(authorizationManagerAddress)`
Initializes the vault with an AuthorizationManager (can only be called once).

#### `receive() external payable`
Accepts deposits of native currency. Emits `Deposit` event.

#### `withdraw(recipient, amount, authorizationId, nonce)`
Withdraws funds if valid authorization is provided.
- **Parameters:**
  - `recipient`: Address that receives the withdrawal
  - `amount`: Amount to withdraw
  - `authorizationId`: Authorization ID for this withdrawal
  - `nonce`: The nonce used in computing the authorization ID
- **Reverts if:**
  - Vault not initialized
  - Insufficient balance
  - Authorization verification fails
  - Invalid parameters

#### `getBalance() → uint256`
Returns the current vault balance.

## Event Emissions

### AuthorizationManager Events

**AuthorizationConsumed(address indexed vaultAddress, address indexed recipient, uint256 amount, bytes32 indexed authorizationId, uint256 timestamp)**
- Emitted when an authorization is successfully consumed

**Initialized(address indexed owner, uint256 timestamp)**
- Emitted when the contract is initialized

### SecureVault Events

**Deposit(address indexed depositor, uint256 amount, uint256 newBalance, uint256 timestamp)**
- Emitted when funds are deposited

**Withdrawal(address indexed recipient, uint256 amount, bytes32 indexed authorizationId, uint256 newBalance, uint256 timestamp)**
- Emitted when funds are successfully withdrawn

**VaultInitialized(address indexed owner, address indexed authorizationManagerAddress, uint256 timestamp)**
- Emitted when the vault is initialized

## Testing

The project includes comprehensive automated tests covering:

- **Initialization**: Single-initialization enforcement for both contracts
- **Deposits**: Balance tracking and event emission
- **Authorization**: Verification, single-use enforcement, parameter binding
- **Withdrawals**: Successful withdrawals, balance updates, event emission
- **Security**: Authorization reuse prevention, parameter validation
- **State Consistency**: Balance integrity, no negative balances
- **Edge Cases**: Large amounts, multiple sequential operations

### Running Tests

```bash
# Run all tests
npm run test

# Run tests with verbose output
npm run test:verbose
```

Expected output: All 50+ test cases should pass.

## Deployment Information

After deployment, check the `deployments/` directory for deployment details:

```json
{
  "network": "localhost",
  "chainId": 31337,
  "deployer": "0x...",
  "timestamp": "2025-12-29T...",
  "contracts": {
    "AuthorizationManager": {
      "address": "0x...",
      "owner": "0x..."
    },
    "SecureVault": {
      "address": "0x...",
      "owner": "0x...",
      "authorizationManager": "0x..."
    }
  }
}
```

## System Invariants

The system maintains the following invariants:

1. **Authorization Uniqueness**: Each authorization ID can only be successfully consumed once
2. **Balance Consistency**: `totalBalance` always equals the actual ETH held by the contract
3. **Parameter Binding**: Authorization is bound to vault, network, recipient, and amount
4. **Single Initialization**: Both contracts can only be initialized once
5. **Deterministic Behavior**: Same inputs always produce the same results
6. **No Negative Balance**: Vault balance never becomes negative

## Common Scenarios

### Scenario 1: Simple Withdrawal

```
1. User deposits 10 ETH to vault
2. Off-chain: Compute authorization ID for (vault, user, 5 ETH, nonce=1)
3. User calls vault.withdraw(user, 5 ETH, authId, nonce=1)
4. Vault calls authorizationManager.verifyAuthorization(...)
5. AuthorizationManager marks authorization as consumed
6. Vault transfers 5 ETH to user
7. Vault balance is now 5 ETH
```

### Scenario 2: Authorization Reuse Prevention

```
1. First withdrawal succeeds (authorization marked as consumed)
2. Attacker attempts same withdrawal with same authorization ID
3. AuthorizationManager detects authorization is already used
4. Transaction reverts - withdrawal fails
5. Vault balance unchanged
```

### Scenario 3: Parameter Mismatch

```
1. Authorization computed for 5 ETH to user1
2. Attacker tries to withdraw 5 ETH to user2 with same authorization ID
3. AuthorizationManager reconstructs ID with new parameters
4. Reconstructed ID doesn't match original authorization ID
5. Transaction reverts - parameters must match
```

## Architecture Benefits

- **Separation of Concerns**: Vault holds funds, AuthorizationManager validates permissions
- **Reduced Attack Surface**: Vault has minimal logic; most security in AuthorizationManager
- **Composability**: Can be extended with additional authorization logic
- **Transparency**: All operations are observable via events
- **Determinism**: System behavior is fully predictable and reproducible

## Troubleshooting

### Docker Build Fails
```bash
# Clean up and rebuild
docker-compose down -v
docker system prune
docker-compose up --build
```

### Port 8545 Already in Use
```bash
# Change the port in docker-compose.yml
# Or kill the process using port 8545
# On Linux/Mac: lsof -i :8545 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Tests Fail Locally
```bash
# Clear Hardhat cache and rebuild
npm run clean
npm run compile
npm run test
```

### Deployment Script Doesn't Output Addresses
```bash
# Check deployment file was created
ls -la deployments/

# Check Docker logs
docker-compose logs deployer
```

## License

MIT

## Support

For issues, questions, or improvements, please refer to the contract code comments and test suite, which document all expected behavior and edge cases.