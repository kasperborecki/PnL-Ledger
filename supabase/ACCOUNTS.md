# Trading accounts — migration 010

For an existing installation, run **`010_trading_accounts.sql` once** in the
Supabase SQL editor, after the existing migrations. Run it before serving the
updated application. The entire migration is a transaction; an error rolls it back.

For a fresh installation, run `schema.sql`, then the numbered migrations in order
through `010_trading_accounts.sql`. Do not run the old base schema,
`management_additions.sql` or `repair_existing_accounts.sql` after migration 010:
they contain the superseded profile balance triggers.

The migration:

- Creates a **Legacy account** for existing users and assigns their closed trades,
  open trades and balance movements to it. The former starting balance is retained.
  Review this account's type/name after migration; existing data is not assumed to
  belong to a prop firm. Historical movements are not guessed to be payouts/costs.
- Introduces `trading_accounts`, `account_payouts`, `account_cash_entries`,
  `account_documents` and `account_events`, with owner RLS and composite ownership
  foreign keys. Account deletion is unavailable; use a status change to archive it.
- Adds `trading_account_balances`, a view with `security_invoker = true` that derives
  balances from starting balance + closed trade P&L + balance movements + received
  payout balance effects. Editing/rejecting a payout recomputes its effect instead
  of adding another deduction. Old profile balance columns are retained for
  compatibility but no longer used for account accounting.
- Creates the private **account-documents** bucket (PDF/JPG/PNG/WebP, 10 MB).
  Uploads use `user_id/account_id/random-id.extension`; downloads require an
  authenticated owner. Certificates can be attached to a payout or to the account.

In Accounts, create an account and record purchase fees under **Costs & refunds**.
Use **Next stage / retry** to create a linked account with its own starting balance;
set the previous stage's status separately. Use **Change status** to record a lost,
passed or closed account. Archived trades, payouts and documents are retained.

Trading capital and P&L are separate from the personal cash result:
**received payouts + refunds − challenge/reset/other costs**. Currencies are grouped
separately; the global “All accounts” filter includes accounts in the selected
reporting currency. No exchange conversion is assumed. Costs and payouts use
their own settlement currency; a payout's signed balance effect uses the account
currency and applies only when its status is received.

Limits are reference values only. There is no platform connection, live equity
monitoring, automatic drawdown enforcement or automatic status change.

## Verification

`npm test` executes the real base schema and migration in isolated PGlite PostgreSQL
with mocked Supabase auth/storage schemas. It covers migration preservation,
account balances, payout transitions, history, ownership/RLS and currency grouping.
It does not connect to or mutate a live Supabase project.

`npm run build` builds the application. `npm run typecheck` checks application types.
