alter table agents
  add column if not exists strategy text not null default 'trend';

