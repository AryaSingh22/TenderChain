# TenderChain System Architecture

## High-Level Architecture

```mermaid
graph TB
    subgraph Frontend["Frontend (Next.js 14)"]
        AP["Authority Portal<br/>/authority"]
        CP["Contractor Portal<br/>/contractor"]
        AD["Audit Dashboard<br/>/audit"]
    end

    subgraph Backend["Backend API (Fastify)"]
        AUTH["Auth Module<br/>JWT + Refresh"]
        TENDER["Tender API"]
        BID["Bid API<br/>ECIES Encryption"]
        AUDIT["Audit API"]
        DID["DID/VC Module"]
        AI["AI Eval Module"]
        NOTIF["Notification Service<br/>Twilio/SendGrid"]
        WS["WebSocket Server"]
    end

    subgraph Blockchain["Permissioned Chain (IBFT 2.0)"]
        TR["TenderRegistry.sol"]
        BM["BidManager.sol"]
        AL["AuditLog.sol"]
        GC["GovernanceController.sol"]
        DR["DisputeResolution.sol"]
        PR["PerformanceRegistry.sol"]
    end

    subgraph Storage["Off-Chain Storage"]
        PG["PostgreSQL"]
        IPFS["IPFS"]
    end

    subgraph Monitoring["Monitoring"]
        PROM["Prometheus"]
        GRAF["Grafana"]
    end

    AP --> AUTH
    CP --> AUTH
    AD --> AUDIT

    AP --> TENDER
    CP --> BID
    AP --> AI

    TENDER --> TR
    BID --> BM
    AUDIT --> AL
    BID --> IPFS
    TENDER --> IPFS
    AUTH --> PG

    PROM --> GRAF
    Backend --> PROM
```

## Commit-Reveal Flow

```mermaid
sequenceDiagram
    participant C as Contractor
    participant B as Backend API
    participant BC as Blockchain
    participant A as Authority

    Note over C,A: COMMIT PHASE
    C->>B: Fetch authority public key
    B-->>C: ECIES public key (per-tender)
    C->>C: Encrypt bid with public key
    C->>B: Submit encrypted bid
    B->>B: Generate commitment hash
    B->>BC: submitCommitment(tenderId, hash)
    BC-->>B: Commitment stored on-chain
    B-->>C: Return commitment + salt

    Note over C,A: REVEAL PHASE (after deadline)
    A->>A: Decrypt bids with private key
    B->>BC: revealBid(tenderId, amount, payloadHash, salt)
    BC->>BC: Verify hash matches commitment
    BC-->>B: Bid registered as valid
```

## Node Architecture

```mermaid
graph LR
    subgraph Validators["Validator Nodes (IBFT 2.0)"]
        V1["Validator 1<br/>Ministry of Finance"]
        V2["Validator 2<br/>Anti-Corruption Bureau"]
        V3["Validator 3<br/>IT Ministry"]
    end

    subgraph RPC["RPC Nodes"]
        R1["RPC Node<br/>Backend API Access"]
    end

    subgraph Auditor["Auditor Nodes"]
        A1["Auditor Node<br/>Read-Only Access"]
    end

    V1 <--> V2
    V2 <--> V3
    V1 <--> V3
    V1 --> R1
    V2 --> A1
```

## Data Flow

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Presentation | Next.js 14 + TailwindCSS | 3 portals with role-based access |
| API | Fastify + TypeScript | REST + WebSocket bridge |
| Auth | JWT + Refresh Tokens | 4-hour sessions with rotation |
| Encryption | ECIES (per-tender keys) | Bid confidentiality |
| Blockchain | Polygon Edge (IBFT 2.0) | Immutable procurement records |
| Storage | PostgreSQL + IPFS | User accounts + document storage |
| Identity | W3C DID + VC | Contractor verification |
