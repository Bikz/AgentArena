import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createPool } from "../src/db/conn.js";
import { upsertMatch, upsertSeat, insertTick, createAgent } from "../src/db/repo.js";

describe("performance endpoints (db)", () => {
  it("returns agent and player performance summaries", async () => {
    if (!process.env.DATABASE_URL) return;

    const pool = createPool();
    if (!pool) return;

    const agentId = await createAgent(pool, {
      name: "PerfAgent",
      prompt: "Test prompt",
      model: "gpt-4o",
      strategy: "hold",
      ownerAddress: "0x1111111111111111111111111111111111111111",
    });

    const matchId = `match_perf_${Date.now()}`;
    await upsertMatch(pool, {
      id: matchId,
      phase: "finished",
      tickIntervalMs: 1500,
      maxTicks: 5,
      startPrice: 100_000,
    });
    await upsertSeat(pool, {
      matchId,
      seatId: "1",
      agentId,
      agentName: "PerfAgent",
      strategy: "hold",
      ownerAddress: "0x1111111111111111111111111111111111111111",
    });
    await insertTick(pool, {
      matchId,
      tick: 5,
      ts: new Date(),
      btcPrice: 101_000,
      leaderboard: [
        { seatId: "1", agentName: "PerfAgent", credits: 1200, target: 0 },
        { seatId: "2", agentName: "Other", credits: 900, target: 0 },
      ],
    });

    const app = buildApp();
    await app.ready();

    const agentRes = await app.inject({
      method: "GET",
      url: `/agents/${agentId}/perf?limit=5`,
    });
    expect(agentRes.statusCode).toBe(200);
    const agentJson = agentRes.json() as any;
    expect(agentJson.summary.matches).toBe(1);
    expect(agentJson.summary.wins).toBe(1);

    const playerRes = await app.inject({
      method: "GET",
      url: `/players/0x1111111111111111111111111111111111111111/perf?limit=5`,
    });
    expect(playerRes.statusCode).toBe(200);
    const playerJson = playerRes.json() as any;
    expect(playerJson.summary.matches).toBe(1);

    await app.close();
    await pool.end();
  });
});

