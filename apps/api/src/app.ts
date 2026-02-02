import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import websocket from "@fastify/websocket";
import cookie from "@fastify/cookie";
import secureSession from "@fastify/secure-session";
import rateLimit from "@fastify/rate-limit";
import { ClientEventSchema, ServerEventSchema } from "@agent-arena/shared";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import { MatchEngine } from "./match/engine.js";
import { createPool } from "./db/conn.js";
import {
  createAgent,
  getAgent,
  getMatch,
  insertTick,
  listAgents,
  listMatches,
  attachLatestEntryPaymentToMatch,
  insertMatchPayment,
  setAgentEns,
  upsertMatch,
  upsertSeat,
} from "./db/repo.js";
import { decideSeatTarget } from "./agents/decide-seat.js";
import { createBtcUsdPriceFeed } from "./prices/btc-usd.js";
import crypto from "node:crypto";
import { YellowService } from "./yellow/yellow.js";
import { EIP712AuthTypes } from "@erc7824/nitrolite";
import { SiweMessage } from "siwe";

type WsRawData = string | Buffer | ArrayBuffer | Buffer[];
type WsClient = {
  id: string;
  send: (data: string) => void;
  close: () => void;
  matchId?: string;
  address?: string;
};

export function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV === "development"
          ? { target: "pino-pretty" }
          : undefined,
    },
    bodyLimit: 1024 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(helmet);
  app.register(cors, { origin: true, credentials: true });
  app.register(websocket);
  app.register(cookie);
  app.register(rateLimit, {
    global: true,
    max: process.env.NODE_ENV === "test" ? 100_000 : 600,
    timeWindow: "1 minute",
  });
  app.register(secureSession as unknown as Parameters<typeof app.register>[0], {
    cookieName: "agentarena_session",
    key: (() => {
      const raw = process.env.SESSION_KEY_BASE64;
      if (raw) {
        const buf = Buffer.from(raw, "base64");
        if (buf.length < 32) throw new Error("SESSION_KEY_BASE64 must be >= 32 bytes");
        return buf;
      }
      // Dev/test fallback: ephemeral key (sessions reset on restart).
      return crypto.randomBytes(32);
    })(),
    expiry: 7 * 24 * 60 * 60,
    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });

  const pool = createPool();
  const housePrivateKey =
    process.env.YELLOW_HOUSE_PRIVATE_KEY &&
    process.env.YELLOW_HOUSE_PRIVATE_KEY.startsWith("0x")
      ? (process.env.YELLOW_HOUSE_PRIVATE_KEY as `0x${string}`)
      : undefined;

  const yellow = new YellowService(app.log, pool, {
    wsUrl: process.env.YELLOW_WS_URL,
    application: process.env.YELLOW_APPLICATION ?? "agent-arena",
    scope: process.env.YELLOW_SCOPE ?? "public",
    defaultAllowances: [
      {
        asset: process.env.YELLOW_ALLOWANCE_ASSET ?? "ytest.usd",
        amount: process.env.YELLOW_ALLOWANCE_AMOUNT ?? "1000000000",
      },
    ],
    expiresInSeconds: Number(process.env.YELLOW_EXPIRES_IN_SECONDS ?? "3600"),
    housePrivateKey,
    houseScope: process.env.YELLOW_HOUSE_SCOPE ?? "house",
    houseAllowances: process.env.YELLOW_HOUSE_ALLOWANCE_ASSET
      ? [
          {
            asset: process.env.YELLOW_HOUSE_ALLOWANCE_ASSET,
            amount: process.env.YELLOW_HOUSE_ALLOWANCE_AMOUNT ?? "1000000000000",
          },
        ]
      : undefined,
    houseExpiresInSeconds: process.env.YELLOW_HOUSE_EXPIRES_IN_SECONDS
      ? Number(process.env.YELLOW_HOUSE_EXPIRES_IN_SECONDS)
      : undefined,
  });
  void yellow.hydrateFromDb(app.log);

  const paidMatches = process.env.YELLOW_PAID_MATCHES === "1";
  const entryAsset = process.env.YELLOW_ENTRY_ASSET ?? "ytest.usd";
  const entryAmount = BigInt(process.env.YELLOW_ENTRY_AMOUNT ?? "10000000");
  const rakeBps = BigInt(process.env.YELLOW_RAKE_BPS ?? "2000");
  const payoutBps = 10_000n - rakeBps;
  const tickFeeAmount = BigInt(process.env.YELLOW_TICK_FEE_AMOUNT ?? "0");

  const matchTickIntervalMs = Number(process.env.MATCH_TICK_INTERVAL_MS ?? "1500");
  const matchMaxTicks = Number(process.env.MATCH_MAX_TICKS ?? "40");
  const matchStartPrice = Number(process.env.MATCH_START_PRICE ?? "100000");

  const pendingEntryByClientId = new Map<
    string,
    { wallet: `0x${string}`; asset: string; amount: bigint; chargedAtMs: number }
  >();
  const tickFeeTotalsByMatchId = new Map<string, { count: number; total: bigint }>();
  const tickFeeChainByMatchId = new Map<string, Promise<void>>();
  const queueRefundMs = Number(process.env.YELLOW_QUEUE_REFUND_MS ?? "600000"); // 10 minutes
  let queueRefundInterval: ReturnType<typeof setInterval> | null = null;

  const refundPendingEntry = async (input: {
    clientId: string | null;
    pending: { wallet: `0x${string}`; asset: string; amount: bigint };
    log: { error: (obj: any, msg: string) => void };
  }) => {
    try {
      const tx = await yellow.houseTransfer(input.pending.wallet as any, [
        { asset: input.pending.asset, amount: input.pending.amount.toString() },
      ]);
      if (pool) {
        await insertMatchPayment(pool, {
          matchId: null,
          kind: "refund",
          asset: input.pending.asset,
          amount: input.pending.amount.toString(),
          fromWallet: yellow.getHouseWallet(),
          toWallet: input.pending.wallet,
          clientId: input.clientId,
          tx,
        });
      }
    } catch (err) {
      input.log.error({ err }, "failed to refund entry fee");
    }
  };

  app.get("/health", async () => ({ ok: true as const }));
  app.get("/config", async () => ({
    paidMatches,
    entry: { asset: entryAsset, amount: entryAmount.toString() },
    rakeBps: rakeBps.toString(),
    tickFee: { asset: entryAsset, amount: tickFeeAmount.toString() },
    match: {
      tickIntervalMs: Math.max(250, Math.floor(matchTickIntervalMs)),
      maxTicks: Math.max(1, Math.floor(matchMaxTicks)),
      startPrice: matchStartPrice,
    },
  }));

  app.get("/auth/me", async (req) => {
    const session = req.session as any;
    const address = session.get("address") as string | undefined;
    return { address: address ?? null };
  });

  const authRateLimit =
    process.env.NODE_ENV === "test"
      ? { max: 100_000, timeWindow: "1 minute" }
      : { max: 30, timeWindow: "5 minutes" };

  app.post(
    "/auth/nonce",
    { config: { rateLimit: authRateLimit } },
    async (req) => {
      const session = req.session as any;
      const nonce = crypto.randomBytes(16).toString("hex");
      session.set("nonce", nonce);
      session.touch();
      return { nonce };
    },
  );

  const VerifyBody = z.object({
    message: z.string().min(1).max(2000),
    signature: z.string().min(1).max(512),
  });
  app.post(
    "/auth/verify",
    { schema: { body: VerifyBody }, config: { rateLimit: authRateLimit } },
    async (req, reply) => {
      const session = req.session as any;
      const expectedNonce = session.get("nonce") as string | undefined;
      if (!expectedNonce)
        return reply.code(401).send({ error: "missing_nonce" as const });

      const message = req.body.message;
      let siwe: SiweMessage;
      try {
        siwe = new SiweMessage(message);
      } catch {
        return reply.code(400).send({ error: "invalid_message" as const });
      }

      const domain = process.env.SIWE_DOMAIN;
      const scheme = process.env.SIWE_SCHEME;
      const res = await siwe
        .verify(
          {
            signature: req.body.signature,
            nonce: expectedNonce,
            domain,
            scheme,
            time: new Date().toISOString(),
          },
          { suppressExceptions: true },
        )
        .catch(() => ({ success: false as const }));

      if (!res.success)
        return reply.code(401).send({ error: "invalid_signature" as const });

      const address = siwe.address as `0x${string}`;
      session.set("nonce", undefined);
      session.set("address", address);
      session.touch();
      return { ok: true as const, address };
    },
  );

  app.post("/auth/logout", async (req) => {
    const address = (req.session as any).get("address") as string | undefined;
    if (address) {
      await yellow.clearActive(address as any).catch(() => {
        // best effort
      });
    }
    (req.session as any).delete();
    return { ok: true as const };
  });

  const YellowVerifyBody = z.object({
    signature: z.string().min(1).max(512),
  });

  app.post("/yellow/auth/start", { config: { rateLimit: authRateLimit } }, async (req, reply) => {
    const address = (req.session as any).get("address") as string | undefined;
    if (!address) return reply.code(401).send({ error: "unauthorized" as const });
    const res = await yellow.startAuth(address as any);
    return {
      challenge: res.challenge,
      typedData: {
        domain: { name: res.application },
        types: EIP712AuthTypes,
        primaryType: "Policy" as const,
        message: {
          scope: res.scope,
          session_key: res.sessionKey,
          // Send as string for JSON; client converts to BigInt for signing.
          expires_at: res.expiresAt,
          allowances: res.allowances,
          wallet: res.wallet,
          challenge: res.challenge,
        },
      },
    };
  });

  app.post(
    "/yellow/auth/verify",
    { schema: { body: YellowVerifyBody }, config: { rateLimit: authRateLimit } },
    async (req, reply) => {
      const address = (req.session as any).get("address") as string | undefined;
      if (!address) return reply.code(401).send({ error: "unauthorized" as const });
      const signature = req.body.signature as `0x${string}`;
      if (!signature.startsWith("0x"))
        return reply.code(400).send({ error: "invalid_signature" as const });
      const res = await yellow.verifyAuth(address as any, signature as any);
      return res;
    },
  );

  app.get("/yellow/me", async (req, reply) => {
    const address = (req.session as any).get("address") as string | undefined;
    if (!address) return reply.code(401).send({ error: "unauthorized" as const });
    try {
      const balances = await yellow.getLedgerBalances(address as any);
      return { ok: true as const, balances };
    } catch (err) {
      return reply.code(400).send({
        error: "yellow_not_ready" as const,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });

  app.post("/yellow/faucet", async (req, reply) => {
    const address = (req.session as any).get("address") as string | undefined;
    if (!address) return reply.code(401).send({ error: "unauthorized" as const });
    const url =
      process.env.YELLOW_FAUCET_URL ??
      "https://clearnet-sandbox.yellow.com/faucet/requestTokens";
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userAddress: address }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return reply.code(502).send({ error: "faucet_failed" as const, message: text });
    }
    return { ok: true as const };
  });

  app.get("/agents", async (_req, reply) => {
    if (!pool) return reply.code(501).send({ error: "db_not_configured" });
    const agents = await listAgents(pool);
    return {
      agents: agents.map((a) => ({
        id: a.id,
        created_at: a.created_at,
        name: a.name,
        prompt_hash: a.prompt_hash ?? null,
        model: a.model,
        strategy: a.strategy,
        owner_address: a.owner_address ?? null,
        ens_name: a.ens_name ?? null,
      })),
    };
  });

  const MatchesQuery = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
  });
  app.get(
    "/matches",
    { schema: { querystring: MatchesQuery } },
    async (req, reply) => {
      if (!pool) return reply.code(501).send({ error: "db_not_configured" });
      const limit = req.query.limit ?? 25;
      const matches = await listMatches(pool, { limit });
      return { matches };
    },
  );

  const AgentParams = z.object({ agentId: z.string().min(1) });
  app.get(
    "/agents/:agentId/public",
    { schema: { params: AgentParams } },
    async (req, reply) => {
      if (!pool) return reply.code(501).send({ error: "db_not_configured" });
      const agent = await getAgent(pool, req.params.agentId);
      if (!agent) return reply.code(404).send({ error: "not_found" });
      return {
        agent: {
          id: agent.id,
          created_at: agent.created_at,
          name: agent.name,
          prompt_hash: agent.prompt_hash ?? null,
          model: agent.model,
          strategy: agent.strategy,
          owner_address: agent.owner_address ?? null,
          ens_name: agent.ens_name ?? null,
          ens_node: agent.ens_node ?? null,
          ens_tx_hash: agent.ens_tx_hash ?? null,
          ens_claimed_at: agent.ens_claimed_at ?? null,
        },
      };
    },
  );
  app.get(
    "/agents/:agentId",
    { schema: { params: AgentParams } },
    async (req, reply) => {
      if (!pool) return reply.code(501).send({ error: "db_not_configured" });
      const address = (req.session as any).get("address") as string | undefined;
      if (!address) return reply.code(401).send({ error: "unauthorized" });
      const agent = await getAgent(pool, req.params.agentId);
      if (!agent) return reply.code(404).send({ error: "not_found" });
      if (agent.owner_address && agent.owner_address !== address)
        return reply.code(403).send({ error: "forbidden" });
      return { agent };
    },
  );

  const SetEnsBody = z.object({
    ensName: z.string().min(1).max(255),
    ensNode: z.string().min(1).max(66),
    txHash: z.string().min(1).max(66),
  });
  app.post(
    "/agents/:agentId/ens",
    { schema: { params: AgentParams, body: SetEnsBody } },
    async (req, reply) => {
      if (!pool) return reply.code(501).send({ error: "db_not_configured" });
      const address = (req.session as any).get("address") as string | undefined;
      if (!address) return reply.code(401).send({ error: "unauthorized" });

      const agent = await getAgent(pool, req.params.agentId);
      if (!agent) return reply.code(404).send({ error: "not_found" });
      if (agent.owner_address && agent.owner_address !== address)
        return reply.code(403).send({ error: "forbidden" });

      await setAgentEns(pool, {
        agentId: agent.id,
        ownerAddress: address,
        ensName: req.body.ensName,
        ensNode: req.body.ensNode,
        txHash: req.body.txHash,
      });
      return { ok: true as const };
    },
  );

  const CreateAgentBody = z.object({
    name: z.string().min(1).max(64),
    prompt: z.string().min(1).max(10_000),
    model: z.string().min(1).max(128),
    strategy: z.enum(["hold", "random", "trend", "mean_revert"]),
  });

  app.post(
    "/agents",
    { schema: { body: CreateAgentBody } },
    async (req, reply) => {
      if (!pool) return reply.code(501).send({ error: "db_not_configured" });
      const address = (req.session as any).get("address") as string | undefined;
      if (!address) return reply.code(401).send({ error: "unauthorized" });
      const id = await createAgent(pool, { ...req.body, ownerAddress: address });
      return { id };
    },
  );

  const MatchParams = z.object({ matchId: z.string().min(1) });
  app.get(
    "/matches/:matchId",
    { schema: { params: MatchParams } },
    async (req, reply) => {
      if (!pool) return reply.code(501).send({ error: "db_not_configured" });
      const data = await getMatch(pool, req.params.matchId);
      if (!data) return reply.code(404).send({ error: "not_found" });
      return data;
    },
  );

  const wsClients = new Map<string, WsClient>();

  const broadcastToAll = (event: unknown) => {
    const parsed = ServerEventSchema.safeParse(event);
    if (!parsed.success) {
      app.log.warn({ issues: parsed.error.issues }, "invalid server event");
      return;
    }
    const payload = JSON.stringify(parsed.data);
    for (const client of wsClients.values()) client.send(payload);
  };

  const broadcastToMatch = (matchId: string, event: unknown) => {
    const parsed = ServerEventSchema.safeParse(event);
    if (!parsed.success) {
      app.log.warn({ issues: parsed.error.issues }, "invalid server event");
      return;
    }
    const payload = JSON.stringify(parsed.data);
    for (const client of wsClients.values()) {
      if (client.matchId === matchId) client.send(payload);
    }
  };

  const agentCache = new Map<string, Awaited<ReturnType<typeof getAgent>>>();
  const resolveAgent = async (agentId: string) => {
    if (!pool) return null;
    const cached = agentCache.get(agentId);
    if (cached) return cached;
    const agent = await getAgent(pool, agentId);
    if (agent) agentCache.set(agentId, agent);
    return agent;
  };

  const btcFeed = createBtcUsdPriceFeed();

  const engineHooks = {
    onError: (err: unknown) => app.log.error({ err }, "engine hook error"),
    onMatchCreated: async (m: any) => {
      // Once a match is created, any queued entry fees are considered "locked" for the match.
      if (paidMatches) {
        for (const seat of m.seats as Array<{ clientId?: string }>) {
          if (!seat.clientId) continue;
          pendingEntryByClientId.delete(seat.clientId);
          if (pool) {
            try {
              await attachLatestEntryPaymentToMatch(pool, {
                clientId: seat.clientId,
                matchId: m.config.matchId,
              });
            } catch (err) {
              app.log.error({ err }, "failed to attach entry payment to match");
            }
          }
        }
      }

      if (!pool) return;
      await upsertMatch(pool, {
        id: m.config.matchId,
        phase: m.phase,
        tickIntervalMs: m.config.tickIntervalMs,
        maxTicks: m.config.maxTicks,
        startPrice: m.config.startPrice,
      });
      for (const seat of m.seats as any[]) {
        await upsertSeat(pool, {
          matchId: m.config.matchId,
          seatId: seat.seatId,
          agentId: seat.agentId ?? null,
          agentName: seat.agentName,
          strategy: seat.strategy,
        });
      }
    },
    onTick: async (m: any) => {
      if (pool) {
        await upsertMatch(pool, {
          id: m.config.matchId,
          phase: m.phase,
          tickIntervalMs: m.config.tickIntervalMs,
          maxTicks: m.config.maxTicks,
          startPrice: m.config.startPrice,
        });
        await insertTick(pool, {
          matchId: m.config.matchId,
          tick: m.tick,
          ts: new Date(),
          btcPrice: m.price,
          leaderboard: m.seats.map((s: any) => ({
            seatId: s.seatId,
            agentId: s.agentId,
            agentName: s.agentName,
            credits: s.credits,
            target: s.target,
            note: s.note,
          })),
        });
      }

      if (
        paidMatches &&
        tickFeeAmount > 0n &&
        m.phase === "running" &&
        yellow.getHouseWallet()
      ) {
        const matchId = m.config.matchId;
        const prev = tickFeeChainByMatchId.get(matchId) ?? Promise.resolve();
        const next = prev
          .then(async () => {
            const house = yellow.getHouseWallet();
            if (!house) return;
            for (const seat of m.seats as any[]) {
              if (!seat.ownerAddress) continue;
              try {
                await yellow.transfer(seat.ownerAddress as any, house as any, [
                  { asset: entryAsset, amount: tickFeeAmount.toString() },
                ]);
                const totals = tickFeeTotalsByMatchId.get(matchId) ?? {
                  count: 0,
                  total: 0n,
                };
                totals.count += 1;
                totals.total += tickFeeAmount;
                tickFeeTotalsByMatchId.set(matchId, totals);
              } catch (err) {
                app.log.warn(
                  { err, matchId, wallet: seat.ownerAddress },
                  "failed to collect tick fee",
                );
              }
            }
          })
          .catch((err) =>
            app.log.error({ err, matchId }, "tick fee collection failed"),
          );
        tickFeeChainByMatchId.set(matchId, next);
      }
    },
    onFinished: async (m: any) => {
      if (pool) {
        await upsertMatch(pool, {
          id: m.config.matchId,
          phase: m.phase,
          tickIntervalMs: m.config.tickIntervalMs,
          maxTicks: m.config.maxTicks,
          startPrice: m.config.startPrice,
        });
      }

      if (!paidMatches) return;

      if (tickFeeAmount > 0n) {
        const totals = tickFeeTotalsByMatchId.get(m.config.matchId);
        if (totals && totals.total > 0n && pool) {
          await insertMatchPayment(pool, {
            matchId: m.config.matchId,
            kind: "tick_fees",
            asset: entryAsset,
            amount: totals.total.toString(),
            fromWallet: null,
            toWallet: yellow.getHouseWallet(),
            clientId: null,
            tx: { count: totals.count, amountPerTick: tickFeeAmount.toString() },
          });
        }
        tickFeeTotalsByMatchId.delete(m.config.matchId);
        tickFeeChainByMatchId.delete(m.config.matchId);
      }

      if (!yellow.getHouseWallet()) {
        app.log.error(
          { matchId: m.config.matchId },
          "paid matches enabled but YELLOW_HOUSE_PRIVATE_KEY not configured",
        );
        return;
      }

      const seatsWithOwners = (m.seats as any[]).filter((s) => s.ownerAddress);
      if (seatsWithOwners.length === 0) return;

      const winner = seatsWithOwners.reduce((best, cur) =>
        cur.credits > best.credits ? cur : best,
      );

      const pot = entryAmount * BigInt(seatsWithOwners.length);
      const payout = (pot * payoutBps) / 10_000n;
      if (payout <= 0n) return;

      try {
        const tx = await yellow.houseTransfer(winner.ownerAddress as any, [
          { asset: entryAsset, amount: payout.toString() },
        ]);
        if (pool) {
          await insertMatchPayment(pool, {
            matchId: m.config.matchId,
            kind: "payout",
            asset: entryAsset,
            amount: payout.toString(),
            fromWallet: yellow.getHouseWallet(),
            toWallet: winner.ownerAddress ?? null,
            clientId: winner.clientId ?? null,
            tx,
          });
        }
        app.log.info(
          {
            matchId: m.config.matchId,
            winner: winner.ownerAddress,
            payout: payout.toString(),
            asset: entryAsset,
          },
          "yellow payout sent",
        );
      } catch (err) {
        app.log.error(
          { err, matchId: m.config.matchId, winner: winner.ownerAddress },
          "yellow payout failed",
        );
      }
    },
  };

  const engine = new MatchEngine(
    (matchId, event) => broadcastToMatch(matchId, event),
    (event) => broadcastToAll(event),
    async ({ seat, match, latestTick, timeoutMs, rng }) => {
      const agent = seat.agentId ? await resolveAgent(seat.agentId) : null;
      const agentStrategy =
        agent &&
        (agent.strategy === "hold" ||
          agent.strategy === "random" ||
          agent.strategy === "trend" ||
          agent.strategy === "mean_revert")
          ? agent.strategy
          : null;
      return decideSeatTarget({
        agent: agent
          ? {
              id: agent.id,
              name: agent.name,
              prompt: agent.prompt ?? "",
              model: agent.model,
              strategy: agentStrategy ?? seat.strategy,
            }
          : null,
        strategy: seat.strategy,
        ctx: {
          matchId: match.config.matchId,
          tick: match.tick,
          tickIntervalMs: match.config.tickIntervalMs,
          maxTicks: match.config.maxTicks,
          priceHistory: match.priceHistory,
          latestTick,
          credits: seat.credits,
        },
        rng,
        timeoutMs,
      });
    },
    async ({ match }) => {
      const res = await btcFeed({
        matchId: match.config.matchId,
        prevPriceUsd: match.price,
      });
      return { price: res.priceUsd, source: res.source };
    },
    engineHooks as any,
  );

  engine.setMatchDefaults({
    tickIntervalMs: matchTickIntervalMs,
    maxTicks: matchMaxTicks,
    startPrice: matchStartPrice,
  });

  if (paidMatches && queueRefundMs > 0) {
    queueRefundInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientId, pending] of pendingEntryByClientId.entries()) {
        if (now - pending.chargedAtMs < queueRefundMs) continue;

        pendingEntryByClientId.delete(clientId);
        engine.leaveQueue(clientId);

        const client = wsClients.get(clientId);
        if (client) {
          client.send(
            JSON.stringify({
              type: "error",
              v: 1,
              code: "QUEUE_REFUND_TIMEOUT",
              message: "Queue timed out; entry fee refunded.",
            }),
          );
        }

        void refundPendingEntry({ clientId, pending, log: app.log });
      }
    }, Math.min(queueRefundMs, 30_000));
  }

  const WsQuery = z.object({
    clientId: z.string().min(1).optional(),
  });

  app.register(async (instance) => {
    instance.get(
      "/ws",
      {
        schema: { querystring: WsQuery },
        websocket: true,
      },
      (socket, req) => {
        const query = req.query as { clientId?: string };
        const clientId = query.clientId ?? "anon";
        const address = (req.session as any).get("address") as string | undefined;
        req.log.info({ clientId }, "ws connected");

        const client: WsClient = {
          id: clientId,
          address,
          send: (data: string) => socket.send(data),
          close: () => socket.close(),
        };
        wsClients.set(clientId, client);

        broadcastToAll({ type: "hello", v: 1, serverTime: Date.now() });
        broadcastToAll({ type: "queue", v: 1, queueSize: engine.getQueueSize() });

        const latestMatchId = engine.getLatestMatchId();
        if (latestMatchId) {
          const m = engine.getMatch(latestMatchId);
          if (m) {
            broadcastToAll({
              type: "match_status",
              v: 1,
              matchId: m.config.matchId,
              phase: m.phase,
              seats: m.seats.map((s) => ({
                seatId: s.seatId,
                agentId: s.agentId,
                agentName: s.agentName,
                strategy: s.strategy,
              })),
              tickIntervalMs: m.config.tickIntervalMs,
              maxTicks: m.config.maxTicks,
            });
          }
        }

        socket.on("message", async (_data: WsRawData) => {
          try {
            const json = JSON.parse(_data.toString());
            const parsed = ClientEventSchema.safeParse(json);
            if (!parsed.success) {
              socket.send(
                JSON.stringify({
                  type: "error",
                  v: 1,
                  code: "INVALID_MESSAGE",
                  message: "Invalid client message.",
                }),
              );
              return;
            }

            if (parsed.data.type === "subscribe") {
              client.matchId = parsed.data.matchId;
              return;
            }

            if (parsed.data.type === "join_queue") {
              if (!client.address) {
                socket.send(
                  JSON.stringify({
                    type: "error",
                    v: 1,
                    code: "UNAUTHORIZED",
                    message: "Sign in before joining the queue.",
                  }),
                );
                return;
              }
              const wallet = client.address;

              if (paidMatches) {
                if (engine.isQueued(client.id)) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      v: 1,
                      code: "ALREADY_QUEUED",
                      message: "Already in queue.",
                    }),
                  );
                  return;
                }
              }

              const collectEntryFee = async () => {
                if (!paidMatches) return true;
                if (!yellow.sessions.getActive(wallet as any)) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      v: 1,
                      code: "YELLOW_NOT_READY",
                      message: "Enable Yellow before joining a paid match.",
                    }),
                  );
                  return false;
                }
                const house = yellow.getHouseWallet();
                if (!house) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      v: 1,
                      code: "HOUSE_NOT_CONFIGURED",
                      message: "Paid matches are not configured on this server.",
                    }),
                  );
                  return false;
                }
                if (pendingEntryByClientId.has(client.id)) return true;
                try {
                  const tx = await yellow.transfer(wallet as any, house as any, [
                    { asset: entryAsset, amount: entryAmount.toString() },
                  ]);
                  if (pool) {
                    await insertMatchPayment(pool, {
                      matchId: null,
                      kind: "entry",
                      asset: entryAsset,
                      amount: entryAmount.toString(),
                      fromWallet: wallet,
                      toWallet: house,
                      clientId: client.id,
                      tx,
                    });
                  }
                  pendingEntryByClientId.set(client.id, {
                    wallet: wallet as any,
                    asset: entryAsset,
                    amount: entryAmount,
                    chargedAtMs: Date.now(),
                  });
                  return true;
                } catch (err) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      v: 1,
                      code: "ENTRY_FEE_FAILED",
                      message:
                        err instanceof Error
                          ? err.message
                          : "Failed to collect entry fee.",
                    }),
                  );
                  return false;
                }
              };

              if (pool && parsed.data.agentId) {
                const agent = await getAgent(pool, parsed.data.agentId);
                if (!agent) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      v: 1,
                      code: "AGENT_NOT_FOUND",
                      message: "Agent ID not found.",
                    }),
                  );
                  return;
                }
                if (agent.owner_address && agent.owner_address !== client.address) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      v: 1,
                      code: "FORBIDDEN",
                      message: "Agent does not belong to signed-in wallet.",
                    }),
                  );
                  return;
                }
                if (!(await collectEntryFee())) return;
                engine.joinQueue({
                  clientId: client.id,
                  ownerAddress: client.address,
                  agentId: agent.id,
                  agentName: agent.name,
                  strategy: agent.strategy as any,
                });
                return;
              }
              if (!(await collectEntryFee())) return;
              engine.joinQueue({
                clientId: client.id,
                ownerAddress: client.address,
                agentId: parsed.data.agentId,
                agentName: parsed.data.agentName,
                strategy: parsed.data.strategy,
              });
              return;
            }

            if (parsed.data.type === "leave_queue") {
              const pending = pendingEntryByClientId.get(client.id);
              engine.leaveQueue(client.id);
              if (paidMatches && pending) {
                pendingEntryByClientId.delete(client.id);
                await refundPendingEntry({ clientId: client.id, pending, log: req.log });
              }
              return;
            }
          } catch {
            socket.send(
              JSON.stringify({
                type: "error",
                v: 1,
                code: "INVALID_JSON",
                message: "Invalid JSON message.",
              }),
            );
          }
        });

        socket.on("close", () => {
          req.log.info({ clientId }, "ws disconnected");
          wsClients.delete(clientId);
          const pending = pendingEntryByClientId.get(clientId);
          engine.leaveQueue(clientId);
          if (paidMatches && pending) {
            pendingEntryByClientId.delete(clientId);
            void refundPendingEntry({ clientId, pending, log: req.log });
          }
        });
      },
    );
  });

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, "request failed");
    reply.status(500).send({ error: "internal" as const });
  });

  app.addHook("onClose", async () => {
    wsClients.clear();
    if (queueRefundInterval) clearInterval(queueRefundInterval);
    if (paidMatches && pendingEntryByClientId.size > 0) {
      for (const pending of pendingEntryByClientId.values()) {
        await refundPendingEntry({ clientId: null, pending, log: app.log });
      }
      pendingEntryByClientId.clear();
    }
    yellow.close();
    engine.close();
    await pool?.end();
  });

  return app;
}
