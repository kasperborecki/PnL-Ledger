-- PnL Ledger - dictionary management migration
-- Run this on an existing database to add editable strategy and emotion dictionaries.

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname, pg_get_constraintdef(oid) as constraint_def
    from pg_constraint
    where conrelid = 'public.trades'::regclass
      and contype = 'c'
  loop
    if constraint_row.constraint_def ilike '%setup%' or constraint_row.constraint_def ilike '%emotion%' then
      execute format('alter table public.trades drop constraint %I', constraint_row.conname);
    end if;
  end loop;
end;
$$;

create table if not exists public.trade_setups (
  name text primary key,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trade_emotions (
  name text primary key,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_trade_setups_active_sort on public.trade_setups (is_active, sort_order, name);
create index if not exists idx_trade_emotions_active_sort on public.trade_emotions (is_active, sort_order, name);

insert into public.trade_setups (name, description, sort_order, is_active)
values
  ('Liquidity Sweep', 'Liquidity grab or stop run around an obvious high/low.', 10, true),
  ('Breakout', 'Expansion after a clear compression or range break.', 20, true),
  ('Trend Continuation', 'A pullback or pause inside an established trend.', 30, true),
  ('Pullback', 'A retracement into value before continuation.', 40, true),
  ('Range Trade', 'Mean reversion inside a defined range.', 50, true),
  ('Reversal', 'A turning point after exhaustion or failure.', 60, true)
on conflict (name) do update set
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.trade_emotions (name, description, sort_order, is_active)
values
  ('Calm', 'Fully composed and following the plan.', 10, true),
  ('Confidence', 'High conviction without forcing the trade.', 20, true),
  ('Greed', 'Trying to squeeze too much out of the move.', 30, true),
  ('Hesitation', 'Delayed entry or uncertainty after setup appeared.', 40, true),
  ('Frustration', 'Emotion started to influence the execution.', 50, true),
  ('Impulse', 'Trade taken without the checklist.', 60, true)
on conflict (name) do update set
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

drop trigger if exists trg_trade_setups_updated_at on public.trade_setups;
create trigger trg_trade_setups_updated_at
before update on public.trade_setups
for each row execute function public.set_updated_at();

drop trigger if exists trg_trade_emotions_updated_at on public.trade_emotions;
create trigger trg_trade_emotions_updated_at
before update on public.trade_emotions
for each row execute function public.set_updated_at();

alter table public.trade_setups enable row level security;
alter table public.trade_emotions enable row level security;

drop policy if exists "Trade setups are readable by authenticated users" on public.trade_setups;
create policy "Trade setups are readable by authenticated users"
on public.trade_setups
for select
to authenticated
using (true);

drop policy if exists "Trade setups are insertable by authenticated users" on public.trade_setups;
create policy "Trade setups are insertable by authenticated users"
on public.trade_setups
for insert
to authenticated
with check (true);

drop policy if exists "Trade setups are updatable by authenticated users" on public.trade_setups;
create policy "Trade setups are updatable by authenticated users"
on public.trade_setups
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Trade setups are deletable by authenticated users" on public.trade_setups;
create policy "Trade setups are deletable by authenticated users"
on public.trade_setups
for delete
to authenticated
using (true);

drop policy if exists "Trade emotions are readable by authenticated users" on public.trade_emotions;
create policy "Trade emotions are readable by authenticated users"
on public.trade_emotions
for select
to authenticated
using (true);

drop policy if exists "Trade emotions are insertable by authenticated users" on public.trade_emotions;
create policy "Trade emotions are insertable by authenticated users"
on public.trade_emotions
for insert
to authenticated
with check (true);

drop policy if exists "Trade emotions are updatable by authenticated users" on public.trade_emotions;
create policy "Trade emotions are updatable by authenticated users"
on public.trade_emotions
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Trade emotions are deletable by authenticated users" on public.trade_emotions;
create policy "Trade emotions are deletable by authenticated users"
on public.trade_emotions
for delete
to authenticated
using (true);
