// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AuthorizationManager.sol";

/**
 * @title SecureVault
 * @dev Holds and manages fund transfers with authorization validation
 * Delegates all authorization verification to AuthorizationManager
 */
contract SecureVault {
    // Reference to the AuthorizationManager contract
    AuthorizationManager public authorizationManager;

    // Total balance of the vault (accounting)
    uint256 public totalBalance;

    // Owner of the vault (who deployed it)
    address public owner;

    // Whether initialization has been completed
    bool private initialized;

    /**
     * @dev Emitted when funds are deposited
     * @param depositor Address that deposited funds
     * @param amount Amount deposited
     * @param newBalance Total balance after deposit
     * @param timestamp When the deposit occurred
     */
    event Deposit(
        address indexed depositor,
        uint256 amount,
        uint256 newBalance,
        uint256 timestamp
    );

    /**
     * @dev Emitted when funds are withdrawn
     * @param recipient Address receiving the withdrawal
     * @param amount Amount withdrawn
     * @param authorizationId Authorization ID used for withdrawal
     * @param newBalance Total balance after withdrawal
     * @param timestamp When the withdrawal occurred
     */
    event Withdrawal(
        address indexed recipient,
        uint256 amount,
        bytes32 indexed authorizationId,
        uint256 newBalance,
        uint256 timestamp
    );

    /**
     * @dev Emitted when initialization occurs
     * @param owner Address of the vault owner
     * @param authorizationManagerAddress Address of the AuthorizationManager
     * @param timestamp When initialization occurred
     */
    event VaultInitialized(
        address indexed owner,
        address indexed authorizationManagerAddress,
        uint256 timestamp
    );

    // Prevents execution when vault is not initialized
    modifier onlyInitialized() {
        require(initialized, "SecureVault: not initialized");
        _;
    }

    /**
     * @dev Initialize the vault with an AuthorizationManager
     * Can only be called once
     * @param _authorizationManager Address of the deployed AuthorizationManager contract
     */
    function initialize(address _authorizationManager) external {
        require(!initialized, "SecureVault: already initialized");
        require(_authorizationManager != address(0), "SecureVault: invalid authorization manager address");

        authorizationManager = AuthorizationManager(_authorizationManager);
        owner = msg.sender;
        initialized = true;

        emit VaultInitialized(msg.sender, _authorizationManager, block.timestamp);
    }

    /**
     * @dev Receive function allows deposits of native blockchain currency
     * Called when ETH/other native tokens are sent to this contract
     * Updates accounting and emits deposit event
     */
    receive() external payable onlyInitialized {
        uint256 previousBalance = totalBalance;
        totalBalance += msg.value;

        emit Deposit(msg.sender, msg.value, totalBalance, block.timestamp);
    }

    /**
     * @dev Withdraw funds from the vault
     * Only succeeds when a valid authorization is presented and verified
     *
     * @param recipient Address that will receive the withdrawn funds
     * @param amount Amount to withdraw
     * @param authorizationId Authorization ID for this withdrawal
     * @param nonce Off-chain nonce used in authorization computation
     */
    function withdraw(
        address recipient,
        uint256 amount,
        bytes32 authorizationId,
        uint256 nonce
    ) external onlyInitialized {
        // Validate parameters
        require(recipient != address(0), "SecureVault: invalid recipient");
        require(amount > 0, "SecureVault: amount must be greater than zero");
        require(totalBalance >= amount, "SecureVault: insufficient vault balance");

        // Request authorization verification from AuthorizationManager
        // This function will revert if:
        // 1. Authorization has already been used
        // 2. Authorization parameters don't match the computed ID
        // 3. Authorization manager is not initialized
        bool isAuthorized = authorizationManager.verifyAuthorization(
            address(this),
            recipient,
            amount,
            authorizationId,
            nonce
        );

        require(isAuthorized, "SecureVault: authorization verification failed");

        // Update internal accounting BEFORE transferring funds
        // This prevents reentrancy issues and ensures state consistency
        uint256 previousBalance = totalBalance;
        totalBalance -= amount;

        // Emit withdrawal event for observability
        emit Withdrawal(recipient, amount, authorizationId, totalBalance, block.timestamp);

        // Transfer funds to recipient
        // Using low-level call for flexibility with recipient contracts
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "SecureVault: fund transfer failed");
    }

    /**
     * @dev Get the current vault balance
     * @return uint256 Total balance of the vault
     */
    function getBalance() external view returns (uint256) {
        return totalBalance;
    }

    /**
     * @dev Check if contract is initialized
     * @return bool True if initialized
     */
    function isInitialized() external view returns (bool) {
        return initialized;
    }
}
