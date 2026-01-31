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

  app.get("/health", async () => ({ ok: true as const }));

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
  );

  const WsQuery = z.object({
    clientId: z.string().min(1).optional(),
  });

  app.get(
    "/ws",
    {
      schema: { querystring: WsQuery },
      websocket: true,
    },
    (socket, req) => {
      const clientId = req.query.clientId ?? "anon";
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

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, "request failed");
    reply.status(500).send({ error: "internal" as const });
  });

  app.addHook("onClose", async () => {
    wsClients.clear();
    engine.close();
  });

  return app;
}
