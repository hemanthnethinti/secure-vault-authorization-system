const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deployment Script for Secure Vault Authorization System
 * 
 * This script:
 * 1. Deploys the AuthorizationManager contract
 * 2. Initializes the AuthorizationManager
 * 3. Deploys the SecureVault contract
 * 4. Initializes the SecureVault with the AuthorizationManager address
 * 5. Outputs deployment information for reference
 */
async function main() {
  console.log("=".repeat(60));
  console.log("Secure Vault Authorization System - Deployment");
  console.log("=".repeat(60));

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log(`\nDeploying contracts with account: ${deployer.address}`);

  // Get network information
  const network = await hre.ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);

  // Step 1: Deploy AuthorizationManager
  console.log("\n--- Step 1: Deploying AuthorizationManager ---");
  const AuthorizationManager = await hre.ethers.getContractFactory("AuthorizationManager");
  const authorizationManager = await AuthorizationManager.deploy();
  await authorizationManager.deployed();
  console.log(`✓ AuthorizationManager deployed to: ${authorizationManager.address}`);

  // Step 2: Initialize AuthorizationManager
  console.log("\n--- Step 2: Initializing AuthorizationManager ---");
  let tx = await authorizationManager.initialize();
  await tx.wait();
  console.log(`✓ AuthorizationManager initialized`);

  // Step 3: Deploy SecureVault
  console.log("\n--- Step 3: Deploying SecureVault ---");
  const SecureVault = await hre.ethers.getContractFactory("SecureVault");
  const vault = await SecureVault.deploy();
  await vault.deployed();
  console.log(`✓ SecureVault deployed to: ${vault.address}`);

  // Step 4: Initialize SecureVault with AuthorizationManager
  console.log("\n--- Step 4: Initializing SecureVault ---");
  tx = await vault.initialize(authorizationManager.address);
  await tx.wait();
  console.log(`✓ SecureVault initialized with AuthorizationManager`);

  // Verify initialization
  console.log("\n--- Verification ---");
  const vaultAuthManager = await vault.authorizationManager();
  console.log(`Vault's AuthorizationManager: ${vaultAuthManager}`);
  const vaultOwner = await vault.owner();
  console.log(`Vault Owner: ${vaultOwner}`);
  const authManagerOwner = await authorizationManager.owner();
  console.log(`AuthorizationManager Owner: ${authManagerOwner}`);

  // Output deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      AuthorizationManager: {
        address: authorizationManager.address,
        owner: authManagerOwner,
      },
      SecureVault: {
        address: vault.address,
        owner: vaultOwner,
        authorizationManager: vaultAuthManager,
      },
    },
  };

  // Save deployment info to file
  const deploymentDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir);
  }

  const deploymentFile = path.join(deploymentDir, `deployment-${network.chainId}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n✓ Deployment information saved to: ${deploymentFile}`);

  // Output summary
  console.log("\n" + "=".repeat(60));
  console.log("Deployment Summary");
  console.log("=".repeat(60));
  console.log(`Network: ${deploymentInfo.network} (Chain ID: ${deploymentInfo.chainId})`);
  console.log(`Deployer: ${deploymentInfo.deployer}`);
  console.log(`\nAuthorizationManager: ${deploymentInfo.contracts.AuthorizationManager.address}`);
  console.log(`SecureVault: ${deploymentInfo.contracts.SecureVault.address}`);
  console.log("=".repeat(60));

  return {
    authorizationManager: authorizationManager.address,
    vault: vault.address,
    deployer: deployer.address,
  };
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
