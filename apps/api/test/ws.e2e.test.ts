import { describe, expect, it } from "vitest";
import { ServerEventSchema } from "@agent-arena/shared";
import { buildApp } from "../src/app.js";
import { privateKeyToAccount } from "viem/accounts";

const TEST_KEYS = [
  "0x073c58734624515f5b74a35150b22037865aa1b97c0b31f818656619471e5b82",
  "0xce3007bb649d054f9fa7405a0804b161e0e691ba2649d0f555993f02b0184d54",
  "0x629d8ac3128174827cf0ee76c4e6db2aa68737643cb522efd46accb6b4057cdd",
  "0x54e94b5801bb6bbeebf797e7efe2376f0ab3283acfc4b3f44c48f7e0c429c309",
  "0x15fbbf4e3b8c880f3c0bd115142865cbe038bdb62b465e77a48bcf2c835fb08d",
] as const;

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

describe("ws e2e", () => {
  it("can join queue and receive match events", async () => {
    const app = buildApp();
    await app.ready();

    const signIn = async (privateKey: `0x${string}`) => {
      const nonceRes = await app.inject({ method: "POST", url: "/auth/nonce" });
      const nonceCookie = getSetCookie(nonceRes.headers as any);
      if (!nonceCookie) throw new Error("missing nonce cookie");

      const { nonce } = nonceRes.json() as { nonce: string };
      const account = privateKeyToAccount(privateKey);
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
      return authedCookie;
    };

    const cookies: string[] = [];
    for (const key of TEST_KEYS) {
      cookies.push(await signIn(key));
    }

    const sockets: Array<{
      send: (data: string) => void;
      close: () => void;
    }> = [];
    const received: unknown[] = [];

    // Open 5 clients and join queue (match auto-starts at 5 seats).
    for (let i = 0; i < 5; i += 1) {
      const clientId = `test-${i + 1}`;
      const socket = (await (app as any).injectWS(
        `/ws?clientId=${clientId}`,
        { headers: { cookie: cookies[i]! } },
        {
          onOpen: (ws: {
            on: (event: string, cb: (data: unknown) => void) => void;
          }) => {
            ws.on("message", (data: unknown) => {
              try {
                received.push(JSON.parse(String(data)));
              } catch {
                // ignore
              }
            });
          },
        },
      )) as {
        send: (data: string) => void;
        close: () => void;
      };
      sockets.push(socket);
      socket.send(
        JSON.stringify({
          type: "join_queue",
          v: 1,
          agentName: `Agent${i + 1}`,
          strategy: "hold",
        }),
      );
    }

    const matchStatus = await waitFor(
      () =>
        received
          .map((e) => ServerEventSchema.safeParse(e))
          .find((p) => p.success && p.data.type === "match_status")?.data as
          | Extract<
              import("@agent-arena/shared").ServerEvent,
              { type: "match_status" }
            >
          | undefined,
      { timeoutMs: 1500 },
    );

    expect(matchStatus.type).toBe("match_status");
    expect(matchStatus.matchId).toMatch(/^match_/);

    sockets[0]!.send(
      JSON.stringify({ type: "subscribe", v: 1, matchId: matchStatus.matchId }),
    );

    const tick = await waitFor(
      () =>
        received
          .map((e) => ServerEventSchema.safeParse(e))
          .find((p) => p.success && p.data.type === "tick")?.data,
      { timeoutMs: 2500 },
    );

    const leaderboard = await waitFor(
      () =>
        received
          .map((e) => ServerEventSchema.safeParse(e))
          .find((p) => p.success && p.data.type === "leaderboard")?.data as
          | Extract<import("@agent-arena/shared").ServerEvent, { type: "leaderboard" }>
          | undefined,
      { timeoutMs: 2500 },
    );

    expect(tick.type).toBe("tick");
    expect(leaderboard.type).toBe("leaderboard");
    expect(leaderboard.rows).toHaveLength(5);

    for (const socket of sockets) socket.close();
    await app.close();
  });
});
