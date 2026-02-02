create table if not exists yellow_sessions (
  wallet text primary key,
  expires_at bigint not null,
  enc_version int not null default 1,
  enc_iv text not null,
  enc_tag text not null,
  enc_data text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_yellow_sessions_expires_at on yellow_sessions(expires_at);

