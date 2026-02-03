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

export type MatchPerformanceRow = {
  match_id: string;
  created_at: string;
  phase: string;
  tick_interval_ms: number;
  max_ticks: number;
  seat_id: string;
  agent_id: string | null;
  agent_name: string;
  strategy: string;
  owner_address: string | null;
  final_tick: number | null;
  final_price: string | null;
  leaderboard: unknown | null;
};

export type AgentLeaderboardRow = {
  agent_id: string;
  agent_name: string;
  matches: number;
  wins: number;
  avg_credits: string | null;
  best_credits: string | null;
};

export type PlayerLeaderboardRow = {
  owner_address: string;
  matches: number;
  wins: number;
  avg_credits: string | null;
  best_credits: string | null;
};

export type MatchPaymentRow = {
  id: number;
  created_at: string;
  match_id: string | null;
  kind: "entry" | "refund" | "payout" | "tick_fees";
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
    kind: "entry" | "refund" | "payout" | "tick_fees";
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
    ownerAddress?: string | null;
  },
) {
  await pool.query(
    `insert into match_seats (match_id, seat_id, agent_id, agent_name, strategy, owner_address)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (match_id, seat_id) do update
       set agent_id = excluded.agent_id,
           agent_name = excluded.agent_name,
           strategy = excluded.strategy,
           owner_address = excluded.owner_address`,
    [
      input.matchId,
      input.seatId,
      input.agentId,
      input.agentName,
      input.strategy,
      input.ownerAddress ?? null,
    ],
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

export async function listAgentPerformance(
  pool: Pool,
  input: { agentId: string; limit: number },
) {
  const res = await pool.query<MatchPerformanceRow>(
    `
    select
      m.id as match_id,
      m.created_at,
      m.phase,
      m.tick_interval_ms,
      m.max_ticks,
      s.seat_id,
      s.agent_id,
      s.agent_name,
      s.strategy,
      s.owner_address,
      t.tick as final_tick,
      t.btc_price as final_price,
      t.leaderboard
    from match_seats s
    join matches m on m.id = s.match_id
    left join lateral (
      select tick, btc_price, leaderboard
      from match_ticks
      where match_id = s.match_id
      order by tick desc
      limit 1
    ) t on true
    where s.agent_id = $1
    order by m.created_at desc
    limit $2
    `,
    [input.agentId, input.limit],
  );
  return res.rows;
}

export async function listPlayerPerformance(
  pool: Pool,
  input: { ownerAddress: string; limit: number },
) {
  const res = await pool.query<MatchPerformanceRow>(
    `
    select
      m.id as match_id,
      m.created_at,
      m.phase,
      m.tick_interval_ms,
      m.max_ticks,
      s.seat_id,
      s.agent_id,
      s.agent_name,
      s.strategy,
      s.owner_address,
      t.tick as final_tick,
      t.btc_price as final_price,
      t.leaderboard
    from match_seats s
    join matches m on m.id = s.match_id
    left join lateral (
      select tick, btc_price, leaderboard
      from match_ticks
      where match_id = s.match_id
      order by tick desc
      limit 1
    ) t on true
    where lower(s.owner_address) = lower($1)
    order by m.created_at desc
    limit $2
    `,
    [input.ownerAddress, input.limit],
  );
  return res.rows;
}

export async function listAgentLeaderboard(
  pool: Pool,
  input: { limit: number; minMatches: number; sinceDays?: number | null },
) {
  const res = await pool.query<AgentLeaderboardRow>(
    `
    with latest_tick as (
      select distinct on (match_id) match_id, tick, leaderboard
      from match_ticks
      order by match_id, tick desc
    ),
    leaderboard_rows as (
      select
        lt.match_id,
        s.agent_id,
        s.agent_name,
        coalesce((e->>'credits')::numeric, 0) as credits
      from latest_tick lt
      join matches m on m.id = lt.match_id
      cross join lateral jsonb_array_elements(lt.leaderboard) e
      join match_seats s
        on s.match_id = lt.match_id
       and s.seat_id = (e->>'seatId')
      where ($3::int is null or m.created_at >= now() - ($3::int * interval '1 day'))
    ),
    ranked as (
      select
        *,
        dense_rank() over (partition by match_id order by credits desc nulls last) as rank
      from leaderboard_rows
    )
    select
      agent_id,
      agent_name,
      count(*)::int as matches,
      sum(case when rank = 1 then 1 else 0 end)::int as wins,
      avg(credits) as avg_credits,
      max(credits) as best_credits
    from ranked
    where agent_id is not null
    group by agent_id, agent_name
    having count(*) >= $2
    order by wins desc, avg_credits desc nulls last
    limit $1
    `,
    [input.limit, input.minMatches, input.sinceDays ?? null],
  );
  return res.rows;
}

export async function listPlayerLeaderboard(
  pool: Pool,
  input: { limit: number; minMatches: number; sinceDays?: number | null },
) {
  const res = await pool.query<PlayerLeaderboardRow>(
    `
    with latest_tick as (
      select distinct on (match_id) match_id, tick, leaderboard
      from match_ticks
      order by match_id, tick desc
    ),
    leaderboard_rows as (
      select
        lt.match_id,
        s.owner_address,
        coalesce((e->>'credits')::numeric, 0) as credits
      from latest_tick lt
      join matches m on m.id = lt.match_id
      cross join lateral jsonb_array_elements(lt.leaderboard) e
      join match_seats s
        on s.match_id = lt.match_id
       and s.seat_id = (e->>'seatId')
      where ($3::int is null or m.created_at >= now() - ($3::int * interval '1 day'))
    ),
    ranked as (
      select
        *,
        dense_rank() over (partition by match_id order by credits desc nulls last) as rank
      from leaderboard_rows
    )
    select
      owner_address,
      count(*)::int as matches,
      sum(case when rank = 1 then 1 else 0 end)::int as wins,
      avg(credits) as avg_credits,
      max(credits) as best_credits
    from ranked
    where owner_address is not null
    group by owner_address
    having count(*) >= $2
    order by wins desc, avg_credits desc nulls last
    limit $1
    `,
    [input.limit, input.minMatches, input.sinceDays ?? null],
  );
  return res.rows;
}
