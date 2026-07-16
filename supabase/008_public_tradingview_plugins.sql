-- PnL Ledger - TradingView plugin library access update
-- Makes the library readable by authenticated users and removes screenshot URLs.

alter table public.tradingview_plugins
  drop column if exists screenshot_url;

drop policy if exists "TradingView plugins are readable by owner" on public.tradingview_plugins;
drop policy if exists "TradingView plugins are readable by authenticated users" on public.tradingview_plugins;
create policy "TradingView plugins are readable by authenticated users"
on public.tradingview_plugins
for select
to authenticated
using (true);

drop policy if exists "TradingView plugins are insertable by owner" on public.tradingview_plugins;
create policy "TradingView plugins are insertable by owner"
on public.tradingview_plugins
for insert
with check (auth.uid() = user_id);

drop policy if exists "TradingView plugins are updatable by owner" on public.tradingview_plugins;
create policy "TradingView plugins are updatable by owner"
on public.tradingview_plugins
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "TradingView plugins are deletable by owner" on public.tradingview_plugins;
create policy "TradingView plugins are deletable by owner"
on public.tradingview_plugins
for delete
using (auth.uid() = user_id);
