-- Simplify setup evaluations:
-- keep the form-based grading engine, add the currency pair to each evaluation,
-- and remove the unused trade-plan layer.

drop policy if exists "Trade setup evaluations are insertable by owner" on public.trade_setup_evaluations;
drop policy if exists "Trade setup evaluations are updatable by owner" on public.trade_setup_evaluations;

alter table public.trade_setup_evaluations
  add column if not exists symbol text not null default '';

alter table public.trade_setup_evaluations
  drop column if exists trade_plan_id;

drop table if exists public.trade_plans;
drop table if exists public.pair_grade_entries;

drop trigger if exists trg_trade_setup_evaluations_lock_pre_trade on public.trade_setup_evaluations;
drop trigger if exists trg_trade_setup_evaluations_prevent_rewrite on public.trade_setup_evaluations;

create index if not exists idx_trade_setup_evaluations_user_symbol
  on public.trade_setup_evaluations (user_id, symbol, graded_at desc);

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
  );

drop policy if exists "Trade setup evaluations are updatable by owner" on public.trade_setup_evaluations;
create policy "Trade setup evaluations are updatable by owner"
on public.trade_setup_evaluations for update
using (auth.uid() = user_id)
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
);
