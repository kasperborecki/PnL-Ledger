-- Pre-trade plans are editable trade ideas that can be evaluated before
-- an actual active/closed trade exists.

create table if not exists public.trade_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  setup_id uuid references public.trading_setups (id) on delete set null,
  setup_evaluation_id uuid references public.trade_setup_evaluations (id) on delete set null,
  symbol text not null references public.instruments (symbol) on update cascade on delete restrict,
  direction text not null default 'Long' check (direction in ('Long', 'Short')),
  status text not null default 'watching' check (status in ('watching', 'ready', 'triggered', 'invalidated', 'archived')),
  timeframe text not null default '',
  session text check (session in ('Asia', 'London', 'New York')),
  planned_entry numeric(18,8) not null default 0,
  planned_stop_loss numeric(18,8) not null default 0,
  planned_take_profit numeric(18,8) not null default 0,
  size numeric(18,4) not null default 0,
  risk_percent numeric(6,2) not null default 0 check (risk_percent >= 0 and risk_percent <= 100),
  thesis text not null default '',
  trigger_notes text not null default '',
  invalidation_notes text not null default '',
  chart_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trade_setup_evaluations
  add column if not exists trade_plan_id uuid references public.trade_plans (id) on delete set null;

create index if not exists idx_trade_plans_user_status
  on public.trade_plans (user_id, status, updated_at desc);
create index if not exists idx_trade_plans_setup
  on public.trade_plans (setup_id);
create index if not exists idx_trade_setup_evaluations_plan
  on public.trade_setup_evaluations (trade_plan_id);

drop trigger if exists trg_trade_plans_updated_at on public.trade_plans;
create trigger trg_trade_plans_updated_at
before update on public.trade_plans
for each row execute function public.set_updated_at();

alter table public.trade_plans enable row level security;

drop policy if exists "Trade plans are readable by owner" on public.trade_plans;
create policy "Trade plans are readable by owner"
on public.trade_plans for select
using (auth.uid() = user_id);

drop policy if exists "Trade plans are insertable by owner" on public.trade_plans;
create policy "Trade plans are insertable by owner"
on public.trade_plans for insert
with check (auth.uid() = user_id);

drop policy if exists "Trade plans are updatable by owner" on public.trade_plans;
create policy "Trade plans are updatable by owner"
on public.trade_plans for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Trade plans are deletable by owner" on public.trade_plans;
create policy "Trade plans are deletable by owner"
on public.trade_plans for delete
using (auth.uid() = user_id);

drop policy if exists "Trade setup evaluations are insertable by owner" on public.trade_setup_evaluations;
create policy "Trade setup evaluations are insertable by owner"
on public.trade_setup_evaluations for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.trading_setups s
      where s.id = trade_setup_evaluations.setup_id
        and s.user_id = auth.uid()
    )
    and (
      trade_setup_evaluations.trade_id is null
      or exists (
        select 1 from public.trades t
        where t.id = trade_setup_evaluations.trade_id
          and t.user_id = auth.uid()
      )
    )
    and (
      trade_setup_evaluations.open_trade_id is null
      or exists (
        select 1 from public.open_trades ot
        where ot.id = trade_setup_evaluations.open_trade_id
          and ot.user_id = auth.uid()
      )
    )
    and (
      trade_setup_evaluations.trade_plan_id is null
      or exists (
        select 1 from public.trade_plans tp
        where tp.id = trade_setup_evaluations.trade_plan_id
          and tp.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Trade setup evaluations are updatable by owner" on public.trade_setup_evaluations;
create policy "Trade setup evaluations are updatable by owner"
on public.trade_setup_evaluations for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    trade_setup_evaluations.trade_id is null
    or exists (
      select 1 from public.trades t
      where t.id = trade_setup_evaluations.trade_id
        and t.user_id = auth.uid()
    )
  )
  and (
    trade_setup_evaluations.open_trade_id is null
    or exists (
      select 1 from public.open_trades ot
      where ot.id = trade_setup_evaluations.open_trade_id
        and ot.user_id = auth.uid()
    )
  )
  and (
    trade_setup_evaluations.trade_plan_id is null
    or exists (
      select 1 from public.trade_plans tp
      where tp.id = trade_setup_evaluations.trade_plan_id
        and tp.user_id = auth.uid()
    )
  )
);
