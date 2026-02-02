import type { Pool } from "pg";

export type YellowSessionDbRow = {
  wallet: string;
  expires_at: string;
  enc_version: number;
  enc_iv: string;
  enc_tag: string;
  enc_data: string;
  created_at: string;
  updated_at: string;
};

export async function upsertYellowSession(
  pool: Pool,
  input: {
    wallet: string;
    expiresAt: bigint;
    encVersion: number;
    encIv: string;
    encTag: string;
    encData: string;
  },
) {
  await pool.query(
    `insert into yellow_sessions (wallet, expires_at, enc_version, enc_iv, enc_tag, enc_data)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (wallet) do update
       set expires_at = excluded.expires_at,
           enc_version = excluded.enc_version,
           enc_iv = excluded.enc_iv,
           enc_tag = excluded.enc_tag,
           enc_data = excluded.enc_data,
           updated_at = now()`,
    [
      input.wallet.toLowerCase(),
      input.expiresAt.toString(),
      input.encVersion,
      input.encIv,
      input.encTag,
      input.encData,
    ],
  );
}

export async function deleteYellowSession(pool: Pool, wallet: string) {
  await pool.query("delete from yellow_sessions where wallet = $1", [
    wallet.toLowerCase(),
  ]);
}

export async function listActiveYellowSessions(pool: Pool, nowSec: bigint) {
  const res = await pool.query<YellowSessionDbRow>(
    `select wallet, expires_at, enc_version, enc_iv, enc_tag, enc_data, created_at, updated_at
       from yellow_sessions
      where expires_at > $1
      order by updated_at desc
      limit 500`,
    [nowSec.toString()],
  );
  return res.rows;
}

export async function deleteExpiredYellowSessions(pool: Pool, nowSec: bigint) {
  await pool.query("delete from yellow_sessions where expires_at <= $1", [
    nowSec.toString(),
  ]);
}

