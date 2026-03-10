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

    app.get("/api/health", async () => ({
        success: true,
        data: { api: "ok", blockchain: "ok", ipfs: "ok", postgres: "ok" },
    }));

    await app.ready();
    return app;
}

describe("Auth Routes", () => {
    let app: any;

    beforeAll(async () => { app = await buildTestApp(); });
    afterAll(async () => { await app.close(); });

    it("POST /api/auth/register — returns 201 with token", async () => {
        const res = await app.inject({
            method: "POST", url: "/api/auth/register",
            payload: { email: "auth@test.com", password: "password123", role: "authority", wallet: "0x" + "a".repeat(40), name: "Test Auth" },
        });
        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.token).toBeDefined();
    });

    it("POST /api/auth/register — duplicate email returns 409", async () => {
        await app.inject({
            method: "POST", url: "/api/auth/register",
            payload: { email: "dup@test.com", password: "password123", role: "authority", wallet: "0x" + "b".repeat(40), name: "Dup" },
        });
        const res = await app.inject({
            method: "POST", url: "/api/auth/register",
            payload: { email: "dup@test.com", password: "password123", role: "authority", wallet: "0x" + "c".repeat(40), name: "Dup2" },
        });
        expect(res.statusCode).toBe(409);
    });

    it("POST /api/auth/login — valid credentials returns token", async () => {
        await app.inject({
            method: "POST", url: "/api/auth/register",
            payload: { email: "login@test.com", password: "password123", role: "authority", wallet: "0x" + "d".repeat(40), name: "Login" },
        });
        const res = await app.inject({
            method: "POST", url: "/api/auth/login",
            payload: { email: "login@test.com", password: "password123" },
        });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).data.token).toBeDefined();
    });

    it("POST /api/auth/login — invalid password returns 401", async () => {
        const res = await app.inject({
            method: "POST", url: "/api/auth/login",
            payload: { email: "login@test.com", password: "wrongpassword" },
        });
        expect(res.statusCode).toBe(401);
    });

    it("POST /api/auth/login — non-existent user returns 401", async () => {
        const res = await app.inject({
            method: "POST", url: "/api/auth/login",
            payload: { email: "nouser@test.com", password: "password123" },
        });
        expect(res.statusCode).toBe(401);
    });

    it("GET /api/auth/profile — without JWT returns 401", async () => {
        const res = await app.inject({ method: "GET", url: "/api/auth/profile" });
        expect(res.statusCode).toBe(401);
    });

    it("GET /api/auth/profile — with malformed JWT returns 401", async () => {
        const res = await app.inject({
            method: "GET", url: "/api/auth/profile",
            headers: { authorization: "Bearer malformed.jwt.token" },
        });
        expect(res.statusCode).toBe(401);
    });

    it("GET /api/auth/profile — with valid JWT returns 200", async () => {
        const reg = await app.inject({
            method: "POST", url: "/api/auth/register",
            payload: { email: "profile@test.com", password: "password123", role: "authority", wallet: "0x" + "e".repeat(40), name: "Profile" },
        });
        const token = JSON.parse(reg.body).data.token;
        const res = await app.inject({
            method: "GET", url: "/api/auth/profile",
            headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).data.role).toBe("authority");
    });

    it("POST /api/auth/refresh — valid refresh token works", async () => {
        const reg = await app.inject({
            method: "POST", url: "/api/auth/register",
            payload: { email: "refresh@test.com", password: "password123", role: "contractor", wallet: "0x" + "f".repeat(40), name: "Refresh" },
        });
        const refreshToken = JSON.parse(reg.body).data.refreshToken;
        const res = await app.inject({
            method: "POST", url: "/api/auth/refresh",
            payload: { refreshToken },
        });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).data.token).toBeDefined();
    });

    it("POST /api/auth/refresh — invalid refresh token returns 401", async () => {
        const res = await app.inject({
            method: "POST", url: "/api/auth/refresh",
            payload: { refreshToken: "invalid-token" },
        });
        expect(res.statusCode).toBe(401);
    });
});
