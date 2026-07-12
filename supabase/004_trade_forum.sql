-- PnL Ledger - trade forum comments and public feed support
-- Run after 001-003. This makes trades visible to authenticated users in the forum,
-- adds image comments, and creates a safe public profile view for trader names.

create table if not exists public.trade_forum_comments (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null default '',
  image_storage_path text,
  image_public_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(body) <= 4000)
);

create index if not exists idx_trade_forum_comments_trade_time
on public.trade_forum_comments (trade_id, created_at asc);

create index if not exists idx_trade_forum_comments_user_time
on public.trade_forum_comments (user_id, created_at desc);

drop trigger if exists trg_trade_forum_comments_updated_at on public.trade_forum_comments;
create trigger trg_trade_forum_comments_updated_at
before update on public.trade_forum_comments
for each row execute function public.set_updated_at();

alter table public.trade_forum_comments enable row level security;

drop policy if exists "Forum trades are readable by authenticated users" on public.trades;
create policy "Forum trades are readable by authenticated users"
on public.trades
for select
to authenticated
using (true);

drop policy if exists "Forum screenshots are readable by authenticated users" on public.trade_screenshots;
create policy "Forum screenshots are readable by authenticated users"
on public.trade_screenshots
for select
to authenticated
using (true);

drop policy if exists "Forum comments are readable by authenticated users" on public.trade_forum_comments;
create policy "Forum comments are readable by authenticated users"
on public.trade_forum_comments
for select
to authenticated
using (true);

drop policy if exists "Forum comments are insertable by owner" on public.trade_forum_comments;
create policy "Forum comments are insertable by owner"
on public.trade_forum_comments
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Forum comments are updatable by owner" on public.trade_forum_comments;
create policy "Forum comments are updatable by owner"
on public.trade_forum_comments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Forum comments are deletable by owner" on public.trade_forum_comments;
create policy "Forum comments are deletable by owner"
on public.trade_forum_comments
for delete
to authenticated
using (auth.uid() = user_id);

create or replace view public.trade_forum_profiles
as
select
  id,
  display_name,
  avatar_url
from public.profiles;

grant select on public.trade_forum_profiles to authenticated;

insert into storage.buckets (id, name, public)
values ('forum-comment-images', 'forum-comment-images', true)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

drop policy if exists "Forum comment images read access" on storage.objects;
create policy "Forum comment images read access"
on storage.objects
for select
to authenticated
using (bucket_id = 'forum-comment-images');

drop policy if exists "Forum comment images insert access" on storage.objects;
create policy "Forum comment images insert access"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'forum-comment-images' and owner = auth.uid());

drop policy if exists "Forum comment images update access" on storage.objects;
create policy "Forum comment images update access"
on storage.objects
for update
to authenticated
using (bucket_id = 'forum-comment-images' and owner = auth.uid())
with check (bucket_id = 'forum-comment-images' and owner = auth.uid());

drop policy if exists "Forum comment images delete access" on storage.objects;
create policy "Forum comment images delete access"
on storage.objects
for delete
to authenticated
using (bucket_id = 'forum-comment-images' and owner = auth.uid());
