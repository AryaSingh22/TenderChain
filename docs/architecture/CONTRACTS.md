# TenderChain Smart Contract Documentation

## Deployed Contracts

| Contract | Description | Role System |
|----------|-------------|-------------|
| TenderRegistry | Master tender lifecycle management | `AUTHORITY_ROLE`, `ADMIN_ROLE` |
| BidManager | Commit-reveal scheme for sealed bids | `EVALUATOR_ROLE`, `ADMIN_ROLE` |
| AuditLog | Append-only event registry | `LOGGER_ROLE` |
| GovernanceController | 2-of-3 multi-sig validator management | `GOVERNOR_ROLE` |
| DisputeResolution | Appeal and dispute workflow | `PANEL_MEMBER_ROLE` |
| PerformanceRegistry | Contractor performance scoring | `RECORDER_ROLE` |

## TenderRegistry

### Functions

| Function | Access | Parameters | Description |
|----------|--------|------------|-------------|
| `createTender` | AUTHORITY_ROLE | title, desc, hash, deadlines, minBid | Creates tender in DRAFT |
| `publishTender` | AUTHORITY_ROLE | tenderId | DRAFT → PUBLISHED |
| `closeTender` | AUTHORITY_ROLE | tenderId | PUBLISHED → CLOSED (after deadline) |
| `startEvaluation` | AUTHORITY_ROLE | tenderId | CLOSED → EVALUATION |
| `awardTender` | AUTHORITY_ROLE | tenderId, winner | EVALUATION → AWARDED |
| `cancelTender` | AUTHORITY_ROLE | tenderId, reason | Any → CANCELLED |

### State Machine

```
DRAFT → PUBLISHED → CLOSED → EVALUATION → AWARDED
  ↓          ↓
CANCELLED  CANCELLED
```

## BidManager

### Functions

| Function | Access | Parameters | Description |
|----------|--------|------------|-------------|
| `submitCommitment` | Public | tenderId, commitment | Store sealed bid hash |
| `revealBid` | Public | tenderId, amount, payloadHash, salt | Verify and reveal bid |
| `getBid` | EVALUATOR_ROLE | tenderId, bidder | Read revealed bid data |
| `getBidderList` | EVALUATOR_ROLE | tenderId | Get all bidders |
| `forfeitBid` | Public | tenderId, bidder | Mark unrevealed bids |

### Commitment Formula

```
commitment = keccak256(abi.encodePacked(
    msg.sender,      // bidder address
    _tenderId,       // tender ID
    _payloadHash,    // keccak256 of bid payload JSON
    _salt            // 32-byte random salt
))
```

## Events

| Contract | Event | When |
|----------|-------|------|
| TenderRegistry | TenderCreated | New tender created |
| TenderRegistry | TenderPublished | Tender goes live |
| TenderRegistry | TenderAwarded | Winner selected |
| BidManager | CommitmentSubmitted | Sealed bid recorded |
| BidManager | BidRevealed | Bid data verified |
| AuditLog | LogRecorded | Any system action logged |
| GovernanceController | ProposalCreated | Validator change proposed |
| GovernanceController | ValidatorAdded/Removed | Validator set changed |
| DisputeResolution | AppealFiled | Contractor appeals |
| DisputeResolution | AppealResolved | Panel decision made |
| PerformanceRegistry | PerformanceRecorded | Score submitted |

## Gas Estimates

| Operation | Avg Gas | USD (@ $0.001/gas) |
|-----------|---------|---------------------|
| createTender | ~236,000 | $0.24 |
| submitCommitment | ~195,000 | $0.20 |
| revealBid | ~179,000 | $0.18 |
| recordLog | ~141,000 | $0.14 |
| recordPerformance | ~237,000 | $0.24 |

> Note: On permissioned Polygon Edge, gas costs are nominal (no real ETH required).
