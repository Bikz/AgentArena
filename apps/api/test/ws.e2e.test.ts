import { describe, expect, it } from "vitest";
import { ServerEventSchema } from "@agent-arena/shared";
import { buildApp } from "../src/app.js";

async function waitFor<T>(
  fn: () => T | undefined,
  { timeoutMs }: { timeoutMs: number },
) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const value = fn();
    if (value !== undefined) return value;
    if (Date.now() - start > timeoutMs) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("ws e2e", () => {
  it("can join queue and receive match events", async () => {
    const app = buildApp();
    await app.ready();

    const received: unknown[] = [];
    const socket: any = await (app as any).injectWS("/ws?clientId=test", {}, {
      onOpen: (ws: any) => {
        ws.on("message", (data: any) => {
          try {
            received.push(JSON.parse(String(data)));
          } catch {
            // ignore
          }
        });
      },
    });

    // Fill the queue to trigger a match.
    for (let i = 0; i < 5; i += 1) {
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
          .find((p) => p.success && p.data.type === "match_status")?.data as any,
      { timeoutMs: 1500 },
    );

    expect(matchStatus.type).toBe("match_status");
    expect(matchStatus.matchId).toMatch(/^match_/);

    socket.send(
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

    socket.close();
    await app.close();
  });
});
