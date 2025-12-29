#!/bin/sh

# Entrypoint script for Secure Vault Authorization System deployment
# This script runs inside the Docker container and:
# 1. Compiles smart contracts
# 2. Deploys contracts to the blockchain
# 3. Outputs deployment information

set -e  # Exit on error

echo "=========================================="
echo "Secure Vault Authorization System"
echo "=========================================="

# Check if contracts directory exists
if [ ! -d "contracts" ]; then
    echo "Error: contracts directory not found"
    exit 1
fi

echo ""
echo "Step 1: Compiling smart contracts..."
npx hardhat compile

if [ $? -ne 0 ]; then
    echo "Error: Contract compilation failed"
    exit 1
fi

echo "✓ Contracts compiled successfully"

echo ""
echo "Step 2: Deploying contracts to local blockchain..."
npx hardhat run scripts/deploy.js --network localhost

if [ $? -ne 0 ]; then
    echo "Error: Contract deployment failed"
    exit 1
fi

echo ""
echo "✓ Deployment completed successfully"

echo ""
echo "=========================================="
echo "System Status"
echo "=========================================="
echo "- Smart contracts compiled"
echo "- Contracts deployed to localhost blockchain"
echo "- Deployment information saved to deployments/"
echo "=========================================="

echo ""
echo "Keeping container running..."
# Keep the container running
tail -f /dev/null
