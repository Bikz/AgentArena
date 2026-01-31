import type { Pool } from "pg";
import crypto from "node:crypto";

export type AgentRow = {
  id: string;
  created_at: string;
  name: string;
  prompt: string;
  model: string;
};

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function listAgents(pool: Pool) {
  const res = await pool.query<AgentRow>(
    "select id, created_at, name, prompt, model from agents order by created_at desc limit 100",
  );
  return res.rows;
}

export async function createAgent(
  pool: Pool,
  input: { name: string; prompt: string; model: string },
) {
  const id = newId("agent");
  await pool.query(
    "insert into agents (id, name, prompt, model) values ($1, $2, $3, $4)",
    [id, input.name, input.prompt, input.model],
  );
  return id;
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

  return {
    match,
    seats: seatsRes.rows,
    ticks: ticksRes.rows,
  };
}

