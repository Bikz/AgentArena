import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

const app = buildApp();

const close = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  process.exit(0);
};

process.on("SIGINT", () => void close("SIGINT"));
process.on("SIGTERM", () => void close("SIGTERM"));

await app.listen({ host, port });
app.log.info({ host, port }, "api listening");

