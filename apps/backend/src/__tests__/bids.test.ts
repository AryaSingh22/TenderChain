import Fastify from "fastify";
import jwt from "@fastify/jwt";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "../routes/auth";
import { bidRoutes } from "../routes/bids";

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
    await app.register(bidRoutes, { prefix: "/api/bids" });
    await app.ready();
    return app;
}

async function getToken(app: any, role = "contractor") {
    const res = await app.inject({
        method: "POST", url: "/api/auth/register",
        payload: { email: `b-${Date.now()}-${Math.random()}@test.com`, password: "password123", role, wallet: "0x" + Math.random().toString(16).slice(2, 42).padEnd(40, "0"), name: "Bidder" },
    });
    return JSON.parse(res.body).data.token;
}

describe("Bid Routes", () => {
    let app: any;
    let token: string;

    beforeAll(async () => {
        app = await buildTestApp();
        token = await getToken(app);
    });
    afterAll(async () => { await app.close(); });

    it("POST /api/bids/submit — valid bid returns 201", async () => {
        const res = await app.inject({
            method: "POST", url: "/api/bids/submit",
            headers: { authorization: `Bearer ${token}` },
            payload: { tenderId: 1, encryptedPayload: "encrypted_data_here", amount: "5000", technicalProposalHash: "Qmabc123" },
        });
        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.data.commitment).toBeDefined();
        expect(body.data.salt).toBeDefined();
    });

    it("POST /api/bids/submit — without JWT returns 401", async () => {
        const res = await app.inject({
            method: "POST", url: "/api/bids/submit",
            payload: { tenderId: 1, encryptedPayload: "data", amount: "5000", technicalProposalHash: "Qm" },
        });
        expect(res.statusCode).toBe(401);
    });

    it("POST /api/bids/submit — duplicate commitment returns 409", async () => {
        const res = await app.inject({
            method: "POST", url: "/api/bids/submit",
            headers: { authorization: `Bearer ${token}` },
            payload: { tenderId: 1, encryptedPayload: "data", amount: "5000", technicalProposalHash: "Qm" },
        });
        expect(res.statusCode).toBe(409);
    });

    it("GET /api/bids/my-bids — with JWT returns 200", async () => {
        const res = await app.inject({
            method: "GET", url: "/api/bids/my-bids",
            headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).data).toBeInstanceOf(Array);
    });

    it("GET /api/bids/my-bids — without JWT returns 401", async () => {
        const res = await app.inject({ method: "GET", url: "/api/bids/my-bids" });
        expect(res.statusCode).toBe(401);
    });

    it("GET /api/bids/encryption-key/:tenderId — returns public key", async () => {
        const res = await app.inject({ method: "GET", url: "/api/bids/encryption-key/1" });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).data.publicKey).toBeDefined();
    });

    it("GET /api/bids/verify/:tenderId/:commitment — returns verification", async () => {
        const res = await app.inject({ method: "GET", url: "/api/bids/verify/1/0xabc123" });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).data).toHaveProperty("valid");
    });
});
