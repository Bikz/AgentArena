import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createPool } from "../src/db/conn.js";
import { createAgent, insertTick, upsertMatch, upsertSeat } from "../src/db/repo.js";

describe("leaderboards (db)", () => {
  it("returns agent and player leaderboards", async () => {
    if (!process.env.DATABASE_URL) return;

    const pool = createPool();
    if (!pool) return;

    const winnerId = await createAgent(pool, {
      name: "WinnerAgent",
      prompt: "Test prompt",
      model: "gpt-4o",
      strategy: "hold",
      ownerAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    const loserId = await createAgent(pool, {
      name: "LoserAgent",
      prompt: "Test prompt",
      model: "gpt-4o",
      strategy: "hold",
      ownerAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });

    const matchId = `match_leader_${Date.now()}`;
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
      agentId: winnerId,
      agentName: "WinnerAgent",
      strategy: "hold",
      ownerAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    await upsertSeat(pool, {
      matchId,
      seatId: "2",
      agentId: loserId,
      agentName: "LoserAgent",
      strategy: "hold",
      ownerAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    await insertTick(pool, {
      matchId,
      tick: 5,
      ts: new Date(),
      btcPrice: 101_000,
      leaderboard: [
        { seatId: "1", agentId: winnerId, agentName: "WinnerAgent", credits: 1300 },
        { seatId: "2", agentId: loserId, agentName: "LoserAgent", credits: 900 },
      ],
    });

    const app = buildApp();
    await app.ready();

    const agentRes = await app.inject({
      method: "GET",
      url: "/leaderboards/agents?limit=5&minMatches=1",
    });
    expect(agentRes.statusCode).toBe(200);
    const agentJson = agentRes.json() as { leaders: Array<{ id: string; wins: number }> };
    expect(agentJson.leaders[0]?.id).toBe(winnerId);
    expect(agentJson.leaders[0]?.wins).toBe(1);

    const playerRes = await app.inject({
      method: "GET",
      url: "/leaderboards/players?limit=5&minMatches=1",
    });
    expect(playerRes.statusCode).toBe(200);
    const playerJson = playerRes.json() as { leaders: Array<{ address: string; wins: number }> };
    expect(playerJson.leaders[0]?.address.toLowerCase()).toBe(
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );

    await app.close();
    await pool.end();
  });
});
