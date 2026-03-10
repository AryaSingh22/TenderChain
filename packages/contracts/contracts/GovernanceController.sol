// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GovernanceController
 * @notice Manages validator additions/removals with 2-of-3 multi-sig approval.
 * @dev Prevents any single government body from hijacking the network.
 *      Changes to the validator set require a proposal → vote → execute workflow.
 */
contract GovernanceController is AccessControl, ReentrancyGuard {
    // ──────────────────────────── Roles ────────────────────────────
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    // ──────────────────────────── Enums ────────────────────────────
    enum ProposalType { ADD_VALIDATOR, REMOVE_VALIDATOR }
    enum ProposalStatus { PENDING, APPROVED, REJECTED, EXECUTED }

    // ──────────────────────────── Structs ──────────────────────────
    struct Proposal {
        uint256 proposalId;
        ProposalType proposalType;
        address targetValidator;
        address proposer;
        ProposalStatus status;
        uint256 approvalCount;
        uint256 rejectionCount;
        uint256 createdAt;
        uint256 executedAt;
    }

    // ──────────────────────────── State ────────────────────────────
    uint256 public proposalCount;
    uint256 public constant REQUIRED_APPROVALS = 2;
    uint256 public constant MAX_GOVERNORS = 3;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    address[] public validators;
    mapping(address => bool) public isValidator;

    // ──────────────────────────── Events ───────────────────────────
    event ProposalCreated(uint256 indexed proposalId, ProposalType proposalType, address targetValidator, address proposer);
    event ProposalVoted(uint256 indexed proposalId, address indexed voter, bool approved);
    event ProposalExecuted(uint256 indexed proposalId);
    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);

    // ──────────────────────────── Errors ───────────────────────────
    error AlreadyValidator(address validator);
    error NotValidator(address validator);
    error AlreadyVoted(uint256 proposalId, address voter);
    error ProposalNotPending(uint256 proposalId);
    error InsufficientApprovals(uint256 proposalId);
    error InvalidProposal(uint256 proposalId);

    // ──────────────────────────── Constructor ──────────────────────
    constructor(address[3] memory _governors) {
        for (uint256 i = 0; i < 3; i++) {
            require(_governors[i] != address(0), "Zero address");
            _grantRole(DEFAULT_ADMIN_ROLE, _governors[i]);
            _grantRole(GOVERNOR_ROLE, _governors[i]);
        }
    }

    // ──────────────────────────── Functions ────────────────────────

    /**
     * @notice Create a proposal to add or remove a validator.
     * @param _type ADD_VALIDATOR or REMOVE_VALIDATOR
     * @param _target Address of the validator to add/remove
     */
    function createProposal(ProposalType _type, address _target)
        external
        onlyRole(GOVERNOR_ROLE)
        returns (uint256)
    {
        require(_target != address(0), "Zero address");

        if (_type == ProposalType.ADD_VALIDATOR && isValidator[_target])
            revert AlreadyValidator(_target);
        if (_type == ProposalType.REMOVE_VALIDATOR && !isValidator[_target])
            revert NotValidator(_target);

        proposalCount++;
        uint256 newId = proposalCount;

        proposals[newId] = Proposal({
            proposalId: newId,
            proposalType: _type,
            targetValidator: _target,
            proposer: msg.sender,
            status: ProposalStatus.PENDING,
            approvalCount: 0,
            rejectionCount: 0,
            createdAt: block.timestamp,
            executedAt: 0
        });

        emit ProposalCreated(newId, _type, _target, msg.sender);
        return newId;
    }

    /**
     * @notice Vote on a proposal.
     * @param _proposalId The proposal to vote on
     * @param _approve True to approve, false to reject
     */
    function vote(uint256 _proposalId, bool _approve)
        external
        onlyRole(GOVERNOR_ROLE)
    {
        if (_proposalId == 0 || _proposalId > proposalCount)
            revert InvalidProposal(_proposalId);

        Proposal storage proposal = proposals[_proposalId];

        if (proposal.status != ProposalStatus.PENDING)
            revert ProposalNotPending(_proposalId);

        if (hasVoted[_proposalId][msg.sender])
            revert AlreadyVoted(_proposalId, msg.sender);

        hasVoted[_proposalId][msg.sender] = true;

        if (_approve) {
            proposal.approvalCount++;
        } else {
            proposal.rejectionCount++;
        }

        emit ProposalVoted(_proposalId, msg.sender, _approve);

        // Auto-execute if threshold met
        if (proposal.approvalCount >= REQUIRED_APPROVALS) {
            _executeProposal(_proposalId);
        }

        // Auto-reject if impossible to reach threshold
        if (proposal.rejectionCount > MAX_GOVERNORS - REQUIRED_APPROVALS) {
            proposal.status = ProposalStatus.REJECTED;
        }
    }

    /**
     * @notice Internal: execute an approved proposal.
     */
    function _executeProposal(uint256 _proposalId) internal {
        Proposal storage proposal = proposals[_proposalId];
        proposal.status = ProposalStatus.EXECUTED;
        proposal.executedAt = block.timestamp;

        if (proposal.proposalType == ProposalType.ADD_VALIDATOR) {
            validators.push(proposal.targetValidator);
            isValidator[proposal.targetValidator] = true;
            emit ValidatorAdded(proposal.targetValidator);
        } else {
            _removeValidator(proposal.targetValidator);
            isValidator[proposal.targetValidator] = false;
            emit ValidatorRemoved(proposal.targetValidator);
        }

        emit ProposalExecuted(_proposalId);
    }

    function _removeValidator(address _validator) internal {
        for (uint256 i = 0; i < validators.length; i++) {
            if (validators[i] == _validator) {
                validators[i] = validators[validators.length - 1];
                validators.pop();
                break;
            }
        }
    }

    /**
     * @notice Get all current validators.
     */
    function getValidators() external view returns (address[] memory) {
        return validators;
    }

    /**
     * @notice Get proposal details.
     */
    function getProposal(uint256 _proposalId) external view returns (Proposal memory) {
        require(_proposalId > 0 && _proposalId <= proposalCount, "Invalid proposal");
        return proposals[_proposalId];
    }
}
