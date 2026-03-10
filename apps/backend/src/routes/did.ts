import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// Simulated DID/VC system (Enhancement 1)
interface VerifiableCredential {
    id: string;
    type: "ContractorRegistration";
    issuer: string;
    subject: string;
    companyName: string;
    registrationNumber: string;
    issuedAt: string;
    expiresAt: string;
    signature: string;
    revoked: boolean;
}

const credentials: Map<string, VerifiableCredential> = new Map();

export async function didRoutes(app: FastifyInstance) {
    // ── Issue Verifiable Credential ────────────────────────────
    app.post("/issue-vc", {
        preHandler: [(app as any).authenticate],
        schema: {
            body: {
                type: "object",
                required: ["subjectWallet", "companyName", "registrationNumber"],
                properties: {
                    subjectWallet: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                    companyName: { type: "string", minLength: 2 },
                    registrationNumber: { type: "string", minLength: 3 },
                },
            },
        },
    }, async (request: FastifyRequest<{
        Body: { subjectWallet: string; companyName: string; registrationNumber: string }
    }>, reply: FastifyReply) => {
        const user = request.user as any;
        if (user.role !== "authority" && user.role !== "admin") {
            return reply.code(403).send({ success: false, error: "Only authorities can issue VCs" });
        }

        const { subjectWallet, companyName, registrationNumber } = request.body;
        const vcId = `vc_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const vc: VerifiableCredential = {
            id: vcId,
            type: "ContractorRegistration",
            issuer: user.wallet,
            subject: subjectWallet,
            companyName,
            registrationNumber,
            issuedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
            signature: `sim_sig_${vcId}`, // Simulated signature
            revoked: false,
        };

        credentials.set(vcId, vc);

        return reply.code(201).send({ success: true, data: vc });
    });

    // ── Verify Credential ──────────────────────────────────────
    app.get("/verify-vc/:vcId", async (request: FastifyRequest<{
        Params: { vcId: string }
    }>, reply: FastifyReply) => {
        const vc = credentials.get(request.params.vcId);
        if (!vc) {
            return reply.code(404).send({ success: false, error: "VC not found" });
        }

        const isValid = !vc.revoked && new Date(vc.expiresAt) > new Date();

        return {
            success: true,
            data: {
                valid: isValid,
                credential: vc,
                reason: vc.revoked ? "revoked" : new Date(vc.expiresAt) <= new Date() ? "expired" : "valid",
            },
        };
    });

    // ── Get Contractor Credentials ─────────────────────────────
    app.get("/credentials/:wallet", async (request: FastifyRequest<{
        Params: { wallet: string }
    }>) => {
        const walletCreds = Array.from(credentials.values()).filter(
            (vc) => vc.subject === request.params.wallet
        );

        return { success: true, data: walletCreds };
    });

    // ── Revoke Credential ──────────────────────────────────────
    app.post("/revoke-vc/:vcId", {
        preHandler: [(app as any).authenticate],
    }, async (request: FastifyRequest<{
        Params: { vcId: string }
    }>, reply: FastifyReply) => {
        const vc = credentials.get(request.params.vcId);
        if (!vc) {
            return reply.code(404).send({ success: false, error: "VC not found" });
        }

        vc.revoked = true;
        return { success: true, data: { vcId: vc.id, status: "revoked" } };
    });
}
