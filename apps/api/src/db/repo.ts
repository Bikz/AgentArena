import type { Pool } from "pg";
import crypto from "node:crypto";

export type AgentRow = {
  id: string;
  created_at: string;
  name: string;
  prompt?: string | null;
  prompt_hash?: string | null;
  model: string;
  strategy: string;
  owner_address?: string | null;
  ens_name?: string | null;
  ens_node?: string | null;
  ens_tx_hash?: string | null;
  ens_claimed_at?: string | null;
};

export type MatchListRow = {
  id: string;
  created_at: string;
  phase: string;
  tick_interval_ms: number;
  max_ticks: number;
  start_price: string;
  seat_count: number;
  tick_count: number;
};

export type MatchPaymentRow = {
  id: number;
  created_at: string;
  match_id: string | null;
  kind: "entry" | "refund" | "payout";
  asset: string;
  amount: string;
  from_wallet: string | null;
  to_wallet: string | null;
  client_id: string | null;
  tx: unknown | null;
};

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function promptHash(prompt: string) {
  return `0x${crypto.createHash("sha256").update(prompt).digest("hex")}`;
}

export async function listAgents(pool: Pool) {
  const res = await pool.query<AgentRow>(
    "select id, created_at, name, prompt_hash, model, strategy, owner_address, ens_name, ens_node, ens_tx_hash, ens_claimed_at from agents order by created_at desc limit 100",
  );
  return res.rows;
}

export async function createAgent(
  pool: Pool,
  input: {
    name: string;
    prompt: string;
    model: string;
    strategy: string;
    ownerAddress: string;
  },
) {
  const id = newId("agent");
  const pHash = promptHash(input.prompt);
  await pool.query(
    "insert into agents (id, name, prompt, prompt_hash, model, strategy, owner_address) values ($1, $2, $3, $4, $5, $6, $7)",
    [
      id,
      input.name,
      input.prompt,
      pHash,
      input.model,
      input.strategy,
      input.ownerAddress,
    ],
  );
  return id;
}

export async function getAgent(pool: Pool, agentId: string) {
  const res = await pool.query<AgentRow>(
    "select id, created_at, name, prompt, prompt_hash, model, strategy, owner_address, ens_name, ens_node, ens_tx_hash, ens_claimed_at from agents where id=$1",
    [agentId],
  );
  return res.rows[0] ?? null;
}

export async function setAgentEns(
  pool: Pool,
  input: {
    agentId: string;
    ownerAddress: string;
    ensName: string;
    ensNode: string;
    txHash: string;
  },
) {
  await pool.query(
    `update agents
       set ens_name = $1,
           ens_node = $2,
           ens_tx_hash = $3,
           ens_claimed_at = now()
     where id = $4 and owner_address = $5`,
    [input.ensName, input.ensNode, input.txHash, input.agentId, input.ownerAddress],
  );
}

export async function getMatch(pool: Pool, matchId: string) {
  const matchRes = await pool.query(
    "select id, created_at, phase, tick_interval_ms, max_ticks, start_price from matches where id=$1",
    [matchId],
  );
  const match = matchRes.rows[0];
  if (!match) return null;

  const seatsRes = await pool.query(
    "select seat_id, agent_id, agent_name, strategy from match_seats where match_id=$1 order by seat_id asc",
    [matchId],
  );
  const ticksRes = await pool.query(
    "select tick, ts, btc_price, leaderboard from match_ticks where match_id=$1 order by tick asc",
    [matchId],
  );
  const paymentsRes = await pool.query<MatchPaymentRow>(
    "select id, created_at, match_id, kind, asset, amount, from_wallet, to_wallet, client_id, tx from match_payments where match_id=$1 order by id asc",
    [matchId],
  );

  return {
    match,
    seats: seatsRes.rows,
    ticks: ticksRes.rows,
    payments: paymentsRes.rows,
  };
}

export async function listMatches(pool: Pool, { limit }: { limit: number }) {
  const res = await pool.query<MatchListRow>(
    `select
        m.id,
        m.created_at,
        m.phase,
        m.tick_interval_ms,
        m.max_ticks,
        m.start_price,
        (select count(*)::int from match_seats s where s.match_id = m.id) as seat_count,
        (select count(*)::int from match_ticks t where t.match_id = m.id) as tick_count
      from matches m
      order by m.created_at desc
      limit $1`,
    [limit],
  );
  return res.rows;
}

export async function insertMatchPayment(
  pool: Pool,
  input: {
    matchId: string | null;
    kind: "entry" | "refund" | "payout";
    asset: string;
    amount: string;
    fromWallet: string | null;
    toWallet: string | null;
    clientId: string | null;
    tx: unknown | null;
  },
) {
  const res = await pool.query<{ id: number }>(
    `insert into match_payments (match_id, kind, asset, amount, from_wallet, to_wallet, client_id, tx)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id`,
    [
      input.matchId,
      input.kind,
      input.asset,
      input.amount,
      input.fromWallet,
      input.toWallet,
      input.clientId,
      input.tx,
    ],
  );
  return res.rows[0]!.id;
}

export async function attachLatestEntryPaymentToMatch(
  pool: Pool,
  input: { clientId: string; matchId: string },
) {
  await pool.query(
    `update match_payments
        set match_id = $1
      where id = (
        select id from match_payments
         where match_id is null
           and kind = 'entry'
           and client_id = $2
         order by id desc
         limit 1
      )`,
    [input.matchId, input.clientId],
  );
}

export async function listMatchPayments(pool: Pool, matchId: string) {
  const res = await pool.query<MatchPaymentRow>(
    "select id, created_at, match_id, kind, asset, amount, from_wallet, to_wallet, client_id, tx from match_payments where match_id=$1 order by id asc",
    [matchId],
  );
  return res.rows;
}

export async function upsertMatch(
  pool: Pool,
  input: {
    id: string;
    phase: string;
    tickIntervalMs: number;
    maxTicks: number;
    startPrice: number;
  },
) {
  await pool.query(
    `insert into matches (id, phase, tick_interval_ms, max_ticks, start_price)
     values ($1, $2, $3, $4, $5)
     on conflict (id) do update set phase = excluded.phase`,
    [input.id, input.phase, input.tickIntervalMs, input.maxTicks, input.startPrice],
  );
}

export async function upsertSeat(
  pool: Pool,
  input: {
    matchId: string;
    seatId: string;
    agentId: string | null;
    agentName: string;
    strategy: string;
  },
) {
  await pool.query(
    `insert into match_seats (match_id, seat_id, agent_id, agent_name, strategy)
     values ($1, $2, $3, $4, $5)
     on conflict (match_id, seat_id) do update
       set agent_id = excluded.agent_id,
           agent_name = excluded.agent_name,
           strategy = excluded.strategy`,
    [input.matchId, input.seatId, input.agentId, input.agentName, input.strategy],
  );
}

export async function insertTick(
  pool: Pool,
  input: {
    matchId: string;
    tick: number;
    ts: Date;
    btcPrice: number;
    leaderboard: unknown;
  },
) {
  await pool.query(
    `insert into match_ticks (match_id, tick, ts, btc_price, leaderboard)
     values ($1, $2, $3, $4, $5)
     on conflict (match_id, tick) do nothing`,
    [input.matchId, input.tick, input.ts, input.btcPrice, input.leaderboard],
  );
}
