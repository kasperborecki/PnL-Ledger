-- Run once after schema.sql (and existing migrations) in the Supabase SQL editor.
-- Transactional migration: existing records are assigned to a personal Legacy account.
begin;

create table public.trading_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  firm text not null default '',
  reference text not null default '',
  kind text not null default 'prop' check (kind in ('prop', 'personal', 'demo')),
  stage text not null default 'challenge' check (stage in ('challenge', 'verification', 'funded', 'live', 'demo')),
  status text not null default 'active' check (status in ('active', 'passed', 'lost', 'closed')),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  nominal_balance numeric(14,2) not null check (nominal_balance >= 0),
  starting_balance numeric(14,2) not null check (starting_balance >= 0),
  profit_split numeric(5,2) not null default 80 check (profit_split between 0 and 100),
  profit_target numeric(14,2) check (profit_target > 0),
  daily_loss_limit numeric(14,2) check (daily_loss_limit > 0),
  max_loss_limit numeric(14,2) check (max_loss_limit > 0),
  rules_notes text not null default '',
  started_on date not null default current_date,
  ended_on date,
  status_reason text not null default '',
  notes text not null default '',
  predecessor_id uuid,
  is_legacy boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, predecessor_id) references public.trading_accounts(user_id, id),
  check (predecessor_id is distinct from id),
  check ((kind = 'prop' and stage in ('challenge', 'verification', 'funded')) or
    (kind = 'personal' and stage = 'live') or (kind = 'demo' and stage = 'demo')),
  check (ended_on is null or ended_on >= started_on),
  check ((status = 'active' and ended_on is null) or (status <> 'active' and ended_on is not null)),
  check (status <> 'lost' or length(trim(status_reason)) > 0)
);
create unique index trading_accounts_one_legacy on public.trading_accounts(user_id) where is_legacy;

-- Stop mixing prop capital and personal money in the old profile balance.
drop trigger if exists trg_trades_balance_sync on public.trades;
drop trigger if exists trg_account_transactions_balance_sync on public.account_transactions;
drop trigger if exists trg_profiles_balance_sync on public.profiles;
drop trigger if exists trg_profiles_balance_init on public.profiles;

alter table public.trades add column account_id uuid;
alter table public.open_trades add column account_id uuid;
alter table public.account_transactions add column account_id uuid;

insert into public.trading_accounts
  (user_id, name, kind, stage, currency, nominal_balance, starting_balance, is_legacy, started_on, notes)
select p.id, 'Legacy account', 'personal', 'live', p.base_currency,
  greatest(p.starting_balance, 0), greatest(p.starting_balance, 0), true,
  least(p.created_at::date,
    coalesce((select min(t.trade_date) from public.trades t where t.user_id = p.id), p.created_at::date),
    coalesce((select min(t.trade_date) from public.open_trades t where t.user_id = p.id), p.created_at::date)),
  'Migrated from the previous shared balance. Review the account type and details.'
from public.profiles p;

-- Also preserve trades belonging to an older auth user without a profile row.
insert into public.trading_accounts (user_id, name, kind, stage, nominal_balance, starting_balance, is_legacy)
select u.id, 'Legacy account', 'personal', 'live', 0, 0, true from auth.users u
where not exists (select 1 from public.trading_accounts a where a.user_id = u.id);

update public.trades t set account_id = a.id from public.trading_accounts a where a.user_id = t.user_id and a.is_legacy;
update public.open_trades t set account_id = a.id from public.trading_accounts a where a.user_id = t.user_id and a.is_legacy;
update public.account_transactions t set account_id = a.id from public.trading_accounts a where a.user_id = t.user_id and a.is_legacy;

alter table public.trades alter column account_id set not null;
alter table public.open_trades alter column account_id set not null;
alter table public.account_transactions alter column account_id set not null;
alter table public.trades add constraint trades_account_owner_fk foreign key (user_id, account_id) references public.trading_accounts(user_id, id);
alter table public.open_trades add constraint open_trades_account_owner_fk foreign key (user_id, account_id) references public.trading_accounts(user_id, id);
alter table public.account_transactions add constraint account_transactions_owner_fk foreign key (user_id, account_id) references public.trading_accounts(user_id, id);
create index trades_account_date on public.trades(account_id, trade_date);
create index open_trades_account_date on public.open_trades(account_id, trade_date);
create index account_transactions_account on public.account_transactions(account_id);

create table public.account_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'received', 'rejected')),
  requested_on date not null default current_date,
  received_on date,
  gross_amount numeric(14,2) not null check (gross_amount > 0),
  profit_split numeric(5,2) not null check (profit_split between 0 and 100),
  received_amount numeric(14,2) not null default 0 check (received_amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- Signed movement in account currency; separate from the money received.
  balance_effect numeric(14,2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, account_id, id),
  foreign key (user_id, account_id) references public.trading_accounts(user_id, id),
  check ((status = 'received' and received_on is not null and received_amount > 0) or
    (status <> 'received' and received_on is null and received_amount = 0)),
  check (received_on is null or received_on >= requested_on)
);

-- Costs/refunds paid from/to the trader's own pocket, never trading balance.
create table public.account_cash_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  kind text not null check (kind in ('challenge', 'reset', 'fee', 'refund')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  happened_on date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  foreign key (user_id, account_id) references public.trading_accounts(user_id, id)
);

create table public.account_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  event_type text not null,
  happened_on date not null,
  description text not null,
  created_at timestamptz not null default now(),
  foreign key (user_id, account_id) references public.trading_accounts(user_id, id)
);

create table public.account_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  payout_id uuid,
  name text not null check (length(trim(name)) between 1 and 200),
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  foreign key (user_id, account_id) references public.trading_accounts(user_id, id),
  foreign key (user_id, account_id, payout_id) references public.account_payouts(user_id, account_id, id),
  check (split_part(storage_path, '/', 1) = user_id::text),
  check (split_part(storage_path, '/', 2) = account_id::text)
);

create index account_payouts_account on public.account_payouts(account_id);
create index account_cash_entries_account on public.account_cash_entries(account_id);
create index account_events_account on public.account_events(account_id, created_at desc);
create index account_documents_account on public.account_documents(account_id);

-- New balance movements must use account currency; legacy rows stay untouched.
create function public.validate_account_movement() returns trigger
language plpgsql set search_path = public as $$
begin
  if not exists(select 1 from public.trading_accounts a where a.id = new.account_id and a.user_id = new.user_id and a.currency = new.currency) then
    raise exception 'Balance movements must use the account currency.';
  end if;
  if new.trade_id is not null and not exists(select 1 from public.trades t where t.id = new.trade_id and t.user_id = new.user_id and t.account_id = new.account_id) then
    raise exception 'The linked trade must belong to the same account.';
  end if;
  return new;
end;
$$;
create trigger account_movement_validation before insert or update on public.account_transactions for each row execute function public.validate_account_movement();

-- Composite foreign keys above prevent attaching another user's accounts/payouts.
alter table public.trading_accounts enable row level security;
alter table public.account_payouts enable row level security;
alter table public.account_cash_entries enable row level security;
alter table public.account_events enable row level security;
alter table public.account_documents enable row level security;
create policy accounts_read on public.trading_accounts for select to authenticated using (user_id = auth.uid());
create policy accounts_insert on public.trading_accounts for insert to authenticated with check (user_id = auth.uid());
create policy accounts_update on public.trading_accounts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy payouts_owner on public.account_payouts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cash_entries_owner on public.account_cash_entries for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy documents_owner on public.account_documents for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy events_read on public.account_events for select to authenticated using (user_id = auth.uid());

create function public.record_trading_account_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.account_events(user_id, account_id, event_type, happened_on, description)
    values (new.user_id, new.id, 'created', new.started_on, 'Account created: ' || new.name || ' (' || new.stage || ')');
  else
    if new.user_id is distinct from old.user_id or new.predecessor_id is distinct from old.predecessor_id then
      raise exception 'Account owner and predecessor cannot be changed.';
    end if;
    if new.currency <> old.currency and (
      exists(select 1 from public.trades where account_id = new.id) or
      exists(select 1 from public.open_trades where account_id = new.id) or
      exists(select 1 from public.account_transactions where account_id = new.id) or
      exists(select 1 from public.account_payouts where account_id = new.id)
    ) then raise exception 'Currency cannot be changed after account activity.'; end if;
    if new.status is distinct from old.status or new.ended_on is distinct from old.ended_on or new.status_reason is distinct from old.status_reason then
      insert into public.account_events(user_id, account_id, event_type, happened_on, description)
      values(new.user_id, new.id, 'status', coalesce(new.ended_on, current_date), old.status || ' → ' || new.status || ': ' || new.status_reason);
    end if;
    if new.starting_balance is distinct from old.starting_balance then
      insert into public.account_events(user_id, account_id, event_type, happened_on, description)
      values(new.user_id, new.id, 'balance', current_date, 'Starting balance: ' || old.starting_balance || ' → ' || new.starting_balance);
    end if;
    if new.stage is distinct from old.stage then
      insert into public.account_events(user_id, account_id, event_type, happened_on, description)
      values(new.user_id, new.id, 'stage', current_date, 'Stage corrected: ' || old.stage || ' → ' || new.stage);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.record_trading_account_event() from public;
create trigger trading_accounts_history after insert or update on public.trading_accounts for each row execute function public.record_trading_account_event();
create trigger trading_accounts_updated before update on public.trading_accounts for each row execute function public.set_updated_at();
create trigger account_payouts_updated before update on public.account_payouts for each row execute function public.set_updated_at();

insert into public.account_events(user_id, account_id, event_type, happened_on, description)
select user_id, id, 'migrated', current_date, 'Existing balance, trades and cash movements preserved in Legacy account.' from public.trading_accounts;

-- Live derived balances avoid stale cached totals and handle edits/moves/deletions.
-- security_invoker is essential: underlying table RLS must apply to this view.
create view public.trading_account_balances with (security_invoker = true) as
select a.*,
  coalesce(t.pnl, 0) as trading_pnl,
  coalesce(t.trade_count, 0) as trade_count,
  a.starting_balance + coalesce(t.pnl, 0) + coalesce(m.amount, 0) + coalesce(p.effect, 0) as current_balance
from public.trading_accounts a
left join (select account_id, sum(net_pnl) pnl, count(*) trade_count from public.trades group by account_id) t on t.account_id = a.id
left join (select account_id, sum(amount) amount from public.account_transactions group by account_id) m on m.account_id = a.id
left join (select account_id, sum(balance_effect) effect from public.account_payouts where status = 'received' group by account_id) p on p.account_id = a.id;

grant select, insert, update on public.trading_accounts to authenticated;
grant select, insert, update, delete on public.account_payouts, public.account_cash_entries, public.account_documents to authenticated;
grant select on public.account_events, public.trading_account_balances to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('account-documents', 'account-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict(id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy account_documents_storage_read on storage.objects for select to authenticated
using(bucket_id = 'account-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy account_documents_storage_insert on storage.objects for insert to authenticated
with check(bucket_id = 'account-documents' and (storage.foldername(name))[1] = auth.uid()::text and
  exists(select 1 from public.trading_accounts a where a.id::text = (storage.foldername(storage.objects.name))[2] and a.user_id = auth.uid()));
create policy account_documents_storage_delete on storage.objects for delete to authenticated
using(bucket_id = 'account-documents' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
