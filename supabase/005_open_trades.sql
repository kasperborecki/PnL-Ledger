-- PnL Ledger - open trades flow
-- Run this to support starting a trade first and closing it later.

create table if not exists public.open_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null references public.instruments (symbol) on update cascade on delete restrict,
  trade_date date not null,
  trade_time time without time zone not null,
  direction text not null check (direction in ('Long', 'Short')),
  setup text not null,
  session text not null check (session in ('Asia', 'London', 'New York')),
  emotion text not null,
  entry numeric(18,8) not null default 0,
  stop_loss numeric(18,8) not null default 0,
  take_profit numeric(18,8) not null default 0,
  size numeric(18,4) not null default 0,
  risk_percent numeric(6,2) not null default 0 check (risk_percent >= 0 and risk_percent <= 100),
  why_entered text not null default '',
  notes text not null default '',
  screenshot_label text not null default 'Before trade',
  screenshot_storage_path text,
  screenshot_public_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_open_trades_user_date on public.open_trades (user_id, trade_date desc, trade_time desc);

drop trigger if exists trg_open_trades_updated_at on public.open_trades;
create trigger trg_open_trades_updated_at
before update on public.open_trades
for each row execute function public.set_updated_at();

alter table public.open_trades enable row level security;

drop policy if exists "Open trades are readable by owner" on public.open_trades;
create policy "Open trades are readable by owner"
on public.open_trades
for select
using (auth.uid() = user_id);

drop policy if exists "Open trades are insertable by owner" on public.open_trades;
create policy "Open trades are insertable by owner"
on public.open_trades
for insert
with check (auth.uid() = user_id);

drop policy if exists "Open trades are updatable by owner" on public.open_trades;
create policy "Open trades are updatable by owner"
on public.open_trades
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Open trades are deletable by owner" on public.open_trades;
create policy "Open trades are deletable by owner"
on public.open_trades
for delete
using (auth.uid() = user_id);
