import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { privateKeyToAccount } from "viem/accounts";

function getSetCookie(headers: Record<string, unknown>) {
  const raw = headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !value) return null;
  return value.split(";")[0]!;
}

describe("auth", () => {
  it("can nonce + verify + read /auth/me", async () => {
    const app = buildApp();
    await app.ready();

    const nonceRes = await app.inject({ method: "POST", url: "/auth/nonce" });
    expect(nonceRes.statusCode).toBe(200);
    const { nonce } = nonceRes.json() as { nonce: string };
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);

    const cookie = getSetCookie(nonceRes.headers as any);
    if (!cookie) throw new Error("missing set-cookie");
    expect(cookie).toContain("agentarena_session=");

    const account = privateKeyToAccount(
      "0x59c6995e998f97a5a0044966f094538eeb94b3f5f2b2c3a8d9b8b8b8b8b8b8b8",
    );

    const message =
      `agentarena.local wants you to sign in with your Ethereum account:\n` +
      `${account.address}\n\n` +
      `Nonce: ${nonce}\n` +
      `Issued At: 2026-01-31T00:00:00.000Z\n`;

    const signature = await account.signMessage({ message });

    const verifyRes = await app.inject({
      method: "POST",
      url: "/auth/verify",
      headers: { cookie },
      payload: { message, signature },
    });
    expect(verifyRes.statusCode).toBe(200);
    const authedCookie = getSetCookie(verifyRes.headers as any);
    if (!authedCookie) throw new Error("missing auth set-cookie");

    const meRes = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { cookie: authedCookie },
    });
    expect(meRes.statusCode).toBe(200);
    const me = meRes.json() as { address: string | null };
    expect(me.address).toBe(account.address);

    await app.close();
  });
});
