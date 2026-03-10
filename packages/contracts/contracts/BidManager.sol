// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ITenderRegistry {
    enum TenderStatus { DRAFT, PUBLISHED, CLOSED, EVALUATION, AWARDED, CANCELLED }
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
    function getTender(uint256 tenderId) external view returns (Tender memory);
}

/**
 * @title BidManager
 * @notice Implements the commit-reveal scheme for sealed-bid procurement.
 * @dev The cryptographic heart of TenderChain. Ensures no bid data is readable
 *      before the official reveal phase.
 *
 *      Commit Phase: Bidder submits keccak256(abi.encodePacked(bidder, tenderId, payloadHash, salt))
 *      Reveal Phase: Bidder submits original values; contract recomputes and verifies hash match
 */
contract BidManager is AccessControl, ReentrancyGuard {
    // ──────────────────────────── Roles ────────────────────────────
    bytes32 public constant EVALUATOR_ROLE = keccak256("EVALUATOR_ROLE");

    // ──────────────────────────── Structs ──────────────────────────
    struct Commitment {
        bytes32 commitHash;
        uint256 timestamp;
        bool exists;
    }

    struct RevealedBid {
        address bidder;
        uint256 amount;
        bytes32 payloadHash;
        bool revealed;
        uint256 timestamp;
    }

    // ──────────────────────────── State ────────────────────────────
    ITenderRegistry public tenderRegistry;

    /// @dev tenderId => bidder => Commitment
    mapping(uint256 => mapping(address => Commitment)) public commitments;

    /// @dev tenderId => bidder => RevealedBid
    mapping(uint256 => mapping(address => RevealedBid)) public revealedBids;

    /// @dev tenderId => list of bidder addresses
    mapping(uint256 => address[]) public bidderLists;

    /// @dev tenderId => bidder => has been added to bidderLists
    mapping(uint256 => mapping(address => bool)) private _isBidder;

    // ──────────────────────────── Events ───────────────────────────
    event CommitmentSubmitted(uint256 indexed tenderId, address indexed bidder, uint256 timestamp);
    event BidRevealed(uint256 indexed tenderId, address indexed bidder, uint256 amount, uint256 timestamp);
    event BidForfeited(uint256 indexed tenderId, address indexed bidder);

    // ──────────────────────────── Errors ───────────────────────────
    error TenderNotPublished(uint256 tenderId);
    error SubmissionDeadlinePassed(uint256 tenderId);
    error SubmissionDeadlineNotPassed(uint256 tenderId);
    error RevealDeadlinePassed(uint256 tenderId);
    error CommitmentAlreadyExists(uint256 tenderId, address bidder);
    error NoCommitmentFound(uint256 tenderId, address bidder);
    error CommitmentMismatch(uint256 tenderId, address bidder);
    error AlreadyRevealed(uint256 tenderId, address bidder);
    error BidBelowMinimum(uint256 tenderId, uint256 amount, uint256 minimum);
    error ZeroCommitment();

    // ──────────────────────────── Constructor ──────────────────────
    constructor(address _tenderRegistry, address _admin) {
        require(_tenderRegistry != address(0), "Zero address");
        require(_admin != address(0), "Zero address");
        tenderRegistry = ITenderRegistry(_tenderRegistry);
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(EVALUATOR_ROLE, _admin);
    }

    // ──────────────────────────── Commit Phase ────────────────────

    /**
     * @notice Submit a sealed bid commitment for a published tender.
     * @dev The commitment must be keccak256(abi.encodePacked(bidder, tenderId, payloadHash, salt))
     *      computed off-chain. Only one commitment per bidder per tender.
     * @param _tenderId The tender to bid on
     * @param _commitment The keccak256 commitment hash
     */
    function submitCommitment(uint256 _tenderId, bytes32 _commitment)
        external
        nonReentrant
    {
        if (_commitment == bytes32(0)) revert ZeroCommitment();

        ITenderRegistry.Tender memory tender = tenderRegistry.getTender(_tenderId);

        // Must be PUBLISHED status
        if (tender.status != ITenderRegistry.TenderStatus.PUBLISHED)
            revert TenderNotPublished(_tenderId);

        // Must be before submission deadline
        if (block.timestamp >= tender.submissionDeadline)
            revert SubmissionDeadlinePassed(_tenderId);

        // One commitment per bidder
        if (commitments[_tenderId][msg.sender].exists)
            revert CommitmentAlreadyExists(_tenderId, msg.sender);

        commitments[_tenderId][msg.sender] = Commitment({
            commitHash: _commitment,
            timestamp: block.timestamp,
            exists: true
        });

        if (!_isBidder[_tenderId][msg.sender]) {
            bidderLists[_tenderId].push(msg.sender);
            _isBidder[_tenderId][msg.sender] = true;
        }

        emit CommitmentSubmitted(_tenderId, msg.sender, block.timestamp);
    }

    // ──────────────────────────── Reveal Phase ───────────────────

    /**
     * @notice Reveal a previously committed bid.
     * @dev Recomputes the commitment hash from the provided values and verifies match.
     *      Must be called after submissionDeadline and before revealDeadline.
     * @param _tenderId The tender ID
     * @param _amount The bid amount in wei
     * @param _payloadHash The keccak256 hash of the bid payload
     * @param _salt The random salt used during commitment
     */
    function revealBid(
        uint256 _tenderId,
        uint256 _amount,
        bytes32 _payloadHash,
        bytes32 _salt
    ) external nonReentrant {
        ITenderRegistry.Tender memory tender = tenderRegistry.getTender(_tenderId);

        // Must be after submission deadline
        if (block.timestamp < tender.submissionDeadline)
            revert SubmissionDeadlineNotPassed(_tenderId);

        // Must be before reveal deadline
        if (block.timestamp > tender.revealDeadline)
            revert RevealDeadlinePassed(_tenderId);

        // Must have a commitment
        Commitment storage commitment = commitments[_tenderId][msg.sender];
        if (!commitment.exists)
            revert NoCommitmentFound(_tenderId, msg.sender);

        // Must not have already revealed
        if (revealedBids[_tenderId][msg.sender].revealed)
            revert AlreadyRevealed(_tenderId, msg.sender);

        // Verify commitment hash
        bytes32 recomputed = keccak256(
            abi.encodePacked(msg.sender, _tenderId, _payloadHash, _salt)
        );
        if (recomputed != commitment.commitHash)
            revert CommitmentMismatch(_tenderId, msg.sender);

        // Verify bid meets minimum
        if (_amount < tender.minimumBidAmount)
            revert BidBelowMinimum(_tenderId, _amount, tender.minimumBidAmount);

        revealedBids[_tenderId][msg.sender] = RevealedBid({
            bidder: msg.sender,
            amount: _amount,
            payloadHash: _payloadHash,
            revealed: true,
            timestamp: block.timestamp
        });

        emit BidRevealed(_tenderId, msg.sender, _amount, block.timestamp);
    }

    // ──────────────────────────── View Functions ─────────────────

    /**
     * @notice Get a revealed bid (evaluators only).
     * @param _tenderId The tender ID
     * @param _bidder The bidder address
     */
    function getBid(uint256 _tenderId, address _bidder)
        external
        view
        onlyRole(EVALUATOR_ROLE)
        returns (RevealedBid memory)
    {
        return revealedBids[_tenderId][_bidder];
    }

    /**
     * @notice Get commitment hash for a bidder (public for audit).
     * @param _tenderId The tender ID
     * @param _bidder The bidder address
     */
    function getCommitment(uint256 _tenderId, address _bidder)
        external
        view
        returns (bytes32)
    {
        return commitments[_tenderId][_bidder].commitHash;
    }

    /**
     * @notice Get all bidders for a tender (evaluators only).
     * @param _tenderId The tender ID
     */
    function getBidderList(uint256 _tenderId)
        external
        view
        onlyRole(EVALUATOR_ROLE)
        returns (address[] memory)
    {
        return bidderLists[_tenderId];
    }

    /**
     * @notice Mark a bidder as forfeited (did not reveal in time).
     * @param _tenderId The tender ID
     * @param _bidder The bidder who failed to reveal
     */
    function forfeitBid(uint256 _tenderId, address _bidder)
        external
        onlyRole(EVALUATOR_ROLE)
    {
        ITenderRegistry.Tender memory tender = tenderRegistry.getTender(_tenderId);
        require(block.timestamp > tender.revealDeadline, "Reveal deadline not passed");
        require(commitments[_tenderId][_bidder].exists, "No commitment");
        require(!revealedBids[_tenderId][_bidder].revealed, "Already revealed");

        emit BidForfeited(_tenderId, _bidder);
    }
}
