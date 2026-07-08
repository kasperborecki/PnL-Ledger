-- PnL Ledger - trade screenshots storage policies
-- Run this after the bucket exists to allow authenticated users to manage their own trade screenshots.

insert into storage.buckets (id, name, public)
values ('trade-screenshots', 'trade-screenshots', true)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

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
