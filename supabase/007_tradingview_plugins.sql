-- PnL Ledger - TradingView plugin library
-- Adds a shared TradingView Pine Script library with owner-only management.

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

create table if not exists public.tradingview_plugins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  code text not null,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tradingview_plugins_user_created
on public.tradingview_plugins (user_id, created_at desc);

drop trigger if exists trg_tradingview_plugins_updated_at on public.tradingview_plugins;
create trigger trg_tradingview_plugins_updated_at
before update on public.tradingview_plugins
for each row execute function public.set_updated_at();

alter table public.tradingview_plugins enable row level security;

drop policy if exists "TradingView plugins are readable by owner" on public.tradingview_plugins;
create policy "TradingView plugins are readable by authenticated users"
on public.tradingview_plugins
for select
to authenticated
using (true);

drop policy if exists "TradingView plugins are insertable by owner" on public.tradingview_plugins;
create policy "TradingView plugins are insertable by owner"
on public.tradingview_plugins
for insert
with check (auth.uid() = user_id);

drop policy if exists "TradingView plugins are updatable by owner" on public.tradingview_plugins;
create policy "TradingView plugins are updatable by owner"
on public.tradingview_plugins
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "TradingView plugins are deletable by owner" on public.tradingview_plugins;
create policy "TradingView plugins are deletable by owner"
on public.tradingview_plugins
for delete
using (auth.uid() = user_id);
