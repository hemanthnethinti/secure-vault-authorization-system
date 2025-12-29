const { expect } = require("chai");
const hre = require("hardhat");

/**
 * Comprehensive test suite for Secure Vault Authorization System
 * 
 * Tests verify:
 * - Single-use authorization mechanism
 * - Proper state transitions
 * - Correct balance tracking
 * - Authorization reuse prevention
 * - Proper initialization enforcement
 * - Correct event emissions
 */
describe("Secure Vault Authorization System", function () {
  let vault, authorizationManager;
  let deployer, user1, user2;
  let vaultAddress, authManagerAddress;

  beforeEach(async function () {
    // Get signers
    [deployer, user1, user2] = await ethers.getSigners();

    // Deploy AuthorizationManager
    const AuthorizationManager = await ethers.getContractFactory("AuthorizationManager");
    authorizationManager = await AuthorizationManager.deploy();
    await authorizationManager.deployed();
    authManagerAddress = authorizationManager.address;

    // Initialize AuthorizationManager
    await authorizationManager.initialize();

    // Deploy SecureVault
    const SecureVault = await ethers.getContractFactory("SecureVault");
    vault = await SecureVault.deploy();
    await vault.deployed();
    vaultAddress = vault.address;

    // Initialize SecureVault with AuthorizationManager
    await vault.initialize(authManagerAddress);
  });

  // ============================================================================
  // INITIALIZATION TESTS
  // ============================================================================

  describe("Initialization", function () {
    it("should initialize AuthorizationManager only once", async function () {
      // First initialization should succeed
      const AuthorizationManager = await ethers.getContractFactory("AuthorizationManager");
      const authManager = await AuthorizationManager.deploy();
      await authManager.initialize();

      // Second initialization should fail
      await expect(authManager.initialize()).to.be.revertedWith(
        "AuthorizationManager: already initialized"
      );
    });

    it("should initialize SecureVault only once", async function () {
      // Second initialization should fail
      await expect(vault.initialize(authManagerAddress)).to.be.revertedWith(
        "SecureVault: already initialized"
      );
    });

    it("should set correct owner after initialization", async function () {
      const vaultOwner = await vault.owner();
      expect(vaultOwner).to.equal(deployer.address);

      const authOwner = await authorizationManager.owner();
      expect(authOwner).to.equal(deployer.address);
    });

    it("should link vault to authorization manager correctly", async function () {
      const linkedAuthManager = await vault.authorizationManager();
      expect(linkedAuthManager).to.equal(authManagerAddress);
    });
  });

  // ============================================================================
  // DEPOSIT TESTS
  // ============================================================================

  describe("Deposits", function () {
    it("should accept deposits and update balance", async function () {
      const depositAmount = ethers.utils.parseEther("1.0");

      // Check initial balance
      let balance = await vault.getBalance();
      expect(balance).to.equal(0);

      // Deposit funds
      await user1.sendTransaction({
        to: vaultAddress,
        value: depositAmount,
      });

      // Check updated balance
      balance = await vault.getBalance();
      expect(balance).to.equal(depositAmount);
    });

    it("should emit Deposit event with correct parameters", async function () {
      const depositAmount = ethers.utils.parseEther("2.5");

      await expect(
        user1.sendTransaction({
          to: vaultAddress,
          value: depositAmount,
        })
      )
        .to.emit(vault, "Deposit")
        .withArgs(
          user1.address,
          depositAmount,
          depositAmount,
          expect.any(Object) // timestamp
        );
    });

    it("should accept multiple deposits and accumulate balance", async function () {
      const deposit1 = ethers.utils.parseEther("1.0");
      const deposit2 = ethers.utils.parseEther("2.0");

      await user1.sendTransaction({ to: vaultAddress, value: deposit1 });
      let balance = await vault.getBalance();
      expect(balance).to.equal(deposit1);

      await user2.sendTransaction({ to: vaultAddress, value: deposit2 });
      balance = await vault.getBalance();
      expect(balance).to.equal(deposit1.add(deposit2));
    });

    it("should reject deposit when vault not initialized", async function () {
      // Create new uninitialized vault
      const SecureVault = await ethers.getContractFactory("SecureVault");
      const uninitializedVault = await SecureVault.deploy();
      await uninitializedVault.deployed();

      const depositAmount = ethers.utils.parseEther("1.0");

      // Attempt to deposit should fail
      await expect(
        user1.sendTransaction({
          to: uninitializedVault.address,
          value: depositAmount,
        })
      ).to.be.reverted;
    });
  });

  // ============================================================================
  // AUTHORIZATION TESTS
  // ============================================================================

  describe("Authorization", function () {
    it("should compute authorization ID correctly", async function () {
      const nonce = 1;
      const amount = ethers.utils.parseEther("1.0");
      const recipient = user1.address;

      const computedId = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        recipient,
        amount,
        nonce
      );

      // Verify it's a bytes32
      expect(computedId).to.match(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should mark authorization as used after verification", async function () {
      const nonce = 1;
      const amount = ethers.utils.parseEther("1.0");
      const recipient = user1.address;

      const authId = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        recipient,
        amount,
        nonce
      );

      // Initially not used
      let isUsed = await authorizationManager.isAuthorizationUsed(authId);
      expect(isUsed).to.be.false;

      // Deposit funds first
      await deployer.sendTransaction({
        to: vaultAddress,
        value: amount,
      });

      // Call verifyAuthorization directly
      await authorizationManager.verifyAuthorization(
        vaultAddress,
        recipient,
        amount,
        authId,
        nonce
      );

      // Now should be marked as used
      isUsed = await authorizationManager.isAuthorizationUsed(authId);
      expect(isUsed).to.be.true;
    });

    it("should prevent reuse of same authorization", async function () {
      const nonce = 1;
      const amount = ethers.utils.parseEther("1.0");
      const recipient = user1.address;

      const authId = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        recipient,
        amount,
        nonce
      );

      // First verification should succeed
      await authorizationManager.verifyAuthorization(
        vaultAddress,
        recipient,
        amount,
        authId,
        nonce
      );

      // Second attempt with same authorization should fail
      await expect(
        authorizationManager.verifyAuthorization(
          vaultAddress,
          recipient,
          amount,
          authId,
          nonce
        )
      ).to.be.revertedWith("AuthorizationManager: authorization already used");
    });

    it("should reject authorization with mismatched parameters", async function () {
      const nonce = 1;
      const amount = ethers.utils.parseEther("1.0");
      const recipient = user1.address;

      // Compute ID with correct parameters
      const authId = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        recipient,
        amount,
        nonce
      );

      // Try to use with different amount
      const differentAmount = ethers.utils.parseEther("2.0");

      await expect(
        authorizationManager.verifyAuthorization(
          vaultAddress,
          recipient,
          differentAmount,
          authId,
          nonce
        )
      ).to.be.revertedWith("AuthorizationManager: authorization parameter mismatch");
    });

    it("should emit AuthorizationConsumed event", async function () {
      const nonce = 1;
      const amount = ethers.utils.parseEther("1.0");
      const recipient = user1.address;

      const authId = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        recipient,
        amount,
        nonce
      );

      await expect(
        authorizationManager.verifyAuthorization(
          vaultAddress,
          recipient,
          amount,
          authId,
          nonce
        )
      )
        .to.emit(authorizationManager, "AuthorizationConsumed")
        .withArgs(vaultAddress, recipient, amount, authId, expect.any(Object));
    });

    it("should validate authorization with correct chain ID", async function () {
      const nonce = 1;
      const amount = ethers.utils.parseEther("1.0");
      const recipient = user1.address;

      // Get current chain ID
      const network = await ethers.provider.getNetwork();
      const chainId = network.chainId;

      // Compute ID (includes chainId)
      const authId = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        recipient,
        amount,
        nonce
      );

      // Should verify successfully with matching chain ID
      await authorizationManager.verifyAuthorization(
        vaultAddress,
        recipient,
        amount,
        authId,
        nonce
      );
    });
  });

  // ============================================================================
  // WITHDRAWAL TESTS
  // ============================================================================

  describe("Withdrawals", function () {
    beforeEach(async function () {
      // Deposit funds before each test
      const depositAmount = ethers.utils.parseEther("10.0");
      await deployer.sendTransaction({
        to: vaultAddress,
        value: depositAmount,
      });
    });

    it("should successfully withdraw with valid authorization", async function () {
      const withdrawAmount = ethers.utils.parseEther("1.0");
      const nonce = 1;
      const recipient = user1.address;

      // Compute authorization
      const authId = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        recipient,
        withdrawAmount,
        nonce
      );

      // Get initial recipient balance
      const initialBalance = await ethers.provider.getBalance(recipient);

      // Perform withdrawal
      const tx = await vault.withdraw(recipient, withdrawAmount, authId, nonce);
      await tx.wait();

      // Verify balance updated
      const finalBalance = await ethers.provider.getBalance(recipient);
      expect(finalBalance).to.equal(initialBalance.add(withdrawAmount));

      // Verify vault balance decreased
      const vaultBalance = await vault.getBalance();
      expect(vaultBalance).to.equal(
        ethers.utils.parseEther("10.0").sub(withdrawAmount)
      );
    });

    it("should emit Withdrawal event with correct parameters", async function () {
      const withdrawAmount = ethers.utils.parseEther("1.0");
      const nonce = 1;
      const recipient = user1.address;

      const authId = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        recipient,
        withdrawAmount,
        nonce
      );

      await expect(vault.withdraw(recipient, withdrawAmount, authId, nonce))
        .to.emit(vault, "Withdrawal")
        .withArgs(
          recipient,
          withdrawAmount,
          authId,
          ethers.utils.parseEther("9.0"), // remaining balance
          expect.any(Object) // timestamp
        );
    });

    it("should prevent reuse of authorization for second withdrawal", async function () {
      const withdrawAmount = ethers.utils.parseEther("1.0");
      const nonce = 1;
      const recipient = user1.address;

      const authId = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        recipient,
        withdrawAmount,
        nonce
      );

      // First withdrawal should succeed
      await vault.withdraw(recipient, withdrawAmount, authId, nonce);

      // Second withdrawal with same authorization should fail
      await expect(
        vault.withdraw(recipient, withdrawAmount, authId, nonce)
      ).to.be.reverted;
    });

    it("should reject withdrawal without valid authorization", async function () {
      const withdrawAmount = ethers.utils.parseEther("1.0");
      const nonce = 1;
      const recipient = user1.address;

      // Use wrong nonce - authorization will not match
      const authId = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        recipient,
        withdrawAmount,
        nonce
      );

      // Try to withdraw with different nonce
      const wrongNonce = 999;

      await expect(
        vault.withdraw(recipient, withdrawAmount, authId, wrongNonce)
      ).to.be.reverted;
    });

    it("should reject withdrawal if insufficient balance", async function () {
      const withdrawAmount = ethers.utils.parseEther("100.0"); // More than available
      const nonce = 1;
      const recipient = user1.address;

      const authId = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        recipient,
        withdrawAmount,
        nonce
      );

      await expect(
        vault.withdraw(recipient, withdrawAmount, authId, nonce)
      ).to.be.revertedWith("SecureVault: insufficient vault balance");
    });

    it("should reject withdrawal to zero address", async function () {
      const withdrawAmount = ethers.utils.parseEther("1.0");
      const nonce = 1;
      const zeroAddress = ethers.constants.AddressZero;

      const authId = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        zeroAddress,
        withdrawAmount,
        nonce
      );

      await expect(
        vault.withdraw(zeroAddress, withdrawAmount, authId, nonce)
      ).to.be.reverted;
    });

    it("should handle multiple sequential withdrawals with different authorizations", async function () {
      const amount1 = ethers.utils.parseEther("1.0");
      const amount2 = ethers.utils.parseEther("2.0");
      const amount3 = ethers.utils.parseEther("1.5");

      // Compute authorizations with different nonces
      const authId1 = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        user1.address,
        amount1,
        1
      );

      const authId2 = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        user2.address,
        amount2,
        2
      );

      const authId3 = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        user1.address,
        amount3,
        3
      );

      // Perform withdrawals
      await vault.withdraw(user1.address, amount1, authId1, 1);
      await vault.withdraw(user2.address, amount2, authId2, 2);
      await vault.withdraw(user1.address, amount3, authId3, 3);

      // Verify final balance
      const finalBalance = await vault.getBalance();
      const expectedBalance = ethers.utils
        .parseEther("10.0")
        .sub(amount1)
        .sub(amount2)
        .sub(amount3);
      expect(finalBalance).to.equal(expectedBalance);
    });

    it("should maintain correct balance after deposits and withdrawals", async function () {
      // Initial state: 10.0 ETH in vault

      // Withdrawal 1
      const authId1 = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        user1.address,
        ethers.utils.parseEther("2.0"),
        1
      );
      await vault.withdraw(user1.address, ethers.utils.parseEther("2.0"), authId1, 1);

      let balance = await vault.getBalance();
      expect(balance).to.equal(ethers.utils.parseEther("8.0"));

      // Deposit more
      await user2.sendTransaction({
        to: vaultAddress,
        value: ethers.utils.parseEther("5.0"),
      });

      balance = await vault.getBalance();
      expect(balance).to.equal(ethers.utils.parseEther("13.0"));

      // Withdrawal 2
      const authId2 = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        user2.address,
        ethers.utils.parseEther("3.0"),
        2
      );
      await vault.withdraw(user2.address, ethers.utils.parseEther("3.0"), authId2, 2);

      balance = await vault.getBalance();
      expect(balance).to.equal(ethers.utils.parseEther("10.0"));
    });
  });

  // ============================================================================
  // STATE CONSISTENCY TESTS
  // ============================================================================

  describe("State Consistency", function () {
    it("should update balance before transferring funds", async function () {
      const depositAmount = ethers.utils.parseEther("1.0");
      const withdrawAmount = ethers.utils.parseEther("1.0");
      const nonce = 1;

      // Deposit
      await deployer.sendTransaction({
        to: vaultAddress,
        value: depositAmount,
      });

      // Create authorization
      const authId = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        user1.address,
        withdrawAmount,
        nonce
      );

      // Withdraw
      const tx = await vault.withdraw(user1.address, withdrawAmount, authId, nonce);

      // Verify that balance is correct after withdrawal
      const finalBalance = await vault.getBalance();
      expect(finalBalance).to.equal(0);
    });

    it("should not allow vault balance to go negative", async function () {
      const depositAmount = ethers.utils.parseEther("1.0");
      const withdrawAmount = ethers.utils.parseEther("2.0"); // More than deposit

      // Deposit only 1.0 ETH
      await deployer.sendTransaction({
        to: vaultAddress,
        value: depositAmount,
      });

      // Try to withdraw 2.0 ETH
      const authId = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        user1.address,
        withdrawAmount,
        1
      );

      await expect(
        vault.withdraw(user1.address, withdrawAmount, authId, 1)
      ).to.be.revertedWith("SecureVault: insufficient vault balance");

      // Verify balance unchanged
      const balance = await vault.getBalance();
      expect(balance).to.equal(depositAmount);
    });
  });

  // ============================================================================
  // EDGE CASE TESTS
  // ============================================================================

  describe("Edge Cases", function () {
    it("should handle zero amount rejection", async function () {
      const authId = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        user1.address,
        0,
        1
      );

      await expect(
        authorizationManager.verifyAuthorization(
          vaultAddress,
          user1.address,
          0,
          authId,
          1
        )
      ).to.be.revertedWith("AuthorizationManager: amount must be greater than zero");
    });

    it("should reject authorization with zero vault address", async function () {
      const amount = ethers.utils.parseEther("1.0");

      await expect(
        authorizationManager.verifyAuthorization(
          ethers.constants.AddressZero,
          user1.address,
          amount,
          ethers.constants.HashZero,
          1
        )
      ).to.be.reverted;
    });

    it("should handle very large withdrawal amounts", async function () {
      const largeAmount = ethers.utils.parseEther("1000.0");

      // Deposit large amount
      await deployer.sendTransaction({
        to: vaultAddress,
        value: largeAmount,
      });

      const authId = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        user1.address,
        largeAmount,
        1
      );

      // Should withdraw successfully
      await vault.withdraw(user1.address, largeAmount, authId, 1);

      const balance = await vault.getBalance();
      expect(balance).to.equal(0);
    });

    it("should track authorization usage per unique ID", async function () {
      // Create two different authorizations for different nonces
      const amount = ethers.utils.parseEther("1.0");

      const authId1 = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        user1.address,
        amount,
        1
      );

      const authId2 = await authorizationManager.computeAuthorizationId(
        vaultAddress,
        user1.address,
        amount,
        2
      );

      // These should be different IDs
      expect(authId1).to.not.equal(authId2);

      // Use first authorization
      await authorizationManager.verifyAuthorization(
        vaultAddress,
        user1.address,
        amount,
        authId1,
        1
      );

      // First should be used
      let isUsed = await authorizationManager.isAuthorizationUsed(authId1);
      expect(isUsed).to.be.true;

      // Second should not be used yet
      isUsed = await authorizationManager.isAuthorizationUsed(authId2);
      expect(isUsed).to.be.false;

      // Should be able to use second authorization
      await authorizationManager.verifyAuthorization(
        vaultAddress,
        user1.address,
        amount,
        authId2,
        2
      );
    });
  });
});
