import Fastify from "fastify";
import jwt from "@fastify/jwt";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { auditRoutes } from "../routes/audit";

async function buildTestApp() {
    const app = Fastify({ logger: false });
    await app.register(helmet, { contentSecurityPolicy: false });
    await app.register(cors, { origin: "http://localhost:3000", credentials: true });
    await app.register(rateLimit, { max: 1000, timeWindow: "1 minute" });
    await app.register(jwt, { secret: "test-secret", sign: { expiresIn: "4h" } });
    app.decorate("authenticate", async (request: any, reply: any) => {
        try { await request.jwtVerify(); } catch { reply.code(401).send({ success: false, error: "Unauthorized" }); }
    });
    await app.register(auditRoutes, { prefix: "/api/audit" });
    await app.ready();
    return app;
}

describe("Audit Routes", () => {
    let app: any;

    beforeAll(async () => { app = await buildTestApp(); });
    afterAll(async () => { await app.close(); });

    it("GET /api/audit/logs — returns 200 with list", async () => {
        const res = await app.inject({ method: "GET", url: "/api/audit/logs" });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data).toBeInstanceOf(Array);
    });

    it("GET /api/audit/logs — supports pagination", async () => {
        const res = await app.inject({ method: "GET", url: "/api/audit/logs?page=1&limit=10" });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).meta.limit).toBe(10);
    });

    it("GET /api/audit/logs/:id — non-existent returns 404", async () => {
        const res = await app.inject({ method: "GET", url: "/api/audit/logs/9999" });
        expect(res.statusCode).toBe(404);
    });

    it("GET /api/audit/stats — returns 200 with statistics", async () => {
        const res = await app.inject({ method: "GET", url: "/api/audit/stats" });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.data).toHaveProperty("totalLogs");
        expect(body.data).toHaveProperty("actionCounts");
    });

    it("GET /api/audit/logs — public access without auth", async () => {
        const res = await app.inject({ method: "GET", url: "/api/audit/logs" });
        expect(res.statusCode).toBe(200);
    });
});
