alter table agents
  add column if not exists ens_name text null,
  add column if not exists ens_node text null,
  add column if not exists ens_tx_hash text null,
  add column if not exists ens_claimed_at timestamptz null;

