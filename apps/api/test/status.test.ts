import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("GET /status", () => {
  it("returns readiness info", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/status" });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(typeof json.db?.configured).toBe("boolean");
    expect(typeof json.yellow?.paidMatches).toBe("boolean");
    expect(typeof json.yellow?.houseConfigured).toBe("boolean");
    expect(typeof json.yellow?.sessionPersistence).toBe("boolean");
    await app.close();
  });
});

