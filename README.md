# TenderChain
 
> Permissioned blockchain platform for transparent government procurement

[![CI/CD](https://github.com/your-org/tenderchain/workflows/TenderChain%20CI%2FCD/badge.svg)](https://github.com/your-org/tenderchain/actions)

## Overview

TenderChain eliminates bid tampering in government procurement through:
- **Commit-Reveal Bidding**: Cryptographic sealed bids using keccak256 commitments
- **Immutable Audit Trail**: Every procurement action logged on-chain
- **ECIES Encryption**: Per-tender encryption keypairs for bid data
- **Decentralized Identity**: W3C Verifiable Credentials for contractor registration
- **Multi-Sig Governance**: 2-of-3 validator management preventing single-entity hijacking

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Frontend (Next.js 14 + TailwindCSS)                │
│  ├── /authority — Government Portal                  │
│  ├── /contractor — Bid Submission Portal             │
│  └── /audit — Public Verification Dashboard          │
├─────────────────────────────────────────────────────┤
│  Backend API (Fastify + TypeScript)                  │
│  ├── Auth (JWT + Refresh Token Rotation)             │
│  ├── Tenders, Bids, Audit, Performance               │
│  ├── DID/VC, AI Evaluation, Notifications            │
│  └── WebSocket (Real-time Events)                    │
├─────────────────────────────────────────────────────┤
│  Smart Contracts (Solidity 0.8.24)                   │
│  ├── TenderRegistry — Lifecycle Management           │
│  ├── BidManager — Commit-Reveal Scheme               │
│  ├── AuditLog — Append-Only Event Registry           │
│  ├── GovernanceController — Multi-Sig Validators     │
│  ├── DisputeResolution — Appeal Workflow             │
│  └── PerformanceRegistry — Contractor Scores         │
├─────────────────────────────────────────────────────┤
│  Permissioned Blockchain (Polygon Edge / IBFT 2.0)   │
│  Chain ID: 20240901 | Block Time: 2s | Gas: 30M     │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js >= 18
- pnpm >= 8
- Docker (for full stack)

### Local Development

```bash
# Install dependencies
pnpm install

# Compile smart contracts
pnpm contracts:compile

# Run contract tests (73 tests)
pnpm contracts:test

# Start backend API
pnpm backend:dev

# Start frontend
pnpm frontend:dev
```

### Docker (Full Stack)

```bash
docker compose up --build
```

Services:
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| Blockchain RPC | http://localhost:8545 |
| IPFS Gateway | http://localhost:8080 |
| Grafana | http://localhost:3002 |
| Prometheus | http://localhost:9090 |

## Project Structure

```
tenderchain/
├── apps/
│   ├── frontend/          # Next.js 14 — three portals
│   └── backend/           # Fastify API server
├── packages/
│   ├── contracts/         # Hardhat + Solidity contracts
│   ├── shared/            # Shared TypeScript types
│   └── crypto/            # ECIES encryption utilities
├── infra/
│   ├── docker/            # Dockerfiles
│   ├── k8s/               # Kubernetes manifests
│   └── blockchain/        # Genesis config
├── docs/
│   ├── architecture/      # System diagrams
│   └── api/               # OpenAPI spec
├── .github/workflows/     # CI/CD
└── docker-compose.yml
```

## Environment Variables

Copy `apps/backend/.env.example` to `apps/backend/.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend port | 3001 |
| `DATABASE_URL` | PostgreSQL connection | localhost:5432 |
| `JWT_SECRET` | JWT signing key | dev-only |
| `RPC_URL` | Blockchain RPC endpoint | localhost:8545 |
| `CHAIN_ID` | TenderChain chain ID | 20240901 |

## Security

- OpenZeppelin AccessControl (no Ownable pattern)
- ReentrancyGuard on all state-changing functions
- Solidity 0.8+ overflow protection
- Rate limiting: 100 req/min public, 20 req/min auth
- JWT 4-hour expiry with refresh token rotation
- ECIES per-tender encryption keypairs
- See [docs/SECURITY.md](docs/SECURITY.md) for full threat model

## License

MIT
