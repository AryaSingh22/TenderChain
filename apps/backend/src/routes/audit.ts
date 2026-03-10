import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// In-memory audit log for development
interface AuditEntry {
    id: number;
    timestamp: string;
    actor: string;
    actionType: string;
    relatedEntityId: number;
    dataHash: string;
    description: string;
}

const auditLogs: AuditEntry[] = [];
let logCounter = 0;

export function addAuditEntry(actor: string, actionType: string, entityId: number, dataHash: string, description: string) {
    logCounter++;
    auditLogs.push({
        id: logCounter,
        timestamp: new Date().toISOString(),
        actor,
        actionType,
        relatedEntityId: entityId,
        dataHash,
        description,
    });
}

export async function auditRoutes(app: FastifyInstance) {
    // ── Get Audit Logs (Public) ────────────────────────────────
    app.get("/logs", async (request: FastifyRequest<{
        Querystring: { page?: string; limit?: string; actionType?: string; entityId?: string }
    }>) => {
        const { page = "1", limit = "50", actionType, entityId } = request.query;
        let results = [...auditLogs];

        if (actionType) results = results.filter((l) => l.actionType === actionType);
        if (entityId) results = results.filter((l) => l.relatedEntityId === parseInt(entityId));

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const start = (pageNum - 1) * limitNum;

        return {
            success: true,
            data: results.slice(start, start + limitNum).reverse(),
            meta: { total: results.length, page: pageNum, limit: limitNum },
        };
    });

    // ── Get Single Log Entry ───────────────────────────────────
    app.get("/logs/:id", async (request: FastifyRequest<{
        Params: { id: string }
    }>, reply: FastifyReply) => {
        const entry = auditLogs.find((l) => l.id === parseInt(request.params.id));
        if (!entry) {
            return reply.code(404).send({ success: false, error: "Log entry not found" });
        }
        return { success: true, data: entry };
    });

    // ── Get Statistics ─────────────────────────────────────────
    app.get("/stats", async () => {
        const actionCounts: Record<string, number> = {};
        for (const log of auditLogs) {
            actionCounts[log.actionType] = (actionCounts[log.actionType] || 0) + 1;
        }

        return {
            success: true,
            data: {
                totalLogs: auditLogs.length,
                actionCounts,
                latestTimestamp: auditLogs.length > 0 ? auditLogs[auditLogs.length - 1].timestamp : null,
            },
        };
    });
}
