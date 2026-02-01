import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("GET /config", () => {
  it("returns public runtime config", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/config" });
    expect(res.statusCode).toBe(200);

    const json = res.json() as {
      paidMatches: boolean;
      entry: { asset: string; amount: string };
      rakeBps: string;
    };

    expect(typeof json.paidMatches).toBe("boolean");
    expect(typeof json.entry.asset).toBe("string");
    expect(typeof json.entry.amount).toBe("string");
    expect(typeof json.rakeBps).toBe("string");

    await app.close();
  });
});

