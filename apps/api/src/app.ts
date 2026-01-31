import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import websocket from "@fastify/websocket";
import { ClientEventSchema, ServerEventSchema } from "@agent-arena/shared";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import { MatchEngine } from "./match/engine.js";
import { createPool } from "./db/conn.js";
import {
  createAgent,
  getMatch,
  insertTick,
  listAgents,
  upsertMatch,
  upsertSeat,
} from "./db/repo.js";

type WsRawData = string | Buffer | ArrayBuffer | Buffer[];
type WsClient = {
  id: string;
  send: (data: string) => void;
  close: () => void;
  matchId?: string;
};

export function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV === "development"
          ? { target: "pino-pretty" }
          : undefined,
    },
    bodyLimit: 1024 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(helmet);
  app.register(cors, { origin: true, credentials: true });
  app.register(websocket);

  const pool = createPool();

  app.get("/health", async () => ({ ok: true as const }));

  app.get("/agents", async (_req, reply) => {
    if (!pool) return reply.code(501).send({ error: "db_not_configured" });
    return { agents: await listAgents(pool) };
  });

  const CreateAgentBody = z.object({
    name: z.string().min(1).max(64),
    prompt: z.string().min(1).max(10_000),
    model: z.string().min(1).max(128),
  });

  app.post(
    "/agents",
    { schema: { body: CreateAgentBody } },
    async (req, reply) => {
      if (!pool) return reply.code(501).send({ error: "db_not_configured" });
      const id = await createAgent(pool, req.body);
      return { id };
    },
  );

  const MatchParams = z.object({ matchId: z.string().min(1) });
  app.get(
    "/matches/:matchId",
    { schema: { params: MatchParams } },
    async (req, reply) => {
      if (!pool) return reply.code(501).send({ error: "db_not_configured" });
      const data = await getMatch(pool, req.params.matchId);
      if (!data) return reply.code(404).send({ error: "not_found" });
      return data;
    },
  );

  const wsClients = new Map<string, WsClient>();

  const broadcastToAll = (event: unknown) => {
    const parsed = ServerEventSchema.safeParse(event);
    if (!parsed.success) {
      app.log.warn({ issues: parsed.error.issues }, "invalid server event");
      return;
    }
    const payload = JSON.stringify(parsed.data);
    for (const client of wsClients.values()) client.send(payload);
  };

  const broadcastToMatch = (matchId: string, event: unknown) => {
    const parsed = ServerEventSchema.safeParse(event);
    if (!parsed.success) {
      app.log.warn({ issues: parsed.error.issues }, "invalid server event");
      return;
    }
    const payload = JSON.stringify(parsed.data);
    for (const client of wsClients.values()) {
      if (client.matchId === matchId) client.send(payload);
    }
  };

  const engine = new MatchEngine(
    (matchId, event) => broadcastToMatch(matchId, event),
    (event) => broadcastToAll(event),
    pool
      ? {
          onError: (err) => app.log.error({ err }, "engine persistence error"),
          onMatchCreated: async (m) => {
            await upsertMatch(pool, {
              id: m.config.matchId,
              phase: m.phase,
              tickIntervalMs: m.config.tickIntervalMs,
              maxTicks: m.config.maxTicks,
              startPrice: m.config.startPrice,
            });
            for (const seat of m.seats) {
              await upsertSeat(pool, {
                matchId: m.config.matchId,
                seatId: seat.seatId,
                agentId: null,
                agentName: seat.agentName,
                strategy: seat.strategy,
              });
            }
          },
          onTick: async (m) => {
            await upsertMatch(pool, {
              id: m.config.matchId,
              phase: m.phase,
              tickIntervalMs: m.config.tickIntervalMs,
              maxTicks: m.config.maxTicks,
              startPrice: m.config.startPrice,
            });
            await insertTick(pool, {
              matchId: m.config.matchId,
              tick: m.tick,
              ts: new Date(),
              btcPrice: m.price,
              leaderboard: m.seats.map((s) => ({
                seatId: s.seatId,
                agentName: s.agentName,
                credits: s.credits,
                target: s.target,
              })),
            });
          },
          onFinished: async (m) => {
            await upsertMatch(pool, {
              id: m.config.matchId,
              phase: m.phase,
              tickIntervalMs: m.config.tickIntervalMs,
              maxTicks: m.config.maxTicks,
              startPrice: m.config.startPrice,
            });
          },
        }
      : undefined,
  );

  const WsQuery = z.object({
    clientId: z.string().min(1).optional(),
  });

  app.register(async (instance) => {
    instance.get(
      "/ws",
      {
        schema: { querystring: WsQuery },
        websocket: true,
      },
      (socket, req) => {
        const query = req.query as { clientId?: string };
        const clientId = query.clientId ?? "anon";
        req.log.info({ clientId }, "ws connected");

        const client: WsClient = {
          id: clientId,
          send: (data: string) => socket.send(data),
          close: () => socket.close(),
        };
        wsClients.set(clientId, client);

        broadcastToAll({ type: "hello", v: 1, serverTime: Date.now() });
        broadcastToAll({ type: "queue", v: 1, queueSize: engine.getQueueSize() });

        const latestMatchId = engine.getLatestMatchId();
        if (latestMatchId) {
          const m = engine.getMatch(latestMatchId);
          if (m) {
            broadcastToAll({
              type: "match_status",
              v: 1,
              matchId: m.config.matchId,
              phase: m.phase,
              seats: m.seats.map((s) => ({
                seatId: s.seatId,
                agentName: s.agentName,
                strategy: s.strategy,
              })),
              tickIntervalMs: m.config.tickIntervalMs,
              maxTicks: m.config.maxTicks,
            });
          }
        }

        socket.on("message", (_data: WsRawData) => {
          try {
            const json = JSON.parse(_data.toString());
            const parsed = ClientEventSchema.safeParse(json);
            if (!parsed.success) {
              socket.send(
                JSON.stringify({
                  type: "error",
                  v: 1,
                  code: "INVALID_MESSAGE",
                  message: "Invalid client message.",
                }),
              );
              return;
            }

            if (parsed.data.type === "subscribe") {
              client.matchId = parsed.data.matchId;
              return;
            }

            if (parsed.data.type === "join_queue") {
              engine.joinQueue(parsed.data.agentName, parsed.data.strategy);
              return;
            }

            if (parsed.data.type === "leave_queue") {
              engine.leaveQueue();
              return;
            }
          } catch {
            socket.send(
              JSON.stringify({
                type: "error",
                v: 1,
                code: "INVALID_JSON",
                message: "Invalid JSON message.",
              }),
            );
          }
        });

        socket.on("close", () => {
          req.log.info({ clientId }, "ws disconnected");
          wsClients.delete(clientId);
        });
      },
    );
  });

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, "request failed");
    reply.status(500).send({ error: "internal" as const });
  });

  app.addHook("onClose", async () => {
    wsClients.clear();
    engine.close();
    await pool?.end();
  });

  return app;
}
