import { describe, it } from "vitest";
import { ServerEventSchema } from "@agent-arena/shared";
import { buildApp } from "../src/app.js";
import { privateKeyToAccount } from "viem/accounts";

async function waitFor<T>(
  fn: () => T | undefined,
  { timeoutMs }: { timeoutMs: number },
) {
  const start = Date.now();
  while (Date.now() - start <= timeoutMs) {
    const value = fn();
    if (value !== undefined) return value;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("timeout");
}

function getSetCookie(headers: Record<string, unknown>) {
  const raw = headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !value) return null;
  return value.split(";")[0]!;
}

describe("ws queue cleanup", () => {
  it("removes a client from the queue on disconnect", async () => {
    const app = buildApp();
    await app.ready();

    const nonceRes = await app.inject({ method: "POST", url: "/auth/nonce" });
    const nonceCookie = getSetCookie(nonceRes.headers as any);
    if (!nonceCookie) throw new Error("missing nonce cookie");

    const { nonce } = nonceRes.json() as { nonce: string };
    const account = privateKeyToAccount(
      "0x59c6995e998f97a5a0044966f094538eeb94b3f5f2b2c3a8d9b8b8b8b8b8b8b8",
    );
    const message =
      `agentarena.local wants you to sign in with your Ethereum account:\n` +
      `${account.address}\n\n` +
      `Sign in to Agent Arena.\n\n` +
      `URI: http://agentarena.local\n` +
      `Version: 1\n` +
      `Chain ID: 1\n` +
      `Nonce: ${nonce}\n` +
      `Issued At: 2026-01-31T00:00:00.000Z`;
    const signature = await account.signMessage({ message });
    const verifyRes = await app.inject({
      method: "POST",
      url: "/auth/verify",
      headers: { cookie: nonceCookie },
      payload: { message, signature },
    });
    const authedCookie = getSetCookie(verifyRes.headers as any);
    if (!authedCookie) throw new Error("missing auth cookie");

    const received: unknown[] = [];

    const socketA = (await (app as any).injectWS(
      `/ws?clientId=qa`,
      { headers: { cookie: authedCookie } },
      {
        onOpen: (ws: { on: (event: string, cb: (data: unknown) => void) => void }) => {
          ws.on("message", (data: unknown) => {
            try {
              received.push(JSON.parse(String(data)));
            } catch {
              // ignore
            }
          });
        },
      },
    )) as { send: (data: string) => void; close: () => void };

    const socketB = (await (app as any).injectWS(
      `/ws?clientId=qb`,
      { headers: { cookie: authedCookie } },
      {
        onOpen: (ws: { on: (event: string, cb: (data: unknown) => void) => void }) => {
          ws.on("message", (data: unknown) => {
            try {
              received.push(JSON.parse(String(data)));
            } catch {
              // ignore
            }
          });
        },
      },
    )) as { send: (data: string) => void; close: () => void };

    socketA.send(
      JSON.stringify({ type: "join_queue", v: 1, agentName: "A", strategy: "hold" }),
    );
    socketB.send(
      JSON.stringify({ type: "join_queue", v: 1, agentName: "B", strategy: "hold" }),
    );

    await waitFor(
      () =>
        received
          .map((e) => ServerEventSchema.safeParse(e))
          .find((p) => p.success && p.data.type === "queue" && p.data.queueSize === 2)
          ?.data,
      { timeoutMs: 1500 },
    );

    socketB.close();

    await waitFor(
      () =>
        received
          .map((e) => ServerEventSchema.safeParse(e))
          .find((p) => p.success && p.data.type === "queue" && p.data.queueSize === 1)
          ?.data,
      { timeoutMs: 1500 },
    );

    socketA.close();
    await app.close();
  });
});
