alter table match_seats
  add column if not exists owner_address text null;

create index if not exists idx_match_seats_owner_address on match_seats(owner_address);
create index if not exists idx_match_seats_agent_id on match_seats(agent_id);

