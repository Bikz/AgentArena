alter table agents
  add column if not exists prompt_hash text null;

