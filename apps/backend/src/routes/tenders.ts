import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// In-memory tender store for development
interface TenderData {
    id: number;
    title: string;
    description: string;
    ipfsDocumentHash: string;
    submissionDeadline: string;
    revealDeadline: string;
    eligibilityCriteriaHash: string;
    minimumBidAmount: string;
    estimatedProjectValue: string;
    status: string;
    authority: string;
    createdAt: string;
}

const tenders: Map<number, TenderData> = new Map();
let tenderCounter = 0;

export async function tenderRoutes(app: FastifyInstance) {
    // ── Create Tender ──────────────────────────────────────────
    app.post("/", {
        preHandler: [(app as any).authenticate],
        schema: {
            body: {
                type: "object",
                required: ["title", "description", "ipfsDocumentHash", "submissionDeadline", "revealDeadline", "minimumBidAmount"],
                properties: {
                    title: { type: "string", minLength: 5 },
                    description: { type: "string", minLength: 10 },
                    ipfsDocumentHash: { type: "string" },
                    submissionDeadline: { type: "string" },
                    revealDeadline: { type: "string" },
                    eligibilityCriteriaHash: { type: "string" },
                    minimumBidAmount: { type: "string" },
                    estimatedProjectValue: { type: "string" },
                },
            },
        },
    }, async (request: FastifyRequest<{ Body: Partial<TenderData> }>, reply: FastifyReply) => {
        const user = request.user as any;
        if (user.role !== "authority" && user.role !== "admin") {
            return reply.code(403).send({ success: false, error: "Only authorities can create tenders" });
        }

        tenderCounter++;
        const tender: TenderData = {
            id: tenderCounter,
            title: request.body.title!,
            description: request.body.description!,
            ipfsDocumentHash: request.body.ipfsDocumentHash!,
            submissionDeadline: request.body.submissionDeadline!,
            revealDeadline: request.body.revealDeadline!,
            eligibilityCriteriaHash: request.body.eligibilityCriteriaHash || "",
            minimumBidAmount: request.body.minimumBidAmount!,
            estimatedProjectValue: request.body.estimatedProjectValue || "0",
            status: "DRAFT",
            authority: user.wallet,
            createdAt: new Date().toISOString(),
        };

        tenders.set(tenderCounter, tender);
        return reply.code(201).send({ success: true, data: tender });
    });

    // ── List Tenders ───────────────────────────────────────────
    app.get("/", async (request: FastifyRequest<{
        Querystring: { status?: string; page?: string; limit?: string }
    }>) => {
        const { status, page = "1", limit = "20" } = request.query;
        let results = Array.from(tenders.values());

        if (status) {
            results = results.filter((t) => t.status === status);
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const start = (pageNum - 1) * limitNum;
        const paginated = results.slice(start, start + limitNum);

        return {
            success: true,
            data: paginated,
            meta: { total: results.length, page: pageNum, limit: limitNum },
        };
    });

    // ── Get Tender by ID ───────────────────────────────────────
    app.get("/:id", async (request: FastifyRequest<{
        Params: { id: string }
    }>, reply: FastifyReply) => {
        const tender = tenders.get(parseInt(request.params.id));
        if (!tender) {
            return reply.code(404).send({ success: false, error: "Tender not found" });
        }
        return { success: true, data: tender };
    });

    // ── Publish Tender ─────────────────────────────────────────
    app.post("/:id/publish", {
        preHandler: [(app as any).authenticate],
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const tender = tenders.get(parseInt(request.params.id));
        if (!tender) return reply.code(404).send({ success: false, error: "Tender not found" });
        if (tender.status !== "DRAFT") return reply.code(400).send({ success: false, error: "Tender must be in DRAFT status" });

        tender.status = "PUBLISHED";
        return { success: true, data: tender };
    });

    // ── Close Tender ───────────────────────────────────────────
    app.post("/:id/close", {
        preHandler: [(app as any).authenticate],
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const tender = tenders.get(parseInt(request.params.id));
        if (!tender) return reply.code(404).send({ success: false, error: "Tender not found" });
        if (tender.status !== "PUBLISHED") return reply.code(400).send({ success: false, error: "Tender must be PUBLISHED" });

        tender.status = "CLOSED";
        return { success: true, data: tender };
    });

    // ── Start Evaluation ───────────────────────────────────────
    app.post("/:id/evaluate", {
        preHandler: [(app as any).authenticate],
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const tender = tenders.get(parseInt(request.params.id));
        if (!tender) return reply.code(404).send({ success: false, error: "Tender not found" });
        if (tender.status !== "CLOSED") return reply.code(400).send({ success: false, error: "Tender must be CLOSED" });

        tender.status = "EVALUATION";
        return { success: true, data: tender };
    });

    // ── Award Tender ───────────────────────────────────────────
    app.post("/:id/award", {
        preHandler: [(app as any).authenticate],
        schema: {
            body: {
                type: "object",
                required: ["winnerAddress"],
                properties: { winnerAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } },
            },
        },
    }, async (request: FastifyRequest<{
        Params: { id: string }; Body: { winnerAddress: string }
    }>, reply: FastifyReply) => {
        const tender = tenders.get(parseInt(request.params.id));
        if (!tender) return reply.code(404).send({ success: false, error: "Tender not found" });
        if (tender.status !== "EVALUATION") return reply.code(400).send({ success: false, error: "Tender must be in EVALUATION" });

        tender.status = "AWARDED";
        return { success: true, data: { ...tender, awardedTo: request.body.winnerAddress } };
    });

    // ── Cancel Tender ──────────────────────────────────────────
    app.post("/:id/cancel", {
        preHandler: [(app as any).authenticate],
        schema: {
            body: {
                type: "object",
                required: ["reason"],
                properties: { reason: { type: "string", minLength: 5 } },
            },
        },
    }, async (request: FastifyRequest<{
        Params: { id: string }; Body: { reason: string }
    }>, reply: FastifyReply) => {
        const tender = tenders.get(parseInt(request.params.id));
        if (!tender) return reply.code(404).send({ success: false, error: "Tender not found" });
        if (tender.status === "AWARDED" || tender.status === "CANCELLED") {
            return reply.code(400).send({ success: false, error: "Cannot cancel" });
        }

        tender.status = "CANCELLED";
        return { success: true, data: { ...tender, cancellationReason: request.body.reason } };
    });
}
