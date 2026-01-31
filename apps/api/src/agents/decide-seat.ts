import {
  AgentDecisionSchema,
  type AgentDecision,
  type MatchTick,
} from "@agent-arena/shared";
import { generateText, Output } from "ai";
import { z } from "zod";

type Strategy = "hold" | "random" | "trend" | "mean_revert";

export type AgentRecord = {
  id: string;
  name: string;
  prompt: string;
  model: string;
  strategy: Strategy;
};

export type SeatContext = {
  matchId: string;
  tick: number;
  tickIntervalMs: number;
  maxTicks: number;
  priceHistory: number[];
  latestTick: MatchTick;
  credits: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function sign(n: number) {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

function decideByStrategy(input: {
  strategy: Strategy;
  latestDelta: number;
  rng: () => number;
}): AgentDecision {
  const d = sign(input.latestDelta);

  if (input.strategy === "hold") {
    return { target: 0, note: "hold" };
  }
  if (input.strategy === "random") {
    return { target: clamp(input.rng() * 2 - 1, -1, 1), note: "random" };
  }
  if (input.strategy === "trend") {
    return { target: clamp(d * 0.5, -1, 1), note: "trend" };
  }
  if (input.strategy === "mean_revert") {
    return { target: clamp(-d * 0.5, -1, 1), note: "mean_revert" };
  }
  return { target: 0, note: "hold" };
}

function canUseAiGateway() {
  return Boolean(process.env.AI_GATEWAY_API_KEY);
}

const ModelIdSchema = z.string().min(1).max(128);

export async function decideSeatTarget(input: {
  agent: AgentRecord | null;
  strategy: Strategy;
  ctx: SeatContext;
  rng: () => number;
  timeoutMs: number;
}): Promise<AgentDecision> {
  const prevPrice =
    input.ctx.priceHistory.length >= 2
      ? input.ctx.priceHistory.at(-2)
      : undefined;
  const latestDelta =
    prevPrice === undefined ? 0 : input.ctx.latestTick.btcPrice - prevPrice;

  if (!input.agent || !canUseAiGateway()) {
    return decideByStrategy({
      strategy: input.strategy,
      latestDelta,
      rng: input.rng,
    });
  }

  const modelId = ModelIdSchema.safeParse(input.agent.model);
  if (!modelId.success) {
    return decideByStrategy({
      strategy: input.strategy,
      latestDelta,
      rng: input.rng,
    });
  }

  try {
    const { output } = await generateText({
      model: modelId.data,
      timeout: input.timeoutMs,
      output: Output.object({ schema: AgentDecisionSchema }),
      system:
        "You are an autonomous trading agent in a competitive game. " +
        "You must output a single JSON object that matches the schema exactly.",
      prompt:
        `Agent prompt:\n${input.agent.prompt}\n\n` +
        `Context:\n` +
        `- Match: ${input.ctx.matchId}\n` +
        `- Tick: ${input.ctx.tick}/${input.ctx.maxTicks}\n` +
        `- Tick interval ms: ${input.ctx.tickIntervalMs}\n` +
        `- Credits: ${input.ctx.credits}\n` +
        `- BTC price history (oldest->newest): ${input.ctx.priceHistory.join(", ")}\n\n` +
        `Return target in [-1, 1] where -1 is fully short, 0 hold, +1 fully long.`,
    });

    return {
      target: clamp(output.target, -1, 1),
      note: output.note,
    };
  } catch {
    return decideByStrategy({
      strategy: input.strategy,
      latestDelta,
      rng: input.rng,
    });
  }
}
