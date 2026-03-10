// ============================================================
// TenderChain Backend — Main Server Entry Point
// Fastify REST API bridging frontend, blockchain, and off-chain storage
// ============================================================

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import dotenv from "dotenv";

import { authRoutes } from "./routes/auth";
import { tenderRoutes } from "./routes/tenders";
import { bidRoutes } from "./routes/bids";
import { auditRoutes } from "./routes/audit";
import { notificationRoutes } from "./routes/notifications";
import { didRoutes } from "./routes/did";
import { aiEvalRoutes } from "./routes/ai-eval";
import { performanceRoutes } from "./routes/performance";
import { wsHandler } from "./ws/handler";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function buildServer() {
    const app = Fastify({
        logger: {
            level: "info",
            transport: {
                target: "pino-pretty",
                options: { colorize: true },
            },
        },
    });

    // ── Security Plugins ──────────────────────────────────────
    await app.register(helmet, {
        contentSecurityPolicy: false,
    });

    await app.register(cors, {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true,
    });

    await app.register(rateLimit, {
        max: 100,
        timeWindow: "1 minute",
    });

    // ── JWT ────────────────────────────────────────────────────
    await app.register(jwt, {
        secret: process.env.JWT_SECRET || "dev-secret-change-me",
        sign: { expiresIn: "4h" },
    });

    // ── WebSocket ──────────────────────────────────────────────
    await app.register(websocket);

    // ── Authentication Decorator ───────────────────────────────
    app.decorate("authenticate", async (request: any, reply: any) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.code(401).send({ success: false, error: "Unauthorized" });
        }
    });

    // ── Routes ─────────────────────────────────────────────────
    await app.register(authRoutes, { prefix: "/api/auth" });
    await app.register(tenderRoutes, { prefix: "/api/tenders" });
    await app.register(bidRoutes, { prefix: "/api/bids" });
    await app.register(auditRoutes, { prefix: "/api/audit" });
    await app.register(notificationRoutes, { prefix: "/api/notifications" });
    await app.register(didRoutes, { prefix: "/api/did" });
    await app.register(aiEvalRoutes, { prefix: "/api/ai-eval" });
    await app.register(performanceRoutes, { prefix: "/api/performance" });

    // ── WebSocket Route ────────────────────────────────────────
    app.register(wsHandler);

    // ── Health Check ───────────────────────────────────────────
    app.get("/api/health", async () => ({
        success: true,
        data: {
            status: "healthy",
            timestamp: new Date().toISOString(),
            version: "1.0.0",
        },
    }));

    return app;
}

async function main() {
    const app = await buildServer();

    try {
        await app.listen({ port: PORT, host: HOST });
        console.log(`\n  🏛️  TenderChain API running at http://${HOST}:${PORT}`);
        console.log(`  📡 WebSocket at ws://${HOST}:${PORT}/ws`);
        console.log(`  📋 Health check: http://${HOST}:${PORT}/api/health\n`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

main();

export { buildServer };
