import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { privateKeyToAccount } from "viem/accounts";

function getSetCookie(headers: Record<string, unknown>) {
  const raw = headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !value) return null;
  return value.split(";")[0]!;
}

describe("ws rate limiting", () => {
  it("returns WS_RATE_LIMIT when spamming join_queue", async () => {
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
    const socket = (await (app as any).injectWS(
      `/ws?clientId=ratelimit-1`,
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

    for (let i = 0; i < 10; i += 1) {
      socket.send(
        JSON.stringify({
          type: "join_queue",
          v: 1,
          agentName: "Spam",
          strategy: "hold",
        }),
      );
    }

    const start = Date.now();
    let saw = false;
    while (Date.now() - start < 1500) {
      if (received.some((e: any) => e?.type === "error" && e?.code === "WS_RATE_LIMIT")) {
        saw = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(saw).toBe(true);
    socket.close();
    await app.close();
  });
});

