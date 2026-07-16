-- PnL Ledger - instrument defaults fix
-- Normalizes instrument sizing values so the lot calculator matches broker-style expectations.

insert into public.instruments (
  symbol,
  display_name,
  asset_class,
  price_precision,
  tick_size,
  contract_size,
  lot_step,
  currency
)
values
  ('NAS100', 'Nasdaq 100', 'index', 1, 1, 1, 0.01, 'USD'),
  ('US30', 'Dow Jones 30', 'index', 1, 1, 1, 0.01, 'USD'),
  ('US500', 'S&P 500', 'index', 1, 0.1, 1, 0.01, 'USD'),
  ('XAUUSD', 'Gold / XAUUSD', 'commodity', 2, 0.1, 100, 0.01, 'USD'),
  ('EURUSD', 'EUR/USD', 'forex', 5, 0.0001, 100000, 0.01, 'USD'),
  ('GBPUSD', 'GBP/USD', 'forex', 5, 0.0001, 100000, 0.01, 'USD'),
  ('USDJPY', 'USD/JPY', 'forex', 3, 0.01, 100000, 0.01, 'JPY'),
  ('USDCHF', 'USD/CHF', 'forex', 5, 0.0001, 100000, 0.01, 'CHF'),
  ('EURCHF', 'EUR/CHF', 'forex', 5, 0.0001, 100000, 0.01, 'CHF'),
  ('GBPCHF', 'GBP/CHF', 'forex', 5, 0.0001, 100000, 0.01, 'CHF'),
  ('BTCUSD', 'Bitcoin / BTCUSD', 'crypto', 2, 1, 1, 0.01, 'USD'),
  ('ETHUSD', 'Ethereum / ETHUSD', 'crypto', 2, 1, 1, 0.01, 'USD')
on conflict (symbol) do update set
  display_name = excluded.display_name,
  asset_class = excluded.asset_class,
  price_precision = excluded.price_precision,
  tick_size = excluded.tick_size,
  contract_size = excluded.contract_size,
  lot_step = excluded.lot_step,
  currency = excluded.currency,
  is_active = true,
  updated_at = now();
