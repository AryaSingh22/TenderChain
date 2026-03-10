# TenderChain Smart Contract Documentation

## Overview

TenderChain consists of six core Solidity smart contracts working together to provide a transparent, tamper-proof government tender procurement system. All contracts are built on OpenZeppelin's AccessControl for role-based permissions and compiled with Solidity 0.8.24.

---

## Contract Architecture

```
TenderRegistry ───── BidManager
       │                  │
       │            (reads tender status)
       │
GovernanceController
       │
DisputeResolution
       │
PerformanceRegistry
       │
   AuditLog
```

---

## 1. TenderRegistry

**File**: `contracts/TenderRegistry.sol`
**Purpose**: Central registry managing the complete tender lifecycle.

### Roles
| Role | Description |
|------|-------------|
| `AUTHORITY_ROLE` | Procurement authorities who create and manage tenders |
| `ADMIN_ROLE` | System administrator for governance configuration |

### Lifecycle States
`DRAFT → PUBLISHED → CLOSED → EVALUATION → AWARDED`
Tenders can be `CANCELLED` from any state except `AWARDED`.

### Key Functions

- **`createTender(ipfsDocumentHash, submissionDeadline, revealDeadline, eligibilityCriteriaHash, minimumBidAmount, estimatedProjectValue)`** — Creates a new tender in DRAFT status.
- **`publishTender(tenderId)`** — Moves tender from DRAFT to PUBLISHED.
- **`closeTender(tenderId)`** — Closes submission window after deadline passes.
- **`startEvaluation(tenderId)`** — Transitions CLOSED → EVALUATION.
- **`awardTender(tenderId, winner)`** — Awards tender to winning contractor.
- **`cancelTender(tenderId, reason)`** — Cancels with on-chain reason.
- **`setGovernanceContract(address)`** — Links to GovernanceController.

### Events
`TenderCreated`, `TenderPublished`, `TenderClosed`, `TenderMovedToEvaluation`, `TenderAwarded`, `TenderCancelled`

---

## 2. BidManager

**File**: `contracts/BidManager.sol`
**Purpose**: Implements sealed-bid commit-reveal scheme.

### Roles
| Role | Description |
|------|-------------|
| `EVALUATOR_ROLE` | Can view revealed bids and forfeit unrevealed ones |

### Commit-Reveal Process

1. **Commit Phase**: Bidders submit `keccak256(abi.encodePacked(bidder, tenderId, payloadHash, salt))` during the submission window.
2. **Reveal Phase**: After submission deadline, bidders reveal their actual bid amounts along with their salt and payload hash. The contract verifies the commitment matches.
3. **Forfeit**: After the reveal deadline, evaluators can forfeit unrevealed bids.

### Key Functions

- **`submitCommitment(tenderId, commitmentHash)`** — Stores sealed bid commitment.
- **`revealBid(tenderId, amount, payloadHash, salt)`** — Reveals bid and verifies against commitment.
- **`getBid(tenderId, bidder)`** — Returns revealed bid (evaluator only).
- **`getCommitment(tenderId, bidder)`** — Returns stored commitment (public).
- **`getBidderList(tenderId)`** — Lists all bidders (evaluator only).
- **`forfeitBid(tenderId, bidder)`** — Marks unrevealed bid as forfeited after deadline (evaluator only).

### Events
`CommitmentSubmitted`, `BidRevealed`, `BidForfeited`

---

## 3. AuditLog

**File**: `contracts/AuditLog.sol`
**Purpose**: Immutable, append-only log of all significant system actions.

### Roles
| Role | Description |
|------|-------------|
| `LOGGER_ROLE` | Authorized to record log entries |

### ActionTypes
```
TENDER_CREATED(0), TENDER_PUBLISHED(1), TENDER_CANCELLED(2),
BID_COMMITTED(3), BID_REVEALED(4), BID_FORFEITED(5),
EVALUATION_STARTED(6), EVALUATION_COMPLETED(7), TENDER_AWARDED(8),
APPEAL_FILED(9), APPEAL_RESOLVED(10), AI_EVALUATION_GENERATED(11),
PERFORMANCE_RECORDED(12), VALIDATOR_ADDED(13), VALIDATOR_REMOVED(14)
```

### Key Functions

- **`recordLog(actor, actionType, relatedEntityId, dataHash)`** — Appends immutable entry.
- **`getLog(logId)`** — Returns specific entry.
- **`getLogs(from, to)`** — Returns paginated range.
- **`getLogCount()`** — Returns total entry count.

---

## 4. DisputeResolution

**File**: `contracts/DisputeResolution.sol`
**Purpose**: Handles appeals and dispute resolution with panel voting.

### Roles
| Role | Description |
|------|-------------|
| `PANEL_MEMBER_ROLE` | Votes on appeals |

### Constants
- `APPEAL_WINDOW`: 72 hours
- `REQUIRED_VOTES`: 2 (for resolution)
- `MIN_APPEAL_BOND`: Minimum ETH bond to file appeal

### Appeal Lifecycle
`FILED → UNDER_REVIEW → APPROVED/REJECTED`

### Key Functions

- **`fileAppeal(tenderId, reason)`** — Files appeal with ETH bond (payable).
- **`voteOnAppeal(appealId, approve)`** — Panel member casts vote.
- **`getAppeal(appealId)`** — Returns appeal details.

### Bond Mechanics
- **Approved**: Bond returned to appellant.
- **Rejected**: Bond forfeited to treasury.

---

## 5. GovernanceController

**File**: `contracts/GovernanceController.sol`
**Purpose**: Multi-signature governance for validator set management.

### Roles
| Role | Description |
|------|-------------|
| `GOVERNOR_ROLE` | Can propose and vote on validator changes |

### Constants
- `REQUIRED_APPROVALS`: 2
- `MAX_GOVERNORS`: 3

### Proposal Types
- `ADD_VALIDATOR(0)` — Adds new validator.
- `REMOVE_VALIDATOR(1)` — Removes existing validator.

### Key Functions

- **`createProposal(proposalType, targetValidator)`** — Creates governance proposal.
- **`vote(proposalId, approve)`** — Governor casts vote; auto-executes on threshold.
- **`getValidators()`** — Returns current validator set.
- **`getProposal(proposalId)`** — Returns proposal details.

---

## 6. PerformanceRegistry

**File**: `contracts/PerformanceRegistry.sol`
**Purpose**: Records immutable performance scores for contractors.

### Roles
| Role | Description |
|------|-------------|
| `RECORDER_ROLE` | Authorized to record performance scores |

### Key Functions

- **`recordPerformance(tenderId, contractor, score, comments)`** — Records score (1–100).
- **`getRecord(recordId)`** — Returns performance record.
- **`getContractorRecords(contractor)`** — Returns all record IDs for a contractor.
- **`getAverageScore(contractor)`** — Calculates weighted average score.

---

## Deployment

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to local network
npx hardhat run scripts/deploy.ts --network hardhat

# Run coverage
npx hardhat coverage
```

## Security Considerations

- All contracts use OpenZeppelin AccessControl for role-based permissions
- Commit-reveal scheme prevents front-running of bids
- Appeal bonds prevent spam filing
- Audit log is append-only (no delete or update functions)
- Score validation enforces 1–100 range
- Zero-address checks on all constructors and critical functions
