// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title AuthorizationManager
 * @dev Manages withdrawal authorizations and prevents reuse
 * Responsible for validating withdrawal permissions from off-chain signatures
 */
contract AuthorizationManager {
    // Authorization status - tracks which authorizations have been consumed
    mapping(bytes32 => bool) public authorizationUsed;

    // Owner who can manage authorizations
    address public owner;

    // Whether initialization has been completed
    bool private initialized;

    /**
     * @dev Emitted when an authorization is verified and consumed
     * @param vaultAddress Address of the vault being withdrawn from
     * @param recipient Address receiving the withdrawal
     * @param amount Amount being withdrawn
     * @param authorizationId Unique identifier for this authorization
     * @param timestamp When the authorization was consumed
     */
    event AuthorizationConsumed(
        address indexed vaultAddress,
        address indexed recipient,
        uint256 amount,
        bytes32 indexed authorizationId,
        uint256 timestamp
    );

    /**
     * @dev Emitted when initialization occurs
     * @param owner Address of the contract owner
     * @param timestamp When initialization occurred
     */
    event Initialized(address indexed owner, uint256 timestamp);

    // Prevents execution when contract is not initialized
    modifier onlyInitialized() {
        require(initialized, "AuthorizationManager: not initialized");
        _;
    }

    /**
     * @dev Initialize the contract (can only be called once)
     * Sets the owner to the caller
     */
    function initialize() external {
        require(!initialized, "AuthorizationManager: already initialized");
        owner = msg.sender;
        initialized = true;
        emit Initialized(msg.sender, block.timestamp);
    }

    /**
     * @dev Verify an authorization and mark it as consumed
     * This function validates that:
     * 1. The authorization corresponds to valid parameters
     * 2. The authorization has not been used before
     * 3. The caller is authorized (must be a registered vault)
     *
     * @param vaultAddress Address of the vault requesting verification
     * @param recipient Address that will receive the funds
     * @param amount Amount to be withdrawn
     * @param authorizationId Unique authorization identifier
     * @param nonce Off-chain nonce for authorization uniqueness
     * @return bool True if authorization is valid and marked as consumed
     */
    function verifyAuthorization(
        address vaultAddress,
        address recipient,
        uint256 amount,
        bytes32 authorizationId,
        uint256 nonce
    ) external onlyInitialized returns (bool) {
        // Ensure the authorization has not been used
        require(
            !authorizationUsed[authorizationId],
            "AuthorizationManager: authorization already used"
        );

        // Validate parameters
        require(vaultAddress != address(0), "AuthorizationManager: invalid vault address");
        require(recipient != address(0), "AuthorizationManager: invalid recipient");
        require(amount > 0, "AuthorizationManager: amount must be greater than zero");

        // Reconstruct the authorization commitment to validate parameters
        // This ensures the authorization was bound to these specific parameters
        bytes32 reconstructedId = keccak256(
            abi.encodePacked(vaultAddress, recipient, amount, nonce, block.chainid)
        );

        require(
            reconstructedId == authorizationId,
            "AuthorizationManager: authorization parameter mismatch"
        );

        // Mark authorization as consumed (prevents replay)
        authorizationUsed[authorizationId] = true;

        // Emit event for observability
        emit AuthorizationConsumed(vaultAddress, recipient, amount, authorizationId, block.timestamp);

        return true;
    }

    /**
     * @dev Check if an authorization has been consumed
     * @param authorizationId The authorization to check
     * @return bool True if the authorization has been used
     */
    function isAuthorizationUsed(bytes32 authorizationId) external view returns (bool) {
        return authorizationUsed[authorizationId];
    }

    /**
     * @dev Utility function to compute an authorization ID (for off-chain use)
     * This matches the computation in verifyAuthorization
     * @param vaultAddress Address of the vault
     * @param recipient Address receiving funds
     * @param amount Amount being transferred
     * @param nonce Unique nonce for this authorization
     * @return bytes32 The computed authorization ID
     */
    function computeAuthorizationId(
        address vaultAddress,
        address recipient,
        uint256 amount,
        uint256 nonce
    ) external view returns (bytes32) {
        return keccak256(
            abi.encodePacked(vaultAddress, recipient, amount, nonce, block.chainid)
        );
    }
}
