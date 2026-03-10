// ============================================================
// TenderChain Shared Types
// Common type definitions used across all packages
// ============================================================

/** Tender lifecycle status */
export enum TenderStatus {
    DRAFT = 0,
    PUBLISHED = 1,
    CLOSED = 2,
    EVALUATION = 3,
    AWARDED = 4,
    CANCELLED = 5,
}

/** Audit log action types */
export enum ActionType {
    TENDER_CREATED = 0,
    TENDER_PUBLISHED = 1,
    TENDER_CANCELLED = 2,
    BID_COMMITTED = 3,
    BID_REVEALED = 4,
    BID_FORFEITED = 5,
    EVALUATION_STARTED = 6,
    EVALUATION_COMPLETED = 7,
    TENDER_AWARDED = 8,
    APPEAL_FILED = 9,
    APPEAL_RESOLVED = 10,
    AI_EVALUATION_GENERATED = 11,
}

/** Dispute/Appeal status */
export enum AppealStatus {
    FILED = 0,
    UNDER_REVIEW = 1,
    APPROVED = 2,
    REJECTED = 3,
}

/** On-chain Tender struct */
export interface Tender {
    tenderId: bigint;
    ipfsDocumentHash: string;
    procurementAuthority: string;
    submissionDeadline: bigint;
    revealDeadline: bigint;
    status: TenderStatus;
    eligibilityCriteriaHash: string;
    minimumBidAmount: bigint;
    estimatedProjectValue: bigint;
}

/** Revealed bid data */
export interface RevealedBid {
    bidder: string;
    amount: bigint;
    payloadHash: string;
    revealed: boolean;
    timestamp: bigint;
}

/** Audit log entry */
export interface LogEntry {
    logId: bigint;
    timestamp: bigint;
    actor: string;
    actionType: ActionType;
    relatedEntityId: bigint;
    dataHash: string;
}

/** API response wrapper */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

/** JWT payload */
export interface JwtPayload {
    sub: string;
    role: "authority" | "contractor" | "auditor" | "admin";
    wallet: string;
    iat: number;
    exp: number;
}

/** Bid submission request */
export interface BidSubmissionRequest {
    tenderId: number;
    encryptedPayload: string;
    amount: string;
    technicalProposalHash: string;
    companyId: string;
}

/** Performance record */
export interface PerformanceRecord {
    tenderId: bigint;
    contractor: string;
    score: number;
    comments: string;
    recordedBy: string;
    timestamp: bigint;
}
