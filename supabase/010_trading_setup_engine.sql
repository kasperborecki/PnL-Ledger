-- Universal Trading Setup Builder + Trade Grading Engine
-- This module intentionally keeps setup structure relational. JSONB is only used
-- for flexible per-criterion configuration.

create extension if not exists pgcrypto;

create table if not exists public.trading_setups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  category text not null default '',
  tags text[] not null default '{}'::text[],
  preferred_symbols text[] not null default '{}'::text[],
  preferred_session text,
  preferred_timeframe text,
  is_active boolean not null default true,
  is_archived boolean not null default false,
  is_favorite boolean not null default false,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.trading_setup_versions (
  id uuid primary key default gen_random_uuid(),
  setup_id uuid not null references public.trading_setups (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  name text not null,
  description text not null default '',
  scoring_mode text not null default 'sum_criteria' check (scoring_mode in ('sum_criteria', 'manual_max')),
  manual_max_score numeric(12,2),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete cascade,
  unique (setup_id, version_number)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trading_setups_current_version_id_fkey'
      and conrelid = 'public.trading_setups'::regclass
  ) then
    alter table public.trading_setups
      add constraint trading_setups_current_version_id_fkey
      foreign key (current_version_id)
      references public.trading_setup_versions (id)
      on delete set null;
  end if;
end;
$$;

create table if not exists public.setup_sections (
  id uuid primary key default gen_random_uuid(),
  setup_version_id uuid not null references public.trading_setup_versions (id) on delete cascade,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0,
  weight numeric(10,4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.setup_criteria (
  id uuid primary key default gen_random_uuid(),
  setup_section_id uuid not null references public.setup_sections (id) on delete cascade,
  name text not null,
  description text not null default '',
  help_text text not null default '',
  criterion_type text not null,
  max_points numeric(12,2) not null default 0 check (max_points >= 0),
  is_required boolean not null default false,
  is_bonus boolean not null default false,
  sort_order integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  validation_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.setup_criterion_options (
  id uuid primary key default gen_random_uuid(),
  criterion_id uuid not null references public.setup_criteria (id) on delete cascade,
  label text not null,
  value text not null,
  points numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.setup_grade_thresholds (
  id uuid primary key default gen_random_uuid(),
  setup_version_id uuid not null references public.trading_setup_versions (id) on delete cascade,
  label text not null,
  min_value numeric(12,2) not null default 0,
  max_value numeric(12,2) not null default 100,
  value_type text not null default 'percentage' check (value_type in ('percentage', 'score')),
  description text not null default '',
  display_token text not null default '',
  recommendation text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trade_setup_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trade_id uuid references public.trades (id) on delete set null,
  open_trade_id uuid references public.open_trades (id) on delete set null,
  setup_id uuid not null references public.trading_setups (id) on delete cascade,
  setup_version_id uuid not null references public.trading_setup_versions (id) on delete restrict,
  parent_evaluation_id uuid references public.trade_setup_evaluations (id) on delete set null,
  revision_number integer not null default 1 check (revision_number > 0),
  evaluation_type text not null default 'pre_trade' check (evaluation_type in ('pre_trade', 'post_trade_review')),
  raw_score numeric(12,2) not null default 0,
  max_score numeric(12,2) not null default 0,
  normalized_percentage numeric(8,4) not null default 0,
  grade_label text,
  is_valid boolean not null default true,
  invalid_reason text,
  notes text not null default '',
  graded_at timestamptz not null default now(),
  trade_opened_at timestamptz,
  trade_closed_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trade_setup_evaluations
  add column if not exists open_trade_id uuid references public.open_trades (id) on delete set null;

create table if not exists public.trade_setup_evaluation_answers (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.trade_setup_evaluations (id) on delete cascade,
  criterion_id uuid not null references public.setup_criteria (id) on delete restrict,
  boolean_value boolean,
  numeric_value numeric(18,8),
  text_value text,
  selected_option_id uuid references public.setup_criterion_options (id) on delete set null,
  selected_options jsonb not null default '[]'::jsonb,
  awarded_points numeric(12,2) not null default 0,
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (evaluation_id, criterion_id)
);

create index if not exists idx_trading_setups_user_state
  on public.trading_setups (user_id, is_archived, is_active, is_favorite, updated_at desc);
create index if not exists idx_trading_setup_versions_setup
  on public.trading_setup_versions (setup_id, version_number desc);
create index if not exists idx_setup_sections_version_sort
  on public.setup_sections (setup_version_id, sort_order);
create index if not exists idx_setup_criteria_section_sort
  on public.setup_criteria (setup_section_id, sort_order);
create index if not exists idx_setup_criterion_options_criterion_sort
  on public.setup_criterion_options (criterion_id, sort_order);
create index if not exists idx_setup_grade_thresholds_version_sort
  on public.setup_grade_thresholds (setup_version_id, sort_order);
create index if not exists idx_trade_setup_evaluations_user_setup
  on public.trade_setup_evaluations (user_id, setup_id, setup_version_id, graded_at desc);
create index if not exists idx_trade_setup_evaluations_trade
  on public.trade_setup_evaluations (trade_id);
create index if not exists idx_trade_setup_evaluations_open_trade
  on public.trade_setup_evaluations (open_trade_id);
create index if not exists idx_trade_setup_answers_criterion
  on public.trade_setup_evaluation_answers (criterion_id, awarded_points);

drop trigger if exists trg_trading_setups_updated_at on public.trading_setups;
create trigger trg_trading_setups_updated_at
before update on public.trading_setups
for each row execute function public.set_updated_at();

drop trigger if exists trg_setup_sections_updated_at on public.setup_sections;
create trigger trg_setup_sections_updated_at
before update on public.setup_sections
for each row execute function public.set_updated_at();

drop trigger if exists trg_setup_criteria_updated_at on public.setup_criteria;
create trigger trg_setup_criteria_updated_at
before update on public.setup_criteria
for each row execute function public.set_updated_at();

drop trigger if exists trg_setup_criterion_options_updated_at on public.setup_criterion_options;
create trigger trg_setup_criterion_options_updated_at
before update on public.setup_criterion_options
for each row execute function public.set_updated_at();

drop trigger if exists trg_setup_grade_thresholds_updated_at on public.setup_grade_thresholds;
create trigger trg_setup_grade_thresholds_updated_at
before update on public.setup_grade_thresholds
for each row execute function public.set_updated_at();

drop trigger if exists trg_trade_setup_evaluations_updated_at on public.trade_setup_evaluations;
create trigger trg_trade_setup_evaluations_updated_at
before update on public.trade_setup_evaluations
for each row execute function public.set_updated_at();

drop trigger if exists trg_trade_setup_answers_updated_at on public.trade_setup_evaluation_answers;
create trigger trg_trade_setup_answers_updated_at
before update on public.trade_setup_evaluation_answers
for each row execute function public.set_updated_at();

create or replace function public.lock_pre_trade_evaluation()
returns trigger
language plpgsql
as $$
begin
  if new.evaluation_type = 'pre_trade' and new.locked_at is null then
    new.locked_at = now();
  end if;

  return new;
end;
$$;

create or replace function public.prevent_locked_pre_trade_rewrite()
returns trigger
language plpgsql
as $$
begin
  if old.evaluation_type = 'pre_trade'
     and old.locked_at is not null
     and (
       new.raw_score is distinct from old.raw_score
       or new.max_score is distinct from old.max_score
       or new.normalized_percentage is distinct from old.normalized_percentage
       or new.grade_label is distinct from old.grade_label
       or new.is_valid is distinct from old.is_valid
       or new.invalid_reason is distinct from old.invalid_reason
       or new.setup_version_id is distinct from old.setup_version_id
     ) then
    raise exception 'Locked pre-trade evaluations cannot be rewritten; create a post-trade review revision instead.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_trade_setup_evaluations_lock_pre_trade on public.trade_setup_evaluations;
create trigger trg_trade_setup_evaluations_lock_pre_trade
before insert on public.trade_setup_evaluations
for each row execute function public.lock_pre_trade_evaluation();

drop trigger if exists trg_trade_setup_evaluations_prevent_rewrite on public.trade_setup_evaluations;
create trigger trg_trade_setup_evaluations_prevent_rewrite
before update on public.trade_setup_evaluations
for each row execute function public.prevent_locked_pre_trade_rewrite();

alter table public.trading_setups enable row level security;
alter table public.trading_setup_versions enable row level security;
alter table public.setup_sections enable row level security;
alter table public.setup_criteria enable row level security;
alter table public.setup_criterion_options enable row level security;
alter table public.setup_grade_thresholds enable row level security;
alter table public.trade_setup_evaluations enable row level security;
alter table public.trade_setup_evaluation_answers enable row level security;

drop policy if exists "Trading setups are readable by owner" on public.trading_setups;
create policy "Trading setups are readable by owner"
on public.trading_setups for select
using (auth.uid() = user_id);

drop policy if exists "Trading setups are insertable by owner" on public.trading_setups;
create policy "Trading setups are insertable by owner"
on public.trading_setups for insert
with check (auth.uid() = user_id);

drop policy if exists "Trading setups are updatable by owner" on public.trading_setups;
create policy "Trading setups are updatable by owner"
on public.trading_setups for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Trading setups are deletable by owner" on public.trading_setups;
create policy "Trading setups are deletable by owner"
on public.trading_setups for delete
using (auth.uid() = user_id);

drop policy if exists "Setup versions are readable by owner" on public.trading_setup_versions;
create policy "Setup versions are readable by owner"
on public.trading_setup_versions for select
using (exists (
  select 1 from public.trading_setups s
  where s.id = trading_setup_versions.setup_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup versions are insertable by owner" on public.trading_setup_versions;
create policy "Setup versions are insertable by owner"
on public.trading_setup_versions for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.trading_setups s
    where s.id = trading_setup_versions.setup_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "Setup versions are updatable by owner" on public.trading_setup_versions;
create policy "Setup versions are updatable by owner"
on public.trading_setup_versions for update
using (exists (
  select 1 from public.trading_setups s
  where s.id = trading_setup_versions.setup_id
    and s.user_id = auth.uid()
))
with check (exists (
  select 1 from public.trading_setups s
  where s.id = trading_setup_versions.setup_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup versions are deletable by owner" on public.trading_setup_versions;
create policy "Setup versions are deletable by owner"
on public.trading_setup_versions for delete
using (exists (
  select 1 from public.trading_setups s
  where s.id = trading_setup_versions.setup_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup sections are readable by owner" on public.setup_sections;
create policy "Setup sections are readable by owner"
on public.setup_sections for select
using (exists (
  select 1 from public.trading_setup_versions v
  join public.trading_setups s on s.id = v.setup_id
  where v.id = setup_sections.setup_version_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup sections are insertable by owner" on public.setup_sections;
create policy "Setup sections are insertable by owner"
on public.setup_sections for insert
with check (exists (
  select 1 from public.trading_setup_versions v
  join public.trading_setups s on s.id = v.setup_id
  where v.id = setup_sections.setup_version_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup sections are updatable by owner" on public.setup_sections;
create policy "Setup sections are updatable by owner"
on public.setup_sections for update
using (exists (
  select 1 from public.trading_setup_versions v
  join public.trading_setups s on s.id = v.setup_id
  where v.id = setup_sections.setup_version_id
    and s.user_id = auth.uid()
))
with check (exists (
  select 1 from public.trading_setup_versions v
  join public.trading_setups s on s.id = v.setup_id
  where v.id = setup_sections.setup_version_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup sections are deletable by owner" on public.setup_sections;
create policy "Setup sections are deletable by owner"
on public.setup_sections for delete
using (exists (
  select 1 from public.trading_setup_versions v
  join public.trading_setups s on s.id = v.setup_id
  where v.id = setup_sections.setup_version_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup criteria are readable by owner" on public.setup_criteria;
create policy "Setup criteria are readable by owner"
on public.setup_criteria for select
using (exists (
  select 1 from public.setup_sections sec
  join public.trading_setup_versions v on v.id = sec.setup_version_id
  join public.trading_setups s on s.id = v.setup_id
  where sec.id = setup_criteria.setup_section_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup criteria are insertable by owner" on public.setup_criteria;
create policy "Setup criteria are insertable by owner"
on public.setup_criteria for insert
with check (exists (
  select 1 from public.setup_sections sec
  join public.trading_setup_versions v on v.id = sec.setup_version_id
  join public.trading_setups s on s.id = v.setup_id
  where sec.id = setup_criteria.setup_section_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup criteria are updatable by owner" on public.setup_criteria;
create policy "Setup criteria are updatable by owner"
on public.setup_criteria for update
using (exists (
  select 1 from public.setup_sections sec
  join public.trading_setup_versions v on v.id = sec.setup_version_id
  join public.trading_setups s on s.id = v.setup_id
  where sec.id = setup_criteria.setup_section_id
    and s.user_id = auth.uid()
))
with check (exists (
  select 1 from public.setup_sections sec
  join public.trading_setup_versions v on v.id = sec.setup_version_id
  join public.trading_setups s on s.id = v.setup_id
  where sec.id = setup_criteria.setup_section_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup criteria are deletable by owner" on public.setup_criteria;
create policy "Setup criteria are deletable by owner"
on public.setup_criteria for delete
using (exists (
  select 1 from public.setup_sections sec
  join public.trading_setup_versions v on v.id = sec.setup_version_id
  join public.trading_setups s on s.id = v.setup_id
  where sec.id = setup_criteria.setup_section_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup options are readable by owner" on public.setup_criterion_options;
create policy "Setup options are readable by owner"
on public.setup_criterion_options for select
using (exists (
  select 1 from public.setup_criteria c
  join public.setup_sections sec on sec.id = c.setup_section_id
  join public.trading_setup_versions v on v.id = sec.setup_version_id
  join public.trading_setups s on s.id = v.setup_id
  where c.id = setup_criterion_options.criterion_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup options are insertable by owner" on public.setup_criterion_options;
create policy "Setup options are insertable by owner"
on public.setup_criterion_options for insert
with check (exists (
  select 1 from public.setup_criteria c
  join public.setup_sections sec on sec.id = c.setup_section_id
  join public.trading_setup_versions v on v.id = sec.setup_version_id
  join public.trading_setups s on s.id = v.setup_id
  where c.id = setup_criterion_options.criterion_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup options are updatable by owner" on public.setup_criterion_options;
create policy "Setup options are updatable by owner"
on public.setup_criterion_options for update
using (exists (
  select 1 from public.setup_criteria c
  join public.setup_sections sec on sec.id = c.setup_section_id
  join public.trading_setup_versions v on v.id = sec.setup_version_id
  join public.trading_setups s on s.id = v.setup_id
  where c.id = setup_criterion_options.criterion_id
    and s.user_id = auth.uid()
))
with check (exists (
  select 1 from public.setup_criteria c
  join public.setup_sections sec on sec.id = c.setup_section_id
  join public.trading_setup_versions v on v.id = sec.setup_version_id
  join public.trading_setups s on s.id = v.setup_id
  where c.id = setup_criterion_options.criterion_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup options are deletable by owner" on public.setup_criterion_options;
create policy "Setup options are deletable by owner"
on public.setup_criterion_options for delete
using (exists (
  select 1 from public.setup_criteria c
  join public.setup_sections sec on sec.id = c.setup_section_id
  join public.trading_setup_versions v on v.id = sec.setup_version_id
  join public.trading_setups s on s.id = v.setup_id
  where c.id = setup_criterion_options.criterion_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup grade thresholds are readable by owner" on public.setup_grade_thresholds;
create policy "Setup grade thresholds are readable by owner"
on public.setup_grade_thresholds for select
using (exists (
  select 1 from public.trading_setup_versions v
  join public.trading_setups s on s.id = v.setup_id
  where v.id = setup_grade_thresholds.setup_version_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup grade thresholds are insertable by owner" on public.setup_grade_thresholds;
create policy "Setup grade thresholds are insertable by owner"
on public.setup_grade_thresholds for insert
with check (exists (
  select 1 from public.trading_setup_versions v
  join public.trading_setups s on s.id = v.setup_id
  where v.id = setup_grade_thresholds.setup_version_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup grade thresholds are updatable by owner" on public.setup_grade_thresholds;
create policy "Setup grade thresholds are updatable by owner"
on public.setup_grade_thresholds for update
using (exists (
  select 1 from public.trading_setup_versions v
  join public.trading_setups s on s.id = v.setup_id
  where v.id = setup_grade_thresholds.setup_version_id
    and s.user_id = auth.uid()
))
with check (exists (
  select 1 from public.trading_setup_versions v
  join public.trading_setups s on s.id = v.setup_id
  where v.id = setup_grade_thresholds.setup_version_id
    and s.user_id = auth.uid()
));

drop policy if exists "Setup grade thresholds are deletable by owner" on public.setup_grade_thresholds;
create policy "Setup grade thresholds are deletable by owner"
on public.setup_grade_thresholds for delete
using (exists (
  select 1 from public.trading_setup_versions v
  join public.trading_setups s on s.id = v.setup_id
  where v.id = setup_grade_thresholds.setup_version_id
    and s.user_id = auth.uid()
));

drop policy if exists "Trade setup evaluations are readable by owner" on public.trade_setup_evaluations;
create policy "Trade setup evaluations are readable by owner"
on public.trade_setup_evaluations for select
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
);

drop policy if exists "Trade setup evaluations are deletable by owner" on public.trade_setup_evaluations;
create policy "Trade setup evaluations are deletable by owner"
on public.trade_setup_evaluations for delete
using (auth.uid() = user_id);

drop policy if exists "Trade setup answers are readable by owner" on public.trade_setup_evaluation_answers;
create policy "Trade setup answers are readable by owner"
on public.trade_setup_evaluation_answers for select
using (exists (
  select 1 from public.trade_setup_evaluations e
  where e.id = trade_setup_evaluation_answers.evaluation_id
    and e.user_id = auth.uid()
));

drop policy if exists "Trade setup answers are insertable by owner" on public.trade_setup_evaluation_answers;
create policy "Trade setup answers are insertable by owner"
on public.trade_setup_evaluation_answers for insert
with check (exists (
  select 1 from public.trade_setup_evaluations e
  where e.id = trade_setup_evaluation_answers.evaluation_id
    and e.user_id = auth.uid()
));

drop policy if exists "Trade setup answers are updatable by owner" on public.trade_setup_evaluation_answers;
create policy "Trade setup answers are updatable by owner"
on public.trade_setup_evaluation_answers for update
using (exists (
  select 1 from public.trade_setup_evaluations e
  where e.id = trade_setup_evaluation_answers.evaluation_id
    and e.user_id = auth.uid()
))
with check (exists (
  select 1 from public.trade_setup_evaluations e
  where e.id = trade_setup_evaluation_answers.evaluation_id
    and e.user_id = auth.uid()
));

drop policy if exists "Trade setup answers are deletable by owner" on public.trade_setup_evaluation_answers;
create policy "Trade setup answers are deletable by owner"
on public.trade_setup_evaluation_answers for delete
using (exists (
  select 1 from public.trade_setup_evaluations e
  where e.id = trade_setup_evaluation_answers.evaluation_id
    and e.user_id = auth.uid()
));
