# Commit-Reveal Scheme — Technical Specification

## Overview

TenderChain uses a two-phase commit-reveal scheme to ensure bid confidentiality. No bid data is readable by any party before the official reveal phase.

## Phase 1: Commit

### Off-Chain (Contractor)

```typescript
import { ethers } from "ethers";

// 1. Generate cryptographically secure salt (32 bytes)
const salt = ethers.randomBytes(32);

// 2. Prepare bid payload
const bidPayload = {
  amount: bidAmountInWei,
  technicalScore: encryptedTechProposalHash,
  companyId: registeredCompanyId,
};

// 3. Compute commitment hash
const payloadHash = ethers.keccak256(
  ethers.toUtf8Bytes(JSON.stringify(bidPayload))
);

const commitment = ethers.keccak256(
  ethers.solidityPacked(
    ["address", "uint256", "bytes32", "bytes32"],
    [bidderAddress, tenderId, payloadHash, salt]
  )
);
```

### On-Chain (BidManager.sol)

```solidity
function submitCommitment(uint256 tenderId, bytes32 commitment) external {
    // Checks:
    // 1. Tender must be in PUBLISHED status
    // 2. Current time must be before submissionDeadline
    // 3. Bidder must not have existing commitment for this tender
    // 4. Commitment must not be zero bytes

    commitments[tenderId][msg.sender] = Commitment({
        commitHash: commitment,
        timestamp: block.timestamp,
        exists: true
    });

    emit CommitmentSubmitted(tenderId, msg.sender, block.timestamp);
}
```

## Phase 2: Reveal

### On-Chain Verification

```solidity
function revealBid(
    uint256 tenderId,
    uint256 amount,
    bytes32 payloadHash,
    bytes32 salt
) external {
    // 1. Must be after submissionDeadline
    // 2. Must be before revealDeadline
    // 3. Must have existing commitment
    // 4. Must not have already revealed

    // 5. Recompute hash and verify
    bytes32 recomputed = keccak256(
        abi.encodePacked(msg.sender, tenderId, payloadHash, salt)
    );
    require(recomputed == commitment.commitHash, "CommitmentMismatch");

    // 6. Verify bid meets minimum
    require(amount >= tender.minimumBidAmount, "BidBelowMinimum");

    // 7. Store revealed bid
    revealedBids[tenderId][msg.sender] = RevealedBid({...});
}
```

## Security Properties

| Property | Guarantee |
|----------|-----------|
| Confidentiality | Bid amount invisible until reveal phase |
| Integrity | Tampered reveals are automatically rejected |
| Non-repudiation | On-chain commitments are immutable evidence |
| Uniqueness | One commitment per bidder per tender |
| Timeliness | Deadlines enforced by block timestamps |
| Fairness | No party can read bids before reveal phase |

## Timeline

```
├─── Tender Published ───────────────────────────────┤
│                                                     │
│  COMMIT PHASE                                       │
│  Bidders submit commitments (sealed bids)           │
│                                                     │
├─── Submission Deadline ────────────────────────────┤
│                                                     │
│  REVEAL PHASE                                       │
│  Bidders reveal original values                     │
│  Contract verifies hash match                       │
│                                                     │
├─── Reveal Deadline ───────────────────────────────┤
│                                                     │
│  EVALUATION                                         │
│  Unrevealed bids forfeited                          │
│  Authority evaluates revealed bids                  │
│                                                     │
├─── Award ─────────────────────────────────────────┤
```
