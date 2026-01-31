import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import websocket from "@fastify/websocket";
import { ServerEventSchema } from "@agent-arena/shared";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";

type WsRawData = string | Buffer | ArrayBuffer | Buffer[];
type WsClient = {
  id: string;
  send: (data: string) => void;
  close: () => void;
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
  let tick = 0;
  let btcPrice = 100_000;

  const broadcast = (event: unknown) => {
    const parsed = ServerEventSchema.safeParse(event);
    if (!parsed.success) {
      app.log.warn({ issues: parsed.error.issues }, "invalid server event");
      return;
    }
    const payload = JSON.stringify(parsed.data);
    for (const client of wsClients.values()) client.send(payload);
  };

  const tickTimer = setInterval(() => {
    tick += 1;
    const delta = (Math.random() - 0.5) * 250; // placeholder
    btcPrice = Math.max(1, btcPrice + delta);

    broadcast({
      type: "tick",
      tick: {
        matchId: "demo",
        tick,
        ts: Date.now(),
        btcPrice,
      },
    });

    broadcast({
      type: "leaderboard",
      matchId: "demo",
      tick,
      rows: [
        { seatId: "1", agentName: "Clawbot", credits: 1000 + tick * 2, target: 0.2 },
        { seatId: "2", agentName: "Moltbot", credits: 1000 - tick * 1, target: -0.1 },
        { seatId: "3", agentName: "Openclaw", credits: 1000 + tick * 0.5, target: 0.0 },
        { seatId: "4", agentName: "HODLer", credits: 1000, target: 0.0 },
        { seatId: "5", agentName: "MeanRevert", credits: 1000 + Math.sin(tick / 3) * 10, target: -0.05 },
      ],
    });
  }, 1500);

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

      wsClients.set(clientId, {
        id: clientId,
        send: (data: string) => socket.send(data),
        close: () => socket.close(),
      });

      broadcast({ type: "hello", serverTime: Date.now() });

      socket.on("message", (_data: WsRawData) => {
        // Reserved for future client → server messages (subscribe, submit decision, etc.)
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
    clearInterval(tickTimer);
    wsClients.clear();
  });

  return app;
}
