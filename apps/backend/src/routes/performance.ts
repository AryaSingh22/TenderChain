import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// In-memory performance records for development
interface PerfRecord {
    id: number;
    tenderId: number;
    contractor: string;
    score: number;
    comments: string;
    recordedBy: string;
    createdAt: string;
}

const records: PerfRecord[] = [];
let recordCounter = 0;

export async function performanceRoutes(app: FastifyInstance) {
    // ── Record Performance ─────────────────────────────────────
    app.post("/", {
        preHandler: [(app as any).authenticate],
        schema: {
            body: {
                type: "object",
                required: ["tenderId", "contractor", "score", "comments"],
                properties: {
                    tenderId: { type: "number" },
                    contractor: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                    score: { type: "number", minimum: 1, maximum: 100 },
                    comments: { type: "string", minLength: 5 },
                },
            },
        },
    }, async (request: FastifyRequest<{
        Body: { tenderId: number; contractor: string; score: number; comments: string }
    }>, reply: FastifyReply) => {
        const user = request.user as any;
        if (user.role !== "authority" && user.role !== "admin") {
            return reply.code(403).send({ success: false, error: "Only authorities can record performance" });
        }

        const { tenderId, contractor, score, comments } = request.body;

        // Check duplicate
        if (records.find((r) => r.tenderId === tenderId && r.contractor === contractor)) {
            return reply.code(409).send({ success: false, error: "Performance already recorded for this tender+contractor" });
        }

        recordCounter++;
        const record: PerfRecord = {
            id: recordCounter,
            tenderId,
            contractor,
            score,
            comments,
            recordedBy: user.wallet,
            createdAt: new Date().toISOString(),
        };
        records.push(record);

        return reply.code(201).send({ success: true, data: record });
    });

    // ── Get Contractor Records ─────────────────────────────────
    app.get("/contractor/:wallet", async (request: FastifyRequest<{
        Params: { wallet: string }
    }>) => {
        const contractorRecords = records.filter((r) => r.contractor === request.params.wallet);
        const avgScore = contractorRecords.length > 0
            ? Math.round(contractorRecords.reduce((sum, r) => sum + r.score, 0) / contractorRecords.length)
            : 0;

        return {
            success: true,
            data: {
                contractor: request.params.wallet,
                averageScore: avgScore,
                totalRecords: contractorRecords.length,
                records: contractorRecords,
            },
        };
    });

    // ── Get All Records ────────────────────────────────────────
    app.get("/", async () => {
        return { success: true, data: records };
    });
}
