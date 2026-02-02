create table if not exists match_payments (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  match_id text null references matches(id) on delete cascade,
  kind text not null, -- entry|refund|payout
  asset text not null,
  amount text not null, -- base units
  from_wallet text null,
  to_wallet text null,
  client_id text null,
  tx jsonb null
);

create index if not exists idx_match_payments_match_id on match_payments(match_id);
