-- Agent Arena initial schema (v0)

create table if not exists agents (
  id text primary key,
  created_at timestamptz not null default now(),
  name text not null,
  prompt text not null,
  model text not null
);

create table if not exists matches (
  id text primary key,
  created_at timestamptz not null default now(),
  phase text not null,
  tick_interval_ms integer not null,
  max_ticks integer not null,
  start_price numeric not null
);

create table if not exists match_seats (
  match_id text not null references matches(id) on delete cascade,
  seat_id text not null,
  agent_id text null references agents(id) on delete set null,
  agent_name text not null,
  strategy text not null,
  primary key (match_id, seat_id)
);

create table if not exists match_ticks (
  match_id text not null references matches(id) on delete cascade,
  tick integer not null,
  ts timestamptz not null,
  btc_price numeric not null,
  leaderboard jsonb not null,
  primary key (match_id, tick)
);

