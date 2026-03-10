import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ethers } from "ethers";

// In-memory bid store for development
interface BidData {
    id: number;
    tenderId: number;
    bidder: string;
    encryptedPayload: string;
    commitment: string;
    amount?: string;
    payloadHash?: string;
    salt?: string;
    status: "PENDING_COMMIT" | "COMMITTED" | "REVEALED" | "FORFEITED";
    createdAt: string;
}

const bids: Map<string, BidData> = new Map(); // key: `${tenderId}-${bidder}`
let bidCounter = 0;

export async function bidRoutes(app: FastifyInstance) {
    // ── Get Authority Public Key for Encryption ────────────────
    app.get("/encryption-key/:tenderId", async (request: FastifyRequest<{
        Params: { tenderId: string }
    }>) => {
        // In production, generate per-tender ECIES keypair
        // For dev, return a mock public key
        return {
            success: true,
            data: {
                tenderId: request.params.tenderId,
                publicKey: "04" + "a".repeat(128), // Mock ECIES public key
                algorithm: "ECIES",
            },
        };
    });

    // ── Submit Encrypted Bid ───────────────────────────────────
    app.post("/submit", {
        preHandler: [(app as any).authenticate],
        schema: {
            body: {
                type: "object",
                required: ["tenderId", "encryptedPayload", "amount", "technicalProposalHash"],
                properties: {
                    tenderId: { type: "number" },
                    encryptedPayload: { type: "string" },
                    amount: { type: "string" },
                    technicalProposalHash: { type: "string" },
                    companyId: { type: "string" },
                },
            },
        },
    }, async (request: FastifyRequest<{
        Body: { tenderId: number; encryptedPayload: string; amount: string; technicalProposalHash: string; companyId?: string }
    }>, reply: FastifyReply) => {
        const user = request.user as any;
        const { tenderId, encryptedPayload, amount, technicalProposalHash, companyId } = request.body;

        const key = `${tenderId}-${user.wallet}`;
        if (bids.has(key)) {
            return reply.code(409).send({ success: false, error: "Bid already submitted for this tender" });
        }

        // Generate commitment hash (in production, held in memory only)
        const salt = ethers.hexlify(ethers.randomBytes(32));
        const payloadHash = ethers.keccak256(
            ethers.toUtf8Bytes(JSON.stringify({ amount, technicalProposalHash, companyId }))
        );
        const commitment = ethers.keccak256(
            ethers.solidityPacked(
                ["address", "uint256", "bytes32", "bytes32"],
                [user.wallet, tenderId, payloadHash, salt]
            )
        );

        bidCounter++;
        const bid: BidData = {
            id: bidCounter,
            tenderId,
            bidder: user.wallet,
            encryptedPayload,
            commitment,
            amount,
            payloadHash,
            salt,
            status: "COMMITTED",
            createdAt: new Date().toISOString(),
        };

        bids.set(key, bid);

        return reply.code(201).send({
            success: true,
            data: {
                bidId: bid.id,
                commitment,
                status: "COMMITTED",
                message: "Bid committed successfully. Save your salt for verification.",
                salt, // In production, securely transmitted to bidder only
            },
        });
    });

    // ── Get My Bids ────────────────────────────────────────────
    app.get("/my-bids", {
        preHandler: [(app as any).authenticate],
    }, async (request: FastifyRequest) => {
        const user = request.user as any;
        const myBids = Array.from(bids.values()).filter((b) => b.bidder === user.wallet);
        return {
            success: true,
            data: myBids.map((b) => ({
                id: b.id,
                tenderId: b.tenderId,
                status: b.status,
                commitment: b.commitment,
                createdAt: b.createdAt,
            })),
        };
    });

    // ── Get Bidders for Tender (Evaluators) ────────────────────
    app.get("/tender/:tenderId/bidders", {
        preHandler: [(app as any).authenticate],
    }, async (request: FastifyRequest<{
        Params: { tenderId: string }
    }>, reply: FastifyReply) => {
        const user = request.user as any;
        if (user.role !== "authority" && user.role !== "admin") {
            return reply.code(403).send({ success: false, error: "Only evaluators can view bidder list" });
        }

        const tenderId = parseInt(request.params.tenderId);
        const tenderBids = Array.from(bids.values()).filter((b) => b.tenderId === tenderId);

        return {
            success: true,
            data: tenderBids.map((b) => ({
                bidder: b.bidder,
                status: b.status,
                commitment: b.commitment,
                amount: b.status === "REVEALED" ? b.amount : undefined,
            })),
        };
    });

    // ── Verify Commitment (Public) ─────────────────────────────
    app.get("/verify/:tenderId/:commitment", async (request: FastifyRequest<{
        Params: { tenderId: string; commitment: string }
    }>) => {
        const tenderId = parseInt(request.params.tenderId);
        const found = Array.from(bids.values()).find(
            (b) => b.tenderId === tenderId && b.commitment === request.params.commitment
        );

        return {
            success: true,
            data: {
                valid: !!found,
                tenderId,
                commitment: request.params.commitment,
                timestamp: found?.createdAt,
            },
        };
    });
}
