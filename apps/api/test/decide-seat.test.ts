import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { decideSeatTarget, type AgentRecord } from "../src/agents/decide-seat.js";

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

import { generateText } from "ai";

function baseCtx() {
  return {
    matchId: "match_test",
    tick: 1,
    tickIntervalMs: 1500,
    maxTicks: 40,
    priceHistory: [100_000, 100_500],
    latestTick: {
      matchId: "match_test",
      tick: 1,
      ts: Date.now(),
      btcPrice: 100_500,
    },
    credits: 1000,
  } as const;
}

describe("decideSeatTarget", () => {
  const prevGatewayKey = process.env.AI_GATEWAY_API_KEY;

  beforeEach(() => {
    delete process.env.AI_GATEWAY_API_KEY;
    vi.resetAllMocks();
  });

  afterEach(() => {
    if (prevGatewayKey) process.env.AI_GATEWAY_API_KEY = prevGatewayKey;
    else delete process.env.AI_GATEWAY_API_KEY;
  });

  it("falls back to strategy when AI not configured", async () => {
    const ctx = baseCtx();

    const decision = await decideSeatTarget({
      agent: null,
      strategy: "trend",
      ctx: { ...ctx },
      rng: () => 0.123,
      timeoutMs: 1000,
    });

    expect(decision.target).toBe(0.5);
    expect(decision.note).toBe("trend");
  });

  it("falls back to strategy when model is invalid", async () => {
    process.env.AI_GATEWAY_API_KEY = "set";
    const ctx = baseCtx();

    const agent: AgentRecord = {
      id: "agent_1",
      name: "A",
      prompt: "do stuff",
      model: "",
      strategy: "trend",
    };

    const decision = await decideSeatTarget({
      agent,
      strategy: "mean_revert",
      ctx: { ...ctx },
      rng: () => 0.999,
      timeoutMs: 1000,
    });

    expect(decision.target).toBe(-0.5);
    expect(decision.note).toBe("mean_revert");
  });

  it("uses AI output when configured and clamps target", async () => {
    process.env.AI_GATEWAY_API_KEY = "set";
    const ctx = baseCtx();

    (generateText as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(
      { output: { target: 2, note: "ai" } },
    );

    const agent: AgentRecord = {
      id: "agent_1",
      name: "A",
      prompt: "do stuff",
      model: "openai/gpt-4o-mini",
      strategy: "trend",
    };

    const decision = await decideSeatTarget({
      agent,
      strategy: "hold",
      ctx: { ...ctx },
      rng: () => 0.1,
      timeoutMs: 1000,
    });

    expect(decision.target).toBe(1);
    expect(decision.note).toBe("ai");
  });
});

