import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";

type WsRawData = string | Buffer | ArrayBuffer | Buffer[];

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

      socket.on("message", (data: WsRawData) => {
        socket.send(
          JSON.stringify({
            type: "echo",
            clientId,
            data: data.toString(),
            ts: Date.now(),
          }),
        );
      });

      socket.on("close", () => {
        req.log.info({ clientId }, "ws disconnected");
      });
    },
  );

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, "request failed");
    reply.status(500).send({ error: "internal" as const });
  });

  return app;
}
