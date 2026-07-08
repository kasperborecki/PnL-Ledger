-- PnL Ledger - trade screenshots bucket migration
-- Run this if uploads fail with "Bucket not found" for trade screenshots.

insert into storage.buckets (id, name, public)
values ('trade-screenshots', 'trade-screenshots', true)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

