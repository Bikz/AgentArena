import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("POST /demo/fill", () => {
  const prior = process.env.DEMO_ALLOW_BOTS;

  beforeAll(() => {
    process.env.DEMO_ALLOW_BOTS = "1";
  });

  afterAll(() => {
    if (prior === undefined) {
      delete process.env.DEMO_ALLOW_BOTS;
    } else {
      process.env.DEMO_ALLOW_BOTS = prior;
    }
  });

  it("fills seats when demo is enabled", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/demo/fill" });
    expect(res.statusCode).toBe(200);
    const json = res.json() as { ok: boolean; added: number };
    expect(json.ok).toBe(true);
    expect(typeof json.added).toBe("number");
    expect(json.added).toBeGreaterThanOrEqual(0);
    expect(json.added).toBeLessThanOrEqual(5);
    await app.close();
  });
});
