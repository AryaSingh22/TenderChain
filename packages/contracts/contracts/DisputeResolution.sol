// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DisputeResolution
 * @notice Handles appeals and dispute resolution for procurement awards.
 * @dev Contractors can file appeals within 72 hours of award.
 *      A 3-member dispute panel votes; majority decision is auto-executed.
 */
contract DisputeResolution is AccessControl, ReentrancyGuard {
    // ──────────────────────────── Roles ────────────────────────────
    bytes32 public constant PANEL_MEMBER_ROLE = keccak256("PANEL_MEMBER_ROLE");

    // ──────────────────────────── Enums ────────────────────────────
    enum AppealStatus { FILED, UNDER_REVIEW, APPROVED, REJECTED }

    // ──────────────────────────── Constants ────────────────────────
    uint256 public constant APPEAL_WINDOW = 72 hours;
    uint256 public constant REQUIRED_VOTES = 2; // 2 of 3 majority
    uint256 public constant MIN_APPEAL_BOND = 0.01 ether;

    // ──────────────────────────── Structs ──────────────────────────
    struct Appeal {
        uint256 appealId;
        uint256 tenderId;
        address appellant; // contractor who filed the appeal
        string reason;
        uint256 bond;
        AppealStatus status;
        uint256 filedAt;
        uint256 resolvedAt;
        uint256 approveVotes;
        uint256 rejectVotes;
    }

    // ──────────────────────────── State ────────────────────────────
    uint256 public appealCount;
    mapping(uint256 => Appeal) public appeals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /// @dev tenderId => has active appeal
    mapping(uint256 => bool) public hasActiveAppeal;

    /// @dev Protocol treasury for forfeited bonds
    address public treasury;

    // ──────────────────────────── Events ───────────────────────────
    event AppealFiled(uint256 indexed appealId, uint256 indexed tenderId, address indexed appellant, uint256 bond);
    event AppealVoted(uint256 indexed appealId, address indexed panelMember, bool approved);
    event AppealResolved(uint256 indexed appealId, AppealStatus result);
    event BondReturned(uint256 indexed appealId, address indexed appellant, uint256 amount);
    event BondForfeited(uint256 indexed appealId, uint256 amount);

    // ──────────────────────────── Errors ───────────────────────────
    error AppealWindowClosed(uint256 tenderId);
    error AppealAlreadyExists(uint256 tenderId);
    error InsufficientBond(uint256 sent, uint256 required);
    error NotAppealant(uint256 appealId);
    error AppealNotActive(uint256 appealId);
    error AlreadyVoted(uint256 appealId, address voter);

    // ──────────────────────────── Constructor ──────────────────────
    constructor(address _admin, address _treasury) {
        require(_admin != address(0) && _treasury != address(0), "Zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PANEL_MEMBER_ROLE, _admin);
        treasury = _treasury;
    }

    // ──────────────────────────── Functions ────────────────────────

    /**
     * @notice File an appeal against a tender award.
     * @param _tenderId The tender being appealed
     * @param _reason Reason for the appeal
     */
    function fileAppeal(uint256 _tenderId, string calldata _reason)
        external
        payable
        nonReentrant
    {
        if (msg.value < MIN_APPEAL_BOND)
            revert InsufficientBond(msg.value, MIN_APPEAL_BOND);
        if (hasActiveAppeal[_tenderId])
            revert AppealAlreadyExists(_tenderId);

        appealCount++;
        uint256 newId = appealCount;

        appeals[newId] = Appeal({
            appealId: newId,
            tenderId: _tenderId,
            appellant: msg.sender,
            reason: _reason,
            bond: msg.value,
            status: AppealStatus.FILED,
            filedAt: block.timestamp,
            resolvedAt: 0,
            approveVotes: 0,
            rejectVotes: 0
        });

        hasActiveAppeal[_tenderId] = true;

        emit AppealFiled(newId, _tenderId, msg.sender, msg.value);
    }

    /**
     * @notice Panel member votes on an appeal.
     * @param _appealId The appeal to vote on
     * @param _approve True = sustain appeal, false = reject
     */
    function voteOnAppeal(uint256 _appealId, bool _approve)
        external
        onlyRole(PANEL_MEMBER_ROLE)
        nonReentrant
    {
        Appeal storage appeal = appeals[_appealId];
        require(appeal.appealId != 0, "Appeal not found");

        if (appeal.status != AppealStatus.FILED && appeal.status != AppealStatus.UNDER_REVIEW)
            revert AppealNotActive(_appealId);

        if (hasVoted[_appealId][msg.sender])
            revert AlreadyVoted(_appealId, msg.sender);

        hasVoted[_appealId][msg.sender] = true;
        appeal.status = AppealStatus.UNDER_REVIEW;

        if (_approve) {
            appeal.approveVotes++;
        } else {
            appeal.rejectVotes++;
        }

        emit AppealVoted(_appealId, msg.sender, _approve);

        // Check if decision reached (2 of 3)
        if (appeal.approveVotes >= REQUIRED_VOTES) {
            _resolveAppeal(_appealId, true);
        } else if (appeal.rejectVotes >= REQUIRED_VOTES) {
            _resolveAppeal(_appealId, false);
        }
    }

    function _resolveAppeal(uint256 _appealId, bool _approved) internal {
        Appeal storage appeal = appeals[_appealId];
        appeal.resolvedAt = block.timestamp;
        hasActiveAppeal[appeal.tenderId] = false;

        if (_approved) {
            appeal.status = AppealStatus.APPROVED;
            // Return bond to appellant
            (bool sent, ) = appeal.appellant.call{value: appeal.bond}("");
            require(sent, "Bond return failed");
            emit BondReturned(_appealId, appeal.appellant, appeal.bond);
        } else {
            appeal.status = AppealStatus.REJECTED;
            // Forfeit bond to treasury
            (bool sent, ) = treasury.call{value: appeal.bond}("");
            require(sent, "Bond forfeit failed");
            emit BondForfeited(_appealId, appeal.bond);
        }

        emit AppealResolved(_appealId, appeal.status);
    }

    /**
     * @notice Get appeal details.
     */
    function getAppeal(uint256 _appealId) external view returns (Appeal memory) {
        require(_appealId > 0 && _appealId <= appealCount, "Invalid appeal");
        return appeals[_appealId];
    }
}
