-- Create the bucket used for profile avatars.
-- Run this in Supabase SQL editor if avatar upload says "Bucket not found".

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

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
