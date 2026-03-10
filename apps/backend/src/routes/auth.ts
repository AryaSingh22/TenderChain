import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";

// In-memory user store for development (replace with Prisma in production)
const users: Map<string, { id: string; email: string; password: string; role: string; wallet: string; name: string }> = new Map();
const refreshTokens: Set<string> = new Set();

export async function authRoutes(app: FastifyInstance) {
    // Rate limit auth routes to 20/min
    app.addHook("onRequest", async (request) => {
        // Auth-specific rate limiting handled by route-level config
    });

    // ── Register ───────────────────────────────────────────────
    app.post("/register", {
        schema: {
            body: {
                type: "object",
                required: ["email", "password", "role", "wallet", "name"],
                properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 8 },
                    role: { type: "string", enum: ["authority", "contractor", "auditor"] },
                    wallet: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
                    name: { type: "string", minLength: 2 },
                },
            },
        },
    }, async (request: FastifyRequest<{
        Body: { email: string; password: string; role: string; wallet: string; name: string }
    }>, reply: FastifyReply) => {
        const { email, password, role, wallet, name } = request.body;

        if (users.has(email)) {
            return reply.code(409).send({ success: false, error: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const id = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        users.set(email, { id, email, password: hashedPassword, role, wallet, name });

        const token = app.jwt.sign({ sub: id, role, wallet });
        const refreshToken = app.jwt.sign({ sub: id, type: "refresh" }, { expiresIn: "7d" });
        refreshTokens.add(refreshToken);

        return reply.code(201).send({
            success: true,
            data: { token, refreshToken, user: { id, email, role, wallet, name } },
        });
    });

    // ── Login ──────────────────────────────────────────────────
    app.post("/login", {
        schema: {
            body: {
                type: "object",
                required: ["email", "password"],
                properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                },
            },
        },
    }, async (request: FastifyRequest<{
        Body: { email: string; password: string }
    }>, reply: FastifyReply) => {
        const { email, password } = request.body;
        const user = users.get(email);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return reply.code(401).send({ success: false, error: "Invalid credentials" });
        }

        const token = app.jwt.sign({ sub: user.id, role: user.role, wallet: user.wallet });
        const refreshToken = app.jwt.sign({ sub: user.id, type: "refresh" }, { expiresIn: "7d" });
        refreshTokens.add(refreshToken);

        return { success: true, data: { token, refreshToken, user: { id: user.id, email: user.email, role: user.role, wallet: user.wallet, name: user.name } } };
    });

    // ── Refresh Token ──────────────────────────────────────────
    app.post("/refresh", {
        schema: {
            body: {
                type: "object",
                required: ["refreshToken"],
                properties: { refreshToken: { type: "string" } },
            },
        },
    }, async (request: FastifyRequest<{
        Body: { refreshToken: string }
    }>, reply: FastifyReply) => {
        const { refreshToken } = request.body;

        if (!refreshTokens.has(refreshToken)) {
            return reply.code(401).send({ success: false, error: "Invalid refresh token" });
        }

        try {
            const decoded: any = app.jwt.verify(refreshToken);
            refreshTokens.delete(refreshToken); // Rotation: invalidate old token

            const newToken = app.jwt.sign({ sub: decoded.sub, role: decoded.role, wallet: decoded.wallet });
            const newRefreshToken = app.jwt.sign({ sub: decoded.sub, type: "refresh" }, { expiresIn: "7d" });
            refreshTokens.add(newRefreshToken);

            return { success: true, data: { token: newToken, refreshToken: newRefreshToken } };
        } catch {
            return reply.code(401).send({ success: false, error: "Expired refresh token" });
        }
    });

    // ── Profile ────────────────────────────────────────────────
    app.get("/profile", {
        preHandler: [(app as any).authenticate],
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as any;
        return { success: true, data: { sub: user.sub, role: user.role, wallet: user.wallet } };
    });
}
