-- PnL Ledger - Supabase schema
-- Tables:
-- 1) profiles
-- 2) instruments
-- 3) trades
-- 4) trade_setups
-- 5) trade_emotions
-- 6) trade_screenshots
-- 7) playbook_setups
-- 8) account_transactions
--
-- Notes:
-- - Dashboard, analytics, calendar and journal views are derived from trades.
-- - Instruments, setups and emotions are live dictionaries and can be managed directly in Supabase.
-- - Tags are stored as text[] on trades for simplicity.
-- - Screenshots and profile avatars are stored in Supabase Storage.
-- - Account balance is derived from starting balance + deposits/withdrawals + trade P&L.

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  timezone text not null default 'Europe/Warsaw',
  base_currency char(3) not null default 'USD',
  starting_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists starting_balance numeric(14,2) not null default 0;

alter table public.profiles
  add column if not exists current_balance numeric(14,2) not null default 0;

create table if not exists public.instruments (
  symbol text primary key,
  display_name text not null,
  asset_class text not null check (asset_class in ('forex', 'index', 'commodity', 'crypto', 'stock')),
  price_precision smallint not null default 2 check (price_precision between 0 and 8),
  tick_size numeric(18,8) not null default 0.0001,
  contract_size numeric(18,4) not null default 1,
  lot_step numeric(18,4) not null default 0.01,
  currency char(3) not null default 'USD',
  sort_order integer not null default 0,
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.instruments
  add column if not exists tick_size numeric(18,8) not null default 0.0001;

alter table public.instruments
  add column if not exists contract_size numeric(18,4) not null default 1;

alter table public.instruments
  add column if not exists lot_step numeric(18,4) not null default 0.01;

alter table public.instruments
  add column if not exists currency char(3) not null default 'USD';

alter table public.instruments
  add column if not exists sort_order integer not null default 0;

alter table public.instruments
  add column if not exists notes text not null default '';

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

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null references public.instruments (symbol) on update cascade on delete restrict,
  trade_date date not null,
  trade_time time without time zone not null,
  direction text not null check (direction in ('Long', 'Short')),
  setup text not null,
  session text not null check (session in ('Asia', 'London', 'New York')),
  emotion text not null,
  result text not null check (result in ('Win', 'Loss', 'BE')),
  net_pnl numeric(14,2) not null default 0,
  gross_pnl numeric(14,2) not null default 0,
  commission numeric(14,2) not null default 0,
  rr numeric(10,2) not null default 0,
  hold_minutes integer not null default 0 check (hold_minutes >= 0),
  entry numeric(18,8) not null default 0,
  exit numeric(18,8) not null default 0,
  stop_loss numeric(18,8) not null default 0,
  take_profit numeric(18,8) not null default 0,
  size numeric(18,4) not null default 0,
  risk_percent numeric(6,2) not null default 0 check (risk_percent >= 0 and risk_percent <= 100),
  why_entered text not null default '',
  what_went_well text not null default '',
  what_to_improve text not null default '',
  notes text not null default '',
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trade_id uuid references public.trades (id) on delete set null,
  transaction_type text not null check (transaction_type in ('deposit', 'withdrawal', 'adjustment', 'fee', 'transfer_in', 'transfer_out')),
  amount numeric(14,2) not null check (amount <> 0),
  currency char(3) not null default 'USD',
  happened_at timestamptz not null default now(),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trade_screenshots (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  slot smallint not null check (slot in (1, 2)),
  label text not null,
  storage_path text,
  public_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trade_id, slot)
);

create table if not exists public.playbook_setups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  grade text not null check (grade in ('A', 'B', 'C', 'D')),
  trades integer not null default 0 check (trades >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  win_rate numeric(5,2) not null default 0 check (win_rate >= 0 and win_rate <= 100),
  avg_rr numeric(10,2) not null default 0,
  pnl numeric(14,2) not null default 0,
  expectancy numeric(14,2) not null default 0,
  profit_factor numeric(12,2) not null default 0,
  thesis text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('trade-screenshots', 'trade-screenshots', true)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

create index if not exists idx_trades_user_date on public.trades (user_id, trade_date desc, trade_time desc);
create index if not exists idx_trades_user_symbol on public.trades (user_id, symbol);
create index if not exists idx_trades_user_setup on public.trades (user_id, setup);
create index if not exists idx_trades_user_session on public.trades (user_id, session);
create index if not exists idx_trades_user_emotion on public.trades (user_id, emotion);
create index if not exists idx_account_transactions_user_time on public.account_transactions (user_id, happened_at desc);
create index if not exists idx_account_transactions_trade on public.account_transactions (trade_id);
create index if not exists idx_trade_screenshots_trade on public.trade_screenshots (trade_id, slot);
create index if not exists idx_playbook_user_pnl on public.playbook_setups (user_id, pnl desc);

create or replace function public.recalculate_profile_balance(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_starting_balance numeric(14,2) := 0;
  transaction_total numeric(14,2) := 0;
  trading_total numeric(14,2) := 0;
begin
  select coalesce(p.starting_balance, 0)
  into v_starting_balance
  from public.profiles p
  where p.id = target_user_id;

  select coalesce(sum(t.amount), 0)
  into transaction_total
  from public.account_transactions t
  where t.user_id = target_user_id;

  select coalesce(sum(tr.net_pnl), 0)
  into trading_total
  from public.trades tr
  where tr.user_id = target_user_id;

  update public.profiles p
  set current_balance = v_starting_balance + transaction_total + trading_total,
      updated_at = now()
  where p.id = target_user_id;
end;
$$;

create or replace function public.sync_profile_balance_after_trade_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_profile_balance(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.sync_profile_balance_after_transaction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_profile_balance(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.sync_profile_balance_after_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_profile_balance(new.id);
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_balance_sync on public.profiles;
create trigger trg_profiles_balance_sync
after update of starting_balance on public.profiles
for each row execute function public.sync_profile_balance_after_profile_change();

drop trigger if exists trg_profiles_balance_init on public.profiles;
create trigger trg_profiles_balance_init
after insert on public.profiles
for each row execute function public.sync_profile_balance_after_profile_change();

drop trigger if exists trg_instruments_updated_at on public.instruments;
create trigger trg_instruments_updated_at
before update on public.instruments
for each row execute function public.set_updated_at();

drop trigger if exists trg_trade_setups_updated_at on public.trade_setups;
create trigger trg_trade_setups_updated_at
before update on public.trade_setups
for each row execute function public.set_updated_at();

drop trigger if exists trg_trade_emotions_updated_at on public.trade_emotions;
create trigger trg_trade_emotions_updated_at
before update on public.trade_emotions
for each row execute function public.set_updated_at();

drop trigger if exists trg_trades_updated_at on public.trades;
create trigger trg_trades_updated_at
before update on public.trades
for each row execute function public.set_updated_at();

drop trigger if exists trg_trades_balance_sync on public.trades;
create trigger trg_trades_balance_sync
after insert or update or delete on public.trades
for each row execute function public.sync_profile_balance_after_trade_change();

drop trigger if exists trg_account_transactions_updated_at on public.account_transactions;
create trigger trg_account_transactions_updated_at
before update on public.account_transactions
for each row execute function public.set_updated_at();

drop trigger if exists trg_account_transactions_balance_sync on public.account_transactions;
create trigger trg_account_transactions_balance_sync
after insert or update or delete on public.account_transactions
for each row execute function public.sync_profile_balance_after_transaction_change();

drop trigger if exists trg_trade_screenshots_updated_at on public.trade_screenshots;
create trigger trg_trade_screenshots_updated_at
before update on public.trade_screenshots
for each row execute function public.set_updated_at();

drop trigger if exists trg_playbook_setups_updated_at on public.playbook_setups;
create trigger trg_playbook_setups_updated_at
before update on public.playbook_setups
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.instruments enable row level security;
alter table public.trade_setups enable row level security;
alter table public.trade_emotions enable row level security;
alter table public.trades enable row level security;
alter table public.account_transactions enable row level security;
alter table public.trade_screenshots enable row level security;
alter table public.playbook_setups enable row level security;

drop policy if exists "Trade screenshots bucket read access" on storage.objects;
create policy "Trade screenshots bucket read access"
on storage.objects
for select
to authenticated
using (bucket_id = 'trade-screenshots' and owner = auth.uid());

drop policy if exists "Trade screenshots bucket insert access" on storage.objects;
create policy "Trade screenshots bucket insert access"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'trade-screenshots' and owner = auth.uid());

drop policy if exists "Trade screenshots bucket update access" on storage.objects;
create policy "Trade screenshots bucket update access"
on storage.objects
for update
to authenticated
using (bucket_id = 'trade-screenshots' and owner = auth.uid())
with check (bucket_id = 'trade-screenshots' and owner = auth.uid());

drop policy if exists "Trade screenshots bucket delete access" on storage.objects;
create policy "Trade screenshots bucket delete access"
on storage.objects
for delete
to authenticated
using (bucket_id = 'trade-screenshots' and owner = auth.uid());

drop policy if exists "Profile avatars bucket read access" on storage.objects;
create policy "Profile avatars bucket read access"
on storage.objects
for select
to authenticated
using (bucket_id = 'profile-avatars' and owner = auth.uid());

drop policy if exists "Profile avatars bucket insert access" on storage.objects;
create policy "Profile avatars bucket insert access"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'profile-avatars' and owner = auth.uid());

drop policy if exists "Profile avatars bucket update access" on storage.objects;
create policy "Profile avatars bucket update access"
on storage.objects
for update
to authenticated
using (bucket_id = 'profile-avatars' and owner = auth.uid())
with check (bucket_id = 'profile-avatars' and owner = auth.uid());

drop policy if exists "Profile avatars bucket delete access" on storage.objects;
create policy "Profile avatars bucket delete access"
on storage.objects
for delete
to authenticated
using (bucket_id = 'profile-avatars' and owner = auth.uid());

drop policy if exists "Profiles are readable by owner" on public.profiles;
create policy "Profiles are readable by owner"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Profiles are insertable by owner" on public.profiles;
create policy "Profiles are insertable by owner"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Instruments are readable by authenticated users" on public.instruments;
create policy "Instruments are readable by authenticated users"
on public.instruments
for select
to authenticated
using (true);

drop policy if exists "Instruments are insertable by authenticated users" on public.instruments;
create policy "Instruments are insertable by authenticated users"
on public.instruments
for insert
to authenticated
with check (true);

drop policy if exists "Instruments are updatable by authenticated users" on public.instruments;
create policy "Instruments are updatable by authenticated users"
on public.instruments
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Instruments are deletable by authenticated users" on public.instruments;
create policy "Instruments are deletable by authenticated users"
on public.instruments
for delete
to authenticated
using (true);

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

drop policy if exists "Trades are readable by owner" on public.trades;
create policy "Trades are readable by owner"
on public.trades
for select
using (auth.uid() = user_id);

drop policy if exists "Trades are insertable by owner" on public.trades;
create policy "Trades are insertable by owner"
on public.trades
for insert
with check (auth.uid() = user_id);

drop policy if exists "Trades are updatable by owner" on public.trades;
create policy "Trades are updatable by owner"
on public.trades
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Trades are deletable by owner" on public.trades;
create policy "Trades are deletable by owner"
on public.trades
for delete
using (auth.uid() = user_id);

drop policy if exists "Account transactions are readable by owner" on public.account_transactions;
create policy "Account transactions are readable by owner"
on public.account_transactions
for select
using (auth.uid() = user_id);

drop policy if exists "Account transactions are insertable by owner" on public.account_transactions;
create policy "Account transactions are insertable by owner"
on public.account_transactions
for insert
with check (auth.uid() = user_id);

drop policy if exists "Account transactions are updatable by owner" on public.account_transactions;
create policy "Account transactions are updatable by owner"
on public.account_transactions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Account transactions are deletable by owner" on public.account_transactions;
create policy "Account transactions are deletable by owner"
on public.account_transactions
for delete
using (auth.uid() = user_id);

drop policy if exists "Trade screenshots are readable by owner" on public.trade_screenshots;
create policy "Trade screenshots are readable by owner"
on public.trade_screenshots
for select
using (auth.uid() = user_id);

drop policy if exists "Trade screenshots are insertable by owner" on public.trade_screenshots;
create policy "Trade screenshots are insertable by owner"
on public.trade_screenshots
for insert
with check (auth.uid() = user_id);

drop policy if exists "Trade screenshots are updatable by owner" on public.trade_screenshots;
create policy "Trade screenshots are updatable by owner"
on public.trade_screenshots
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Trade screenshots are deletable by owner" on public.trade_screenshots;
create policy "Trade screenshots are deletable by owner"
on public.trade_screenshots
for delete
using (auth.uid() = user_id);

drop policy if exists "Playbook setups are readable by owner" on public.playbook_setups;
create policy "Playbook setups are readable by owner"
on public.playbook_setups
for select
using (auth.uid() = user_id);

drop policy if exists "Playbook setups are insertable by owner" on public.playbook_setups;
create policy "Playbook setups are insertable by owner"
on public.playbook_setups
for insert
with check (auth.uid() = user_id);

drop policy if exists "Playbook setups are updatable by owner" on public.playbook_setups;
create policy "Playbook setups are updatable by owner"
on public.playbook_setups
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Playbook setups are deletable by owner" on public.playbook_setups;
create policy "Playbook setups are deletable by owner"
on public.playbook_setups
for delete
using (auth.uid() = user_id);

insert into public.instruments (symbol, display_name, asset_class, price_precision)
values
  ('NAS100', 'Nasdaq 100', 'index', 1),
  ('US30', 'Dow Jones 30', 'index', 1),
  ('US500', 'S&P 500', 'index', 1),
  ('XAUUSD', 'Gold / XAUUSD', 'commodity', 2),
  ('EURUSD', 'EUR/USD', 'forex', 5),
  ('GBPUSD', 'GBP/USD', 'forex', 5),
  ('BTCUSD', 'Bitcoin / BTCUSD', 'crypto', 2),
  ('ETHUSD', 'Ethereum / ETHUSD', 'crypto', 2)
on conflict (symbol) do update set
  display_name = excluded.display_name,
  asset_class = excluded.asset_class,
  price_precision = excluded.price_precision,
  is_active = true,
  updated_at = now();
