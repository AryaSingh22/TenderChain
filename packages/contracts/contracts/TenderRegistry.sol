// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TenderRegistry
 * @notice Master registry managing the lifecycle of every tender on the TenderChain platform.
 * @dev Uses OpenZeppelin AccessControl for role-based permissions.
 *      Tender lifecycle: DRAFT → PUBLISHED → CLOSED → EVALUATION → AWARDED | CANCELLED
 */
contract TenderRegistry is AccessControl, ReentrancyGuard {
    // ──────────────────────────── Roles ────────────────────────────
    bytes32 public constant AUTHORITY_ROLE = keccak256("AUTHORITY_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ──────────────────────────── Enums ────────────────────────────
    enum TenderStatus {
        DRAFT,
        PUBLISHED,
        CLOSED,
        EVALUATION,
        AWARDED,
        CANCELLED
    }

    // ──────────────────────────── Structs ──────────────────────────
    struct Tender {
        uint256 tenderId;
        string ipfsDocumentHash;
        address procurementAuthority;
        uint256 submissionDeadline;
        uint256 revealDeadline;
        TenderStatus status;
        string eligibilityCriteriaHash;
        uint256 minimumBidAmount;
        uint256 estimatedProjectValue;
        address awardedTo;
        string cancellationReason;
    }

    // ──────────────────────────── State ────────────────────────────
    mapping(uint256 => Tender) public tenders;
    uint256 public tenderCount;
    address public governanceContract;

    // ──────────────────────────── Events ───────────────────────────
    event TenderCreated(
        uint256 indexed tenderId,
        address indexed authority,
        string ipfsHash,
        uint256 submissionDeadline,
        uint256 revealDeadline
    );
    event TenderPublished(uint256 indexed tenderId);
    event TenderClosed(uint256 indexed tenderId);
    event TenderMovedToEvaluation(uint256 indexed tenderId);
    event TenderAwarded(uint256 indexed tenderId, address indexed winner);
    event TenderCancelled(uint256 indexed tenderId, string reason);

    // ──────────────────────────── Errors ───────────────────────────
    error TenderNotFound(uint256 tenderId);
    error InvalidStatus(uint256 tenderId, TenderStatus current, TenderStatus expected);
    error DeadlineNotPassed(uint256 tenderId, uint256 deadline);
    error DeadlineAlreadyPassed(uint256 tenderId, uint256 deadline);
    error InvalidDeadlines(uint256 submission, uint256 reveal);
    error InvalidMinimumBid();
    error ZeroAddress();

    // ──────────────────────────── Constructor ──────────────────────
    constructor(address _admin) {
        if (_admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(AUTHORITY_ROLE, _admin);
    }

    // ──────────────────────────── Modifiers ────────────────────────
    modifier tenderExists(uint256 _tenderId) {
        if (_tenderId == 0 || _tenderId > tenderCount) revert TenderNotFound(_tenderId);
        _;
    }

    modifier inStatus(uint256 _tenderId, TenderStatus _expected) {
        if (tenders[_tenderId].status != _expected)
            revert InvalidStatus(_tenderId, tenders[_tenderId].status, _expected);
        _;
    }

    // ──────────────────────────── Functions ────────────────────────

    /**
     * @notice Creates a new tender in DRAFT status.
     * @param _ipfsDocumentHash IPFS hash of the full tender document
     * @param _submissionDeadline Unix timestamp for bid submission deadline
     * @param _revealDeadline Unix timestamp for bid reveal deadline
     * @param _eligibilityCriteriaHash IPFS hash of eligibility criteria
     * @param _minimumBidAmount Minimum bid amount in wei
     * @param _estimatedProjectValue Estimated project value in wei
     */
    function createTender(
        string calldata _ipfsDocumentHash,
        uint256 _submissionDeadline,
        uint256 _revealDeadline,
        string calldata _eligibilityCriteriaHash,
        uint256 _minimumBidAmount,
        uint256 _estimatedProjectValue
    ) external onlyRole(AUTHORITY_ROLE) returns (uint256) {
        if (_submissionDeadline <= block.timestamp) revert InvalidDeadlines(_submissionDeadline, _revealDeadline);
        if (_revealDeadline <= _submissionDeadline) revert InvalidDeadlines(_submissionDeadline, _revealDeadline);

        tenderCount++;
        uint256 newId = tenderCount;

        tenders[newId] = Tender({
            tenderId: newId,
            ipfsDocumentHash: _ipfsDocumentHash,
            procurementAuthority: msg.sender,
            submissionDeadline: _submissionDeadline,
            revealDeadline: _revealDeadline,
            status: TenderStatus.DRAFT,
            eligibilityCriteriaHash: _eligibilityCriteriaHash,
            minimumBidAmount: _minimumBidAmount,
            estimatedProjectValue: _estimatedProjectValue,
            awardedTo: address(0),
            cancellationReason: ""
        });

        emit TenderCreated(newId, msg.sender, _ipfsDocumentHash, _submissionDeadline, _revealDeadline);
        return newId;
    }

    /**
     * @notice Publishes a DRAFT tender, making it visible to contractors.
     * @param _tenderId ID of the tender to publish
     */
    function publishTender(uint256 _tenderId)
        external
        tenderExists(_tenderId)
        inStatus(_tenderId, TenderStatus.DRAFT)
        onlyRole(AUTHORITY_ROLE)
    {
        tenders[_tenderId].status = TenderStatus.PUBLISHED;
        emit TenderPublished(_tenderId);
    }

    /**
     * @notice Closes a tender after submission deadline passes.
     * @param _tenderId ID of the tender to close
     */
    function closeTender(uint256 _tenderId)
        external
        tenderExists(_tenderId)
        inStatus(_tenderId, TenderStatus.PUBLISHED)
        onlyRole(AUTHORITY_ROLE)
    {
        if (block.timestamp < tenders[_tenderId].submissionDeadline)
            revert DeadlineNotPassed(_tenderId, tenders[_tenderId].submissionDeadline);

        tenders[_tenderId].status = TenderStatus.CLOSED;
        emit TenderClosed(_tenderId);
    }

    /**
     * @notice Moves a closed tender to evaluation phase.
     * @param _tenderId ID of the tender
     */
    function startEvaluation(uint256 _tenderId)
        external
        tenderExists(_tenderId)
        inStatus(_tenderId, TenderStatus.CLOSED)
        onlyRole(AUTHORITY_ROLE)
    {
        tenders[_tenderId].status = TenderStatus.EVALUATION;
        emit TenderMovedToEvaluation(_tenderId);
    }

    /**
     * @notice Awards a tender to the winning contractor.
     * @param _tenderId ID of the tender
     * @param _winner Address of the winning contractor
     */
    function awardTender(uint256 _tenderId, address _winner)
        external
        tenderExists(_tenderId)
        inStatus(_tenderId, TenderStatus.EVALUATION)
        onlyRole(AUTHORITY_ROLE)
    {
        if (_winner == address(0)) revert ZeroAddress();

        tenders[_tenderId].status = TenderStatus.AWARDED;
        tenders[_tenderId].awardedTo = _winner;
        emit TenderAwarded(_tenderId, _winner);
    }

    /**
     * @notice Cancels a tender with a recorded reason.
     * @param _tenderId ID of the tender to cancel
     * @param _reason Immutable cancellation reason
     */
    function cancelTender(uint256 _tenderId, string calldata _reason)
        external
        tenderExists(_tenderId)
        onlyRole(AUTHORITY_ROLE)
    {
        TenderStatus current = tenders[_tenderId].status;
        require(
            current != TenderStatus.AWARDED && current != TenderStatus.CANCELLED,
            "Cannot cancel awarded or already cancelled tender"
        );

        tenders[_tenderId].status = TenderStatus.CANCELLED;
        tenders[_tenderId].cancellationReason = _reason;
        emit TenderCancelled(_tenderId, _reason);
    }

    /**
     * @notice Returns full tender data.
     * @param _tenderId ID of the tender
     */
    function getTender(uint256 _tenderId)
        external
        view
        tenderExists(_tenderId)
        returns (Tender memory)
    {
        return tenders[_tenderId];
    }

    /**
     * @notice Sets the governance contract address (admin only).
     * @param _governance Address of the GovernanceController contract
     */
    function setGovernanceContract(address _governance)
        external
        onlyRole(ADMIN_ROLE)
    {
        if (_governance == address(0)) revert ZeroAddress();
        governanceContract = _governance;
    }
}
