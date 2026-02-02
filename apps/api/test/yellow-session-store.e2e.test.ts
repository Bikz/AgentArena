import { describe, expect, it } from "vitest";
import { createPool } from "../src/db/conn.js";
import { YellowService } from "../src/yellow/yellow.js";
import { encryptJson } from "../src/yellow/crypto.js";
import { upsertYellowSession, listActiveYellowSessions } from "../src/db/yellow-sessions.js";

describe("yellow session persistence (db)", () => {
  it("hydrates active sessions from encrypted DB rows", async () => {
    if (!process.env.DATABASE_URL) return;

    const pool = createPool();
    if (!pool) return;

    const key = Buffer.alloc(32, 7).toString("base64");
    process.env.YELLOW_SESSION_STORE_KEY_BASE64 = key;

    const wallet = "0x1111111111111111111111111111111111111111";
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600);

    const blob = encryptJson(Buffer.from(key, "base64"), {
      wallet,
      application: "agent-arena",
      scope: "public",
      sessionKey: "0x2222222222222222222222222222222222222222",
      sessionPrivateKey: "0x".padEnd(66, "3"),
      expiresAt: expiresAt.toString(),
      allowances: [{ asset: "ytest.usd", amount: "1000000000" }],
      jwtToken: "test.jwt",
      activatedAtMs: Date.now(),
    });

    await upsertYellowSession(pool, {
      wallet,
      expiresAt,
      encVersion: blob.v,
      encIv: blob.ivB64,
      encTag: blob.tagB64,
      encData: blob.dataB64,
    });

    const yellow = new YellowService(
      { info: () => {}, warn: () => {}, error: () => {} },
      pool,
      {
        application: "agent-arena",
        scope: "public",
        defaultAllowances: [{ asset: "ytest.usd", amount: "1000000000" }],
        expiresInSeconds: 3600,
      },
    );
    await yellow.hydrateFromDb({ warn: () => {} });

    const active = yellow.sessions.getActive(wallet as any);
    expect(active).not.toBeNull();
    expect(active?.wallet.toLowerCase()).toBe(wallet.toLowerCase());
    expect(active?.jwtToken).toBe("test.jwt");

    await yellow.clearActive(wallet as any);
    const rows = await listActiveYellowSessions(pool, BigInt(Math.floor(Date.now() / 1000)));
    expect(rows.some((r) => r.wallet === wallet.toLowerCase())).toBe(false);

    await pool.end();
  });
});

