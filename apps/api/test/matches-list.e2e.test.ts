import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createPool } from "../src/db/conn.js";
import { upsertMatch, upsertSeat } from "../src/db/repo.js";

describe("GET /matches (db required)", () => {
  it("lists recently created matches", async () => {
    if (!process.env.DATABASE_URL) return;

    const pool = createPool();
    if (!pool) return;

    const matchId = `match_test_list_${Date.now()}`;
    await upsertMatch(pool, {
      id: matchId,
      phase: "finished",
      tickIntervalMs: 1500,
      maxTicks: 40,
      startPrice: 100_000,
    });
    await upsertSeat(pool, {
      matchId,
      seatId: "1",
      agentId: null,
      agentName: "TestAgent",
      strategy: "hold",
    });

    const app = buildApp();
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/matches?limit=10" });
    expect(res.statusCode).toBe(200);
    const json = res.json() as { matches: Array<{ id: string }> };
    expect(json.matches.some((m) => m.id === matchId)).toBe(true);

    await app.close();
    await pool.end();
  });
});

