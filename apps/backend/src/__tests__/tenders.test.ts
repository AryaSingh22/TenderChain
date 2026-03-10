import Fastify from "fastify";
import jwt from "@fastify/jwt";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "../routes/auth";
import { tenderRoutes } from "../routes/tenders";

async function buildTestApp() {
    const app = Fastify({ logger: false });
    await app.register(helmet, { contentSecurityPolicy: false });
    await app.register(cors, { origin: "http://localhost:3000", credentials: true });
    await app.register(rateLimit, { max: 1000, timeWindow: "1 minute" });
    await app.register(jwt, { secret: "test-secret", sign: { expiresIn: "4h" } });
    app.decorate("authenticate", async (request: any, reply: any) => {
        try { await request.jwtVerify(); } catch { reply.code(401).send({ success: false, error: "Unauthorized" }); }
    });
    await app.register(authRoutes, { prefix: "/api/auth" });
    await app.register(tenderRoutes, { prefix: "/api/tenders" });
    await app.ready();
    return app;
}

async function getToken(app: any, role = "authority", email = `t-${Date.now()}@test.com`) {
    const res = await app.inject({
        method: "POST", url: "/api/auth/register",
        payload: { email, password: "password123", role, wallet: "0x" + Math.random().toString(16).slice(2, 42).padEnd(40, "0"), name: "Test" },
    });
    return JSON.parse(res.body).data.token;
}

describe("Tender Routes", () => {
    let app: any;
    let authorityToken: string;
    let contractorToken: string;

    beforeAll(async () => {
        app = await buildTestApp();
        authorityToken = await getToken(app, "authority");
        contractorToken = await getToken(app, "contractor");
    });
    afterAll(async () => { await app.close(); });

    it("POST /api/tenders — authority creates tender, returns 201", async () => {
        const res = await app.inject({
            method: "POST", url: "/api/tenders",
            headers: { authorization: `Bearer ${authorityToken}` },
            payload: { title: "Build Highway", description: "Build a 10km highway section", ipfsDocumentHash: "Qm123", submissionDeadline: "2025-12-01", revealDeadline: "2025-12-15", minimumBidAmount: "1000", estimatedProjectValue: "1000000" },
        });
        expect(res.statusCode).toBe(201);
        expect(JSON.parse(res.body).data.id).toBeDefined();
    });

    it("POST /api/tenders — without JWT returns 401", async () => {
        const res = await app.inject({
            method: "POST", url: "/api/tenders",
            payload: { title: "Test Tender", description: "Long enough desc", ipfsDocumentHash: "Qm", submissionDeadline: "2025-12-01", revealDeadline: "2025-12-15", minimumBidAmount: "100" },
        });
        expect(res.statusCode).toBe(401);
    });

    it("POST /api/tenders — contractor JWT returns 403", async () => {
        const res = await app.inject({
            method: "POST", url: "/api/tenders",
            headers: { authorization: `Bearer ${contractorToken}` },
            payload: { title: "Test Tender", description: "Long enough desc", ipfsDocumentHash: "Qm", submissionDeadline: "2025-12-01", revealDeadline: "2025-12-15", minimumBidAmount: "100" },
        });
        expect(res.statusCode).toBe(403);
    });

    it("POST /api/tenders — missing fields returns 400", async () => {
        const res = await app.inject({
            method: "POST", url: "/api/tenders",
            headers: { authorization: `Bearer ${authorityToken}` },
            payload: { title: "Short" },
        });
        expect(res.statusCode).toBe(400);
    });

    it("GET /api/tenders — returns 200 with paginated list", async () => {
        const res = await app.inject({ method: "GET", url: "/api/tenders" });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.data).toBeInstanceOf(Array);
        expect(body.meta.page).toBe(1);
    });

    it("GET /api/tenders?page=1&limit=5 — respects pagination", async () => {
        const res = await app.inject({ method: "GET", url: "/api/tenders?page=1&limit=5" });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).meta.limit).toBe(5);
    });

    it("GET /api/tenders/:id — existing tender returns 200", async () => {
        const res = await app.inject({ method: "GET", url: "/api/tenders/1" });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).data.title).toBeDefined();
    });

    it("GET /api/tenders/:id — non-existent returns 404", async () => {
        const res = await app.inject({ method: "GET", url: "/api/tenders/9999" });
        expect(res.statusCode).toBe(404);
    });

    it("POST /api/tenders/:id/publish — authority publishes, returns 200", async () => {
        const res = await app.inject({
            method: "POST", url: "/api/tenders/1/publish",
            headers: { authorization: `Bearer ${authorityToken}` },
        });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).data.status).toBe("PUBLISHED");
    });

    it("POST /api/tenders/:id/publish — already published returns 400", async () => {
        const res = await app.inject({
            method: "POST", url: "/api/tenders/1/publish",
            headers: { authorization: `Bearer ${authorityToken}` },
        });
        expect(res.statusCode).toBe(400);
    });
});
