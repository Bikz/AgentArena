import { z } from "zod";

export const ProtocolVersionSchema = z.literal(1);
export type ProtocolVersion = z.infer<typeof ProtocolVersionSchema>;

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
  z.object({
    type: z.literal("hello"),
    v: ProtocolVersionSchema,
    serverTime: z.number().int().min(0),
  }),
  z.object({
    type: z.literal("error"),
    v: ProtocolVersionSchema,
    code: z.string().min(1),
    message: z.string().min(1),
  }),
  z.object({
    type: z.literal("queue"),
    v: ProtocolVersionSchema,
    queueSize: z.number().int().min(0),
  }),
  z.object({
    type: z.literal("match_status"),
    v: ProtocolVersionSchema,
    matchId: z.string().min(1),
    phase: z.enum(["waiting", "running", "finished"]),
    seats: z.array(
      z.object({
        seatId: z.string().min(1),
        agentId: z.string().min(1).optional(),
        agentName: z.string().min(1),
        strategy: z.enum(["hold", "random", "trend", "mean_revert"]),
      }),
    ),
    tickIntervalMs: z.number().int().min(250),
    maxTicks: z.number().int().min(1),
  }),
  z.object({ type: z.literal("tick"), tick: MatchTickSchema }),
  z.object({
    type: z.literal("leaderboard"),
    matchId: z.string().min(1),
    tick: z.number().int().min(0),
    rows: z.array(
      z.object({
        seatId: z.string().min(1),
        agentId: z.string().min(1).optional(),
        agentName: z.string().min(1),
        credits: z.number(),
        target: z.number().min(-1).max(1),
        note: z.string().optional(),
      }),
    ),
  }),
  z.object({
    // Sent once per match at the end to make payouts/auditability obvious to judges.
    type: z.literal("match_finished"),
    v: ProtocolVersionSchema,
    matchId: z.string().min(1),
    winnerSeatId: z.string().min(1),
    payoutSeatId: z.string().min(1),
    payoutWallet: z.string().min(1).optional(),
    yellowPaid: z.boolean(),
    arcTxHash: z.string().min(1).optional(),
  }),
]);

export type ServerEvent = z.infer<typeof ServerEventSchema>;

export const ClientEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscribe"),
    v: ProtocolVersionSchema,
    matchId: z.string().min(1),
  }),
  z.object({
    type: z.literal("join_queue"),
    v: ProtocolVersionSchema,
    agentId: z.string().min(1).optional(),
    agentName: z.string().min(1).max(32),
    strategy: z.enum(["hold", "random", "trend", "mean_revert"]),
  }),
  z.object({
    type: z.literal("leave_queue"),
    v: ProtocolVersionSchema,
  }),
]);

export type ClientEvent = z.infer<typeof ClientEventSchema>;
