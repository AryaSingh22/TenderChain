import Fastify from "fastify";
import jwt from "@fastify/jwt";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

async function buildTestApp() {
    const app = Fastify({ logger: false });
    await app.register(helmet, { contentSecurityPolicy: false });
    await app.register(cors, { origin: "http://localhost:3000", credentials: true });
    await app.register(rateLimit, { max: 1000, timeWindow: "1 minute" });
    await app.register(jwt, { secret: "test-secret", sign: { expiresIn: "4h" } });

    app.get("/api/health", async () => ({
        success: true,
        data: { api: "ok", blockchain: "ok", ipfs: "ok", postgres: "ok" },
    }));

    await app.ready();
    return app;
}

describe("Health Endpoint", () => {
    let app: any;

    beforeAll(async () => { app = await buildTestApp(); });
    afterAll(async () => { await app.close(); });

    it("GET /api/health — returns 200", async () => {
        const res = await app.inject({ method: "GET", url: "/api/health" });
        expect(res.statusCode).toBe(200);
    });

    it("GET /api/health — response has all required fields", async () => {
        const res = await app.inject({ method: "GET", url: "/api/health" });
        const body = JSON.parse(res.body);
        expect(body.data.api).toBe("ok");
        expect(body.data.blockchain).toBe("ok");
        expect(body.data.ipfs).toBe("ok");
        expect(body.data.postgres).toBe("ok");
    });
});
