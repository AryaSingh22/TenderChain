// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title AuditLog
 * @notice Append-only on-chain event registry for all procurement actions.
 * @dev Every sensitive action across the system emits a structured log entry here.
 *      Entries are immutable — once written, they cannot be modified or deleted.
 */
contract AuditLog is AccessControl {
    // ──────────────────────────── Roles ────────────────────────────
    bytes32 public constant LOGGER_ROLE = keccak256("LOGGER_ROLE");

    // ──────────────────────────── Enums ────────────────────────────
    enum ActionType {
        TENDER_CREATED,
        TENDER_PUBLISHED,
        TENDER_CANCELLED,
        BID_COMMITTED,
        BID_REVEALED,
        BID_FORFEITED,
        EVALUATION_STARTED,
        EVALUATION_COMPLETED,
        TENDER_AWARDED,
        APPEAL_FILED,
        APPEAL_RESOLVED,
        AI_EVALUATION_GENERATED,
        PERFORMANCE_RECORDED,
        VALIDATOR_ADDED,
        VALIDATOR_REMOVED
    }

    // ──────────────────────────── Structs ──────────────────────────
    struct LogEntry {
        uint256 logId;
        uint256 timestamp;
        address actor;
        ActionType actionType;
        uint256 relatedEntityId;
        bytes32 dataHash;
    }

    // ──────────────────────────── State ────────────────────────────
    LogEntry[] public logs;
    uint256 public logCount;

    // ──────────────────────────── Events ───────────────────────────
    event LogRecorded(
        uint256 indexed logId,
        address indexed actor,
        ActionType indexed actionType,
        uint256 relatedEntityId,
        bytes32 dataHash,
        uint256 timestamp
    );

    // ──────────────────────────── Constructor ──────────────────────
    constructor(address _admin) {
        require(_admin != address(0), "Zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(LOGGER_ROLE, _admin);
    }

    // ──────────────────────────── Functions ────────────────────────

    /**
     * @notice Records an immutable audit log entry.
     * @param _actor The wallet address performing the action
     * @param _actionType The type of action being recorded
     * @param _relatedEntityId The tender or bid ID related to this action
     * @param _dataHash Hash of any supporting off-chain document
     */
    function recordLog(
        address _actor,
        ActionType _actionType,
        uint256 _relatedEntityId,
        bytes32 _dataHash
    ) external onlyRole(LOGGER_ROLE) returns (uint256) {
        logCount++;
        uint256 newId = logCount;

        LogEntry memory entry = LogEntry({
            logId: newId,
            timestamp: block.timestamp,
            actor: _actor,
            actionType: _actionType,
            relatedEntityId: _relatedEntityId,
            dataHash: _dataHash
        });

        logs.push(entry);

        emit LogRecorded(
            newId,
            _actor,
            _actionType,
            _relatedEntityId,
            _dataHash,
            block.timestamp
        );

        return newId;
    }

    /**
     * @notice Get a log entry by ID.
     * @param _logId The log entry ID (1-indexed)
     */
    function getLog(uint256 _logId) external view returns (LogEntry memory) {
        require(_logId > 0 && _logId <= logCount, "Invalid log ID");
        return logs[_logId - 1];
    }

    /**
     * @notice Get the total number of log entries.
     */
    function getLogCount() external view returns (uint256) {
        return logCount;
    }

    /**
     * @notice Get logs in a range (for pagination).
     * @param _from Start index (1-indexed, inclusive)
     * @param _to End index (1-indexed, inclusive)
     */
    function getLogs(uint256 _from, uint256 _to) external view returns (LogEntry[] memory) {
        require(_from > 0 && _from <= _to && _to <= logCount, "Invalid range");
        LogEntry[] memory result = new LogEntry[](_to - _from + 1);
        for (uint256 i = _from; i <= _to; i++) {
            result[i - _from] = logs[i - 1];
        }
        return result;
    }
}
