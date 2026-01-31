import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { privateKeyToAccount } from "viem/accounts";

function getSetCookie(headers: Record<string, unknown>) {
  const raw = headers["set-cookie"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !value) return null;
  return value.split(";")[0]!;
}

async function signIn(app: ReturnType<typeof buildApp>, privateKey: `0x${string}`) {
  const nonceRes = await app.inject({ method: "POST", url: "/auth/nonce" });
  const nonceCookie = getSetCookie(nonceRes.headers as any);
  if (!nonceCookie) throw new Error("missing nonce cookie");
  const { nonce } = nonceRes.json() as { nonce: string };

  const account = privateKeyToAccount(privateKey);
  const message =
    `agentarena.local wants you to sign in with your Ethereum account:\n` +
    `${account.address}\n\n` +
    `Nonce: ${nonce}\n` +
    `Issued At: 2026-01-31T00:00:00.000Z\n`;
  const signature = await account.signMessage({ message });

  const verifyRes = await app.inject({
    method: "POST",
    url: "/auth/verify",
    headers: { cookie: nonceCookie },
    payload: { message, signature },
  });
  const cookie = getSetCookie(verifyRes.headers as any);
  if (!cookie) throw new Error("missing auth cookie");
  return { cookie, address: account.address };
}

describe("agent ENS claim persistence (db required)", () => {
  it("persists ENS metadata and enforces ownership", async () => {
    if (!process.env.DATABASE_URL) return;

    const app = buildApp();
    await app.ready();

    const alice = await signIn(
      app,
      "0x59c6995e998f97a5a0044966f094538eeb94b3f5f2b2c3a8d9b8b8b8b8b8b8b8",
    );
    const bob = await signIn(
      app,
      "0x8b3a350cf5c34c9194ca3a545d8b6d8d8edff0c2d29b71f3b1b1b1b1b1b1b1b1",
    );

    const createRes = await app.inject({
      method: "POST",
      url: "/agents",
      headers: { cookie: alice.cookie },
      payload: {
        name: `ENSAgent-${Date.now()}`,
        prompt: "hello",
        model: "openai/gpt-4o-mini",
        strategy: "trend",
      },
    });
    expect(createRes.statusCode).toBe(200);
    const { id } = createRes.json() as { id: string };

    const unauthorizedRes = await app.inject({
      method: "POST",
      url: `/agents/${id}/ens`,
      payload: { ensName: "a.agentarena.eth", ensNode: "0xabc", txHash: "0xdef" },
    });
    expect(unauthorizedRes.statusCode).toBe(401);

    const forbiddenRes = await app.inject({
      method: "POST",
      url: `/agents/${id}/ens`,
      headers: { cookie: bob.cookie },
      payload: { ensName: "a.agentarena.eth", ensNode: "0xabc", txHash: "0xdef" },
    });
    expect(forbiddenRes.statusCode).toBe(403);

    const okRes = await app.inject({
      method: "POST",
      url: `/agents/${id}/ens`,
      headers: { cookie: alice.cookie },
      payload: {
        ensName: `ensagent.${"agentarena.eth"}`,
        ensNode:
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        txHash:
          "0x0000000000000000000000000000000000000000000000000000000000000002",
      },
    });
    expect(okRes.statusCode).toBe(200);

    const getRes = await app.inject({ method: "GET", url: `/agents/${id}` });
    expect(getRes.statusCode).toBe(200);
    const agent = (getRes.json() as any).agent;
    expect(agent.owner_address.toLowerCase()).toBe(alice.address.toLowerCase());
    expect(agent.ens_name).toContain("agentarena.eth");
    expect(agent.ens_node).toBe(
      "0x0000000000000000000000000000000000000000000000000000000000000001",
    );
    expect(agent.ens_tx_hash).toBe(
      "0x0000000000000000000000000000000000000000000000000000000000000002",
    );

    await app.close();
  });
});

