import { z } from "zod";

export const AgentDecisionSchema = z.object({
  target: z.number().min(-1).max(1),
  note: z.string().optional(),
});

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

export const MatchTickSchema = z.object({
  matchId: z.string().min(1),
  tick: z.number().int().min(0),
  ts: z.number().int().min(0),
  btcPrice: z.number().positive(),
});

export type MatchTick = z.infer<typeof MatchTickSchema>;

export const ServerEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), serverTime: z.number().int().min(0) }),
  z.object({ type: z.literal("tick"), tick: MatchTickSchema }),
  z.object({
    type: z.literal("leaderboard"),
    matchId: z.string().min(1),
    tick: z.number().int().min(0),
    rows: z.array(
      z.object({
        seatId: z.string().min(1),
        agentName: z.string().min(1),
        credits: z.number(),
        target: z.number().min(-1).max(1),
      }),
    ),
  }),
]);

export type ServerEvent = z.infer<typeof ServerEventSchema>;

