import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    await app.close();
  });
});

describe("GET /agents (no db)", () => {
  it("returns 501 when DB is not configured", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/agents" });
    expect(res.statusCode).toBe(501);
    expect(res.json()).toEqual({ error: "db_not_configured" });
    await app.close();
  });
});
