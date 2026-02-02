import { describe, expect, it } from "vitest";
import { createPool } from "../src/db/conn.js";
import {
  attachLatestEntryPaymentToMatch,
  insertMatchPayment,
  listMatchPayments,
  upsertMatch,
} from "../src/db/repo.js";

describe("match payments", () => {
  it("attaches latest entry payment to a match by clientId", async () => {
    if (!process.env.DATABASE_URL) return;

    const pool = createPool();
    if (!pool) return;

    const matchId = `match_test_pay_attach_${Date.now()}`;
    const clientId = `client_test_${Date.now()}`;

    await insertMatchPayment(pool, {
      matchId: null,
      kind: "entry",
      asset: "ytest.usd",
      amount: "123",
      fromWallet: "0x1111111111111111111111111111111111111111",
      toWallet: "0x2222222222222222222222222222222222222222",
      clientId,
      tx: { ok: true },
    });

    await upsertMatch(pool, {
      id: matchId,
      phase: "live",
      tickIntervalMs: 1500,
      maxTicks: 5,
      startPrice: 100_000,
    });

    await attachLatestEntryPaymentToMatch(pool, { clientId, matchId });

    const payments = await listMatchPayments(pool, matchId);
    expect(payments).toHaveLength(1);
    expect(payments[0]?.kind).toBe("entry");
    expect(payments[0]?.client_id).toBe(clientId);
    expect(payments[0]?.amount).toBe("123");

    await pool.end();
  });
});

