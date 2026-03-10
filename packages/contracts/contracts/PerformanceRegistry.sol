// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PerformanceRegistry
 * @notice Records immutable contractor performance scores after project completion.
 * @dev Scores are 1-100, recorded by authorized officials, and can never be modified.
 *      Future tender evaluations can query historical performance scores.
 */
contract PerformanceRegistry is AccessControl {
    // ──────────────────────────── Roles ────────────────────────────
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    // ──────────────────────────── Structs ──────────────────────────
    struct PerformanceRecord {
        uint256 recordId;
        uint256 tenderId;
        address contractor;
        uint8 score; // 1-100
        string comments;
        address recordedBy;
        uint256 timestamp;
    }

    // ──────────────────────────── State ────────────────────────────
    uint256 public recordCount;
    mapping(uint256 => PerformanceRecord) public records;

    /// @dev contractor => list of record IDs
    mapping(address => uint256[]) public contractorRecords;

    /// @dev tenderId => contractor => has record
    mapping(uint256 => mapping(address => bool)) public hasRecord;

    // ──────────────────────────── Events ───────────────────────────
    event PerformanceRecorded(
        uint256 indexed recordId,
        uint256 indexed tenderId,
        address indexed contractor,
        uint8 score,
        address recordedBy
    );

    // ──────────────────────────── Errors ───────────────────────────
    error InvalidScore(uint8 score);
    error RecordAlreadyExists(uint256 tenderId, address contractor);
    error ZeroAddress();

    // ──────────────────────────── Constructor ──────────────────────
    constructor(address _admin) {
        require(_admin != address(0), "Zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(RECORDER_ROLE, _admin);
    }

    // ──────────────────────────── Functions ────────────────────────

    /**
     * @notice Record a performance score for a contractor on a completed tender.
     * @param _tenderId The completed tender ID
     * @param _contractor The contractor address
     * @param _score Performance score (1-100)
     * @param _comments Textual review comments
     */
    function recordPerformance(
        uint256 _tenderId,
        address _contractor,
        uint8 _score,
        string calldata _comments
    ) external onlyRole(RECORDER_ROLE) returns (uint256) {
        if (_contractor == address(0)) revert ZeroAddress();
        if (_score == 0 || _score > 100) revert InvalidScore(_score);
        if (hasRecord[_tenderId][_contractor])
            revert RecordAlreadyExists(_tenderId, _contractor);

        recordCount++;
        uint256 newId = recordCount;

        records[newId] = PerformanceRecord({
            recordId: newId,
            tenderId: _tenderId,
            contractor: _contractor,
            score: _score,
            comments: _comments,
            recordedBy: msg.sender,
            timestamp: block.timestamp
        });

        contractorRecords[_contractor].push(newId);
        hasRecord[_tenderId][_contractor] = true;

        emit PerformanceRecorded(newId, _tenderId, _contractor, _score, msg.sender);
        return newId;
    }

    /**
     * @notice Get a performance record by ID.
     */
    function getRecord(uint256 _recordId) external view returns (PerformanceRecord memory) {
        require(_recordId > 0 && _recordId <= recordCount, "Invalid record");
        return records[_recordId];
    }

    /**
     * @notice Get all performance record IDs for a contractor.
     */
    function getContractorRecords(address _contractor) external view returns (uint256[] memory) {
        return contractorRecords[_contractor];
    }

    /**
     * @notice Get average score for a contractor.
     */
    function getAverageScore(address _contractor) external view returns (uint256) {
        uint256[] memory ids = contractorRecords[_contractor];
        if (ids.length == 0) return 0;

        uint256 total = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            total += records[ids[i]].score;
        }
        return total / ids.length;
    }
}
