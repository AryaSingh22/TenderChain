# TenderChain Security Document

## Threat Model

### 1. Front-Running on Commitments
**Risk**: Miners/validators could observe pending commitment transactions and extract information.
**Mitigation**: Commitments are keccak256 hashes — no bid data is extractable from the hash. The salt ensures preimage resistance. Even validators cannot determine bid amounts from commitment hashes.

### 2. Griefing Attacks on Reveal Phase
**Risk**: An attacker submits a commitment but intentionally never reveals, wasting evaluator time.
**Mitigation**: The `forfeitBid` function allows evaluators to formally record forfeited bids after the reveal deadline. Future versions may require a commit bond that is forfeited on non-reveal.

### 3. Denial-of-Service on Deadline Enforcement
**Risk**: Network congestion could prevent legitimate reveals before the deadline.
**Mitigation**: IBFT 2.0 provides deterministic 2-second block finality. No forks or block reorganizations. Reveal windows are set generously (days, not minutes). The permissioned network prevents external spam.

### 4. Key Compromise (ECIES)
**Risk**: If an authority's encryption key is compromised, all bids for that tender are exposed.
**Mitigation**: Per-tender keypairs limit blast radius — compromising one key only affects one tender. Private keys should be stored in HSM or HashiCorp Vault (simulated in dev).

### 5. Validator Collusion
**Risk**: If all 3 validators collude, they could manipulate the blockchain.
**Mitigation**: GovernanceController enforces 2-of-3 multi-sig for any validator changes. Validators are operated by independent government bodies (e.g., Finance Ministry, Anti-Corruption Bureau, IT Ministry).

### 6. Smart Contract Reentrancy
**Risk**: Reentrant calls could drain funds or corrupt state.
**Mitigation**: All contracts use OpenZeppelin `ReentrancyGuard`. The DisputeResolution contract follows checks-effects-interactions pattern for bond transfers.

## Security Decisions

| Decision | Rationale |
|----------|-----------|
| AccessControl over Ownable | Multi-role permission system; no single admin bottleneck |
| Solidity 0.8+ | Built-in overflow/underflow protection; SafeMath unnecessary |
| Custom errors over require strings | Gas efficient; structured error data |
| Per-tender ECIES keys | Limits key compromise blast radius |
| JWT 4-hour expiry | Balances security with user experience |
| Refresh token rotation | Prevents token reuse attacks |
| JSON Schema validation | Prevents injection at API boundary |

## Key Rotation Procedure

1. Generate new ECIES keypair via `generateTenderKeyPair()`
2. Store private key in HSM/Vault
3. Publish public key via API for the new tender
4. Old keys remain valid for existing tenders until reveal phase completes
5. Rotate JWT secrets quarterly; invalidate all active sessions

## Rate Limiting

| Route Category | Limit |
|----------------|-------|
| Public routes | 100 req/min/IP |
| Auth routes | 20 req/min/IP |
| WebSocket | 10 connections/IP |

## Dependency Security

- Run `pnpm audit` before every release
- Slither static analysis on all contracts (CI/CD enforced)
- No external contract calls except OpenZeppelin
- All npm dependencies pinned to exact versions
