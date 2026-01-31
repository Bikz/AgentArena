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

describe("agent privacy (db required)", () => {
  it("does not leak prompts via public endpoints", async () => {
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

    const prompt = `super secret prompt ${Date.now()}`;
    const createRes = await app.inject({
      method: "POST",
      url: "/agents",
      headers: { cookie: alice.cookie },
      payload: {
        name: `PrivacyAgent-${Date.now()}`,
        prompt,
        model: "openai/gpt-4o-mini",
        strategy: "trend",
      },
    });
    expect(createRes.statusCode).toBe(200);
    const { id } = createRes.json() as { id: string };

    const listRes = await app.inject({ method: "GET", url: "/agents" });
    expect(listRes.statusCode).toBe(200);
    const listJson = listRes.json() as { agents: Array<Record<string, unknown>> };
    const listed = listJson.agents.find((a) => a.id === id);
    expect(listed).toBeTruthy();
    expect(listed).not.toHaveProperty("prompt");

    const publicRes = await app.inject({ method: "GET", url: `/agents/${id}/public` });
    expect(publicRes.statusCode).toBe(200);
    const publicAgent = (publicRes.json() as any).agent as Record<string, unknown>;
    expect(publicAgent).not.toHaveProperty("prompt");
    expect(publicAgent.owner_address).toBe(alice.address);

    const privateUnauthedRes = await app.inject({ method: "GET", url: `/agents/${id}` });
    expect(privateUnauthedRes.statusCode).toBe(401);

    const privateForbiddenRes = await app.inject({
      method: "GET",
      url: `/agents/${id}`,
      headers: { cookie: bob.cookie },
    });
    expect(privateForbiddenRes.statusCode).toBe(403);

    const privateOkRes = await app.inject({
      method: "GET",
      url: `/agents/${id}`,
      headers: { cookie: alice.cookie },
    });
    expect(privateOkRes.statusCode).toBe(200);
    const privateAgent = (privateOkRes.json() as any).agent as Record<string, unknown>;
    expect(privateAgent.prompt).toBe(prompt);

    await app.close();
  });
});

