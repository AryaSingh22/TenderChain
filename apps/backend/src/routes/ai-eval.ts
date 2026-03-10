import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// Simulated AI Evaluation Assistant (Enhancement 5)
interface AIEvaluation {
    id: number;
    tenderId: number;
    evaluations: BidEvaluation[];
    summary: string;
    recommendation: string;
    generatedAt: string;
    requestedBy: string;
}

interface BidEvaluation {
    bidder: string;
    priceScore: number;    // 0-100
    technicalScore: number; // 0-100
    overallScore: number;   // 0-100
    strengths: string[];
    concerns: string[];
}

const aiEvaluations: Map<number, AIEvaluation> = new Map();
let evalCounter = 0;

export async function aiEvalRoutes(app: FastifyInstance) {
    // ── Generate AI Evaluation ─────────────────────────────────
    app.post("/evaluate", {
        preHandler: [(app as any).authenticate],
        schema: {
            body: {
                type: "object",
                required: ["tenderId"],
                properties: {
                    tenderId: { type: "number" },
                    bids: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                bidder: { type: "string" },
                                amount: { type: "string" },
                                technicalProposalHash: { type: "string" },
                            },
                        },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{
        Body: { tenderId: number; bids?: Array<{ bidder: string; amount: string; technicalProposalHash: string }> }
    }>, reply: FastifyReply) => {
        const user = request.user as any;
        if (user.role !== "authority" && user.role !== "admin") {
            return reply.code(403).send({ success: false, error: "Only evaluators can request AI evaluation" });
        }

        const { tenderId, bids = [] } = request.body;

        // Simulated AI analysis (would call Anthropic Claude in production)
        const evaluations: BidEvaluation[] = bids.map((bid, i) => ({
            bidder: bid.bidder,
            priceScore: Math.floor(Math.random() * 30) + 70,
            technicalScore: Math.floor(Math.random() * 30) + 70,
            overallScore: Math.floor(Math.random() * 25) + 75,
            strengths: [
                "Competitive pricing relative to market rates",
                "Strong technical methodology outlined",
                "Previous experience in similar projects",
            ].slice(0, Math.floor(Math.random() * 2) + 1),
            concerns: [
                "Timeline may be optimistic",
                "Limited local workforce capacity",
            ].slice(0, Math.floor(Math.random() * 2)),
        }));

        // Sort by overall score
        evaluations.sort((a, b) => b.overallScore - a.overallScore);

        evalCounter++;
        const aiEval: AIEvaluation = {
            id: evalCounter,
            tenderId,
            evaluations,
            summary: `AI evaluation completed for tender #${tenderId}. Analyzed ${bids.length} bids across price competitiveness, technical merit, and track record. Top-ranked bidder: ${evaluations[0]?.bidder || "N/A"}.`,
            recommendation: evaluations.length > 0
                ? `Based on the analysis, ${evaluations[0].bidder} shows the strongest overall profile with a score of ${evaluations[0].overallScore}/100. However, this is advisory only — final decision rests with the evaluation panel.`
                : "No bids to evaluate.",
            generatedAt: new Date().toISOString(),
            requestedBy: user.wallet,
        };

        aiEvaluations.set(evalCounter, aiEval);

        return reply.code(201).send({
            success: true,
            data: aiEval,
            disclaimer: "AI scores are advisory only. The final decision is always a human action.",
        });
    });

    // ── Get AI Evaluation ──────────────────────────────────────
    app.get("/:id", {
        preHandler: [(app as any).authenticate],
    }, async (request: FastifyRequest<{
        Params: { id: string }
    }>, reply: FastifyReply) => {
        const evalItem = aiEvaluations.get(parseInt(request.params.id));
        if (!evalItem) {
            return reply.code(404).send({ success: false, error: "Evaluation not found" });
        }
        return { success: true, data: evalItem };
    });

    // ── Get Evaluations for Tender ─────────────────────────────
    app.get("/tender/:tenderId", {
        preHandler: [(app as any).authenticate],
    }, async (request: FastifyRequest<{
        Params: { tenderId: string }
    }>) => {
        const tenderId = parseInt(request.params.tenderId);
        const evals = Array.from(aiEvaluations.values()).filter((e) => e.tenderId === tenderId);
        return { success: true, data: evals };
    });
}
