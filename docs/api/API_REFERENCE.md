# TenderChain API Reference

Base URL: `http://localhost:3001/api`

## Authentication

### POST `/auth/register`
Register a new user.

**Body:**
```json
{
  "email": "authority@gov.in",
  "password": "securePass123",
  "role": "authority",
  "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
  "name": "Ministry of Transport"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "user": { "id": "user_...", "email": "...", "role": "authority", "wallet": "0x...", "name": "..." }
  }
}
```

### POST `/auth/login`
Login with credentials.

### POST `/auth/refresh`
Rotate refresh token (old token invalidated).

### GET `/auth/profile`
Get current user profile. **Requires JWT.**

---

## Tenders

### POST `/tenders/`
Create a new tender (DRAFT). **Requires JWT (authority role).**

### GET `/tenders/`
List tenders with pagination and optional `?status=PUBLISHED&page=1&limit=20`.

### GET `/tenders/:id`
Get tender details by ID.

### POST `/tenders/:id/publish`
Transition tender from DRAFT → PUBLISHED. **Requires JWT.**

### POST `/tenders/:id/close`
Close a PUBLISHED tender. **Requires JWT.**

### POST `/tenders/:id/evaluate`
Move a CLOSED tender to EVALUATION. **Requires JWT.**

### POST `/tenders/:id/award`
Award tender to a winner. **Requires JWT + winnerAddress body.**

### POST `/tenders/:id/cancel`
Cancel a tender with reason. **Requires JWT.**

---

## Bids

### GET `/bids/encryption-key/:tenderId`
Get ECIES public key for encrypting bids.

### POST `/bids/submit`
Submit an encrypted sealed bid. **Requires JWT.**

### GET `/bids/my-bids`
Get all bids for the authenticated bidder. **Requires JWT.**

### GET `/bids/tender/:tenderId/bidders`
Get bidder list for a tender. **Requires JWT (authority role).**

### GET `/bids/verify/:tenderId/:commitment`
Publicly verify a commitment exists on-chain.

---

## Audit

### GET `/audit/logs`
Get paginated audit logs. Filters: `?actionType=BID_COMMITTED&entityId=1`.

### GET `/audit/logs/:id`
Get single audit log entry.

### GET `/audit/stats`
Get aggregate statistics per action type.

---

## Performance

### POST `/performance/`
Record contractor performance score (1-100). **Requires JWT (authority).**

### GET `/performance/contractor/:wallet`
Get performance records and average score.

---

## DID / Verifiable Credentials

### POST `/did/issue-vc`
Issue a Verifiable Credential. **Requires JWT (authority).**

### GET `/did/verify-vc/:vcId`
Verify a credential's validity.

### GET `/did/credentials/:wallet`
Get all credentials for a wallet address.

### POST `/did/revoke-vc/:vcId`
Revoke a Verifiable Credential. **Requires JWT.**

---

## AI Evaluation

### POST `/ai-eval/evaluate`
Request AI scoring of bids. **Requires JWT (authority).**

### GET `/ai-eval/:id`
Get evaluation by ID. **Requires JWT.**

### GET `/ai-eval/tender/:tenderId`
Get all evaluations for a tender. **Requires JWT.**

---

## Notifications

### POST `/notifications/send`
Send SMS or email notification. **Requires JWT.**

### GET `/notifications/history`
Get notification history. **Requires JWT.**

### POST `/notifications/schedule-alerts`
Schedule deadline alerts. **Requires JWT.**

---

## WebSocket

Connect to `ws://localhost:3001/ws`.

### Messages

| Type | Direction | Description |
|------|-----------|-------------|
| `auth` | Client→Server | Authenticate with JWT token |
| `subscribe` | Client→Server | Subscribe to tender channel |
| `ping` | Client→Server | Keepalive heartbeat |
| `welcome` | Server→Client | Connection confirmation |
| `auth_success` | Server→Client | Authentication confirmed |
| `tender_event` | Server→Client | Real-time tender updates |

---

## Health Check

### GET `/health`
```json
{ "success": true, "data": { "status": "healthy", "timestamp": "...", "version": "1.0.0" } }
```
