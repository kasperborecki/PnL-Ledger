-- One-time repair for existing Supabase accounts.
-- Use this if old users existed before profile rows / balance triggers were added.

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

drop trigger if exists trg_trades_balance_sync on public.trades;
create trigger trg_trades_balance_sync
after insert or update or delete on public.trades
for each row execute function public.sync_profile_balance_after_trade_change();

drop trigger if exists trg_account_transactions_balance_sync on public.account_transactions;
create trigger trg_account_transactions_balance_sync
after insert or update or delete on public.account_transactions
for each row execute function public.sync_profile_balance_after_transaction_change();

insert into public.profiles (
  id,
  email,
  display_name,
  avatar_url,
  timezone,
  base_currency,
  starting_balance,
  current_balance
)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(coalesce(u.email, ''), '@', 1), 'Trader'),
  null,
  'Europe/Warsaw',
  'USD',
  0,
  0
from auth.users u
on conflict (id) do nothing;

update public.profiles p
set current_balance =
  coalesce(p.starting_balance, 0)
  + coalesce((
      select sum(t.amount)
      from public.account_transactions t
      where t.user_id = p.id
    ), 0)
  + coalesce((
      select sum(tr.net_pnl)
      from public.trades tr
      where tr.user_id = p.id
    ), 0),
    updated_at = now();
