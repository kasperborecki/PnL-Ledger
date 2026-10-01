import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import ts from 'typescript'

const db = new PGlite()
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
let legacy, prop, bobAccount, payoutId
const sql = async (text, args = []) => (await db.query(text, args)).rows
const scalar = async (text, args = []) => Object.values((await sql(text, args))[0])[0]
const balance = async id => Number(await scalar('select current_balance from trading_account_balances where id = $1', [id]))

before(async () => {
  // Emulate Supabase auth/storage schemas; execute the repository's real SQL.
  await db.exec(`
    create role authenticated;
    create schema auth;
    create schema storage;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
    grant usage on schema auth, public, storage to authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;
  `)
  const base = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
    .replace(/create extension if not exists (pgcrypto|"uuid-ossp");/g, '')
  await db.exec(base)
  await sql('insert into auth.users(id, email) values ($1, $2), ($3, $4)', [alice, 'alice@example.test', bob, 'bob@example.test'])
  await sql('update profiles set starting_balance = 10000 where id = $1', [alice])
  await sql(`insert into trades(user_id, symbol, trade_date, trade_time, direction, setup, session, emotion, result, net_pnl)
    values ($1, 'NAS100', '2026-09-01', '10:00', 'Long', 'Breakout', 'London', 'Calm', 'Win', 500)`, [alice])
  await sql(`insert into open_trades(user_id, symbol, trade_date, trade_time, direction, setup, session, emotion)
    values ($1, 'NAS100', '2026-09-02', '10:00', 'Long', 'Breakout', 'London', 'Calm')`, [alice])
  await sql(`insert into account_transactions(user_id, transaction_type, amount) values ($1, 'withdrawal', -100)`, [alice])
  await db.exec(readFileSync(new URL('../supabase/010_trading_accounts.sql', import.meta.url), 'utf8'))
  await db.exec('grant select, insert, update, delete on public.trades, public.open_trades, public.account_transactions to authenticated')
  legacy = await scalar('select id from trading_accounts where user_id = $1', [alice])
  bobAccount = await scalar('select id from trading_accounts where user_id = $1', [bob])
})
after(async () => { await db.close() })

test('migration preserves old balance, closed/open trades and movements', async () => {
  assert.equal(await balance(legacy), 10400)
  for (const table of ['trades', 'open_trades', 'account_transactions']) {
    assert.equal(await scalar(`select account_id from ${table} where user_id = $1`, [alice]), legacy)
  }
  assert.equal(Number(await scalar('select count(*) from account_events where account_id = $1', [legacy])), 1)
})

test('prop account capital, P&L, personal costs and payout lifecycle stay separate', async () => {
  prop = await scalar(`insert into trading_accounts(user_id, name, nominal_balance, starting_balance, stage)
    values($1, 'Funded 100k', 100000, 100000, 'funded') returning id`, [alice])
  await sql(`insert into trades(user_id, account_id, symbol, trade_date, trade_time, direction, setup, session, emotion, result, net_pnl)
    values ($1, $2, 'NAS100', '2026-09-03', '10:00', 'Long', 'Breakout', 'London', 'Calm', 'Win', 3000)`, [alice, prop])
  await sql(`insert into account_cash_entries(user_id, account_id, kind, amount, currency) values ($1, $2, 'challenge', 500, 'USD')`, [alice, prop])
  assert.equal(await balance(prop), 103000)
  assert.equal(await balance(legacy), 10400)
  payoutId = await scalar(`insert into account_payouts(user_id, account_id, status, gross_amount, profit_split, currency, balance_effect)
    values($1, $2, 'requested', 3000, 80, 'USD', -3000) returning id`, [alice, prop])
  assert.equal(await balance(prop), 103000)
  await sql(`update account_payouts set status='approved' where id=$1`, [payoutId])
  assert.equal(await balance(prop), 103000)
  await sql(`update account_payouts set status='received', received_on=current_date, received_amount=2400 where id=$1`, [payoutId])
  assert.equal(await balance(prop), 100000)
  await sql(`update account_payouts set notes='Certificate received' where id=$1`, [payoutId])
  assert.equal(await balance(prop), 100000, 'an edit must not deduct the payout twice')
  await sql(`update account_payouts set status='rejected', received_on=null, received_amount=0 where id=$1`, [payoutId])
  assert.equal(await balance(prop), 103000)
  await sql(`update account_payouts set status='received', received_on=current_date, received_amount=2400 where id=$1`, [payoutId])
})

test('moving, editing and deleting a trade recalculates both accounts', async () => {
  const trade = await scalar('select id from trades where account_id=$1', [prop])
  await sql('update trades set account_id=$1 where id=$2', [legacy, trade])
  assert.equal(await balance(prop), 97000)
  assert.equal(await balance(legacy), 13400)
  await sql('update trades set net_pnl=2000 where id=$1', [trade])
  assert.equal(await balance(legacy), 12400)
  await sql('delete from trades where id=$1', [trade])
  assert.equal(await balance(legacy), 10400)
})

test('archive records status/reason and keeps documents, payouts and linked stages', async () => {
  await assert.rejects(sql(`update trading_accounts set status='lost', ended_on=current_date where id=$1`, [prop]))
  await sql(`insert into account_documents(user_id, account_id, payout_id, name, storage_path) values($1,$2,$3,'Certificate',$4)`, [alice, prop, payoutId, `${alice}/${prop}/certificate.pdf`])
  await sql(`update trading_accounts set status='lost', ended_on=current_date, status_reason='Daily limit breached' where id=$1`, [prop])
  assert.equal(Number(await scalar('select count(*) from account_payouts where account_id=$1', [prop])), 1)
  assert.equal(Number(await scalar('select count(*) from account_documents where account_id=$1', [prop])), 1)
  assert.match(await scalar(`select description from account_events where account_id=$1 and event_type='status'`, [prop]), /Daily limit breached/)
  const next = await scalar(`insert into trading_accounts(user_id, name, nominal_balance, starting_balance, predecessor_id) values($1,'Retry',100000,100000,$2) returning id`, [alice, prop])
  assert.equal(await balance(next), 100000)
  await assert.rejects(sql('update trading_accounts set predecessor_id=$1 where id=$2', [next, prop]), /predecessor cannot be changed/i)
})

test('database rejects cross-owner associations and mismatched document/payout accounts', async () => {
  await assert.rejects(sql(`insert into account_cash_entries(user_id,account_id,kind,amount,currency) values($1,$2,'fee',10,'USD')`, [alice, bobAccount]), /foreign key/)
  await assert.rejects(sql(`insert into account_documents(user_id,account_id,payout_id,name,storage_path) values($1,$2,$3,'Bad',$4)`, [alice, legacy, payoutId, `${alice}/${legacy}/bad.pdf`]), /foreign key/)
  await assert.rejects(sql('update trades set account_id=$1 where user_id=$2', [bobAccount, alice]), /foreign key/)
  await assert.rejects(sql(`update trading_accounts set currency='EUR' where id=$1`, [legacy]), /Currency cannot be changed/)
  await assert.rejects(sql(`insert into account_transactions(user_id,account_id,transaction_type,amount,currency) values($1,$2,'adjustment',10,'EUR')`, [alice, legacy]), /account currency/)
})

test('RLS protects balances, account history and private documents', async () => {
  await sql(`select set_config('request.jwt.claim.sub', $1, false)`, [bob])
  await db.exec('set role authenticated')
  try {
    assert.equal(Number(await scalar('select count(*) from trading_account_balances')), 1)
    assert.equal(Number(await scalar('select count(*) from account_documents')), 0)
    assert.equal(Number(await scalar('select count(*) from account_payouts')), 0)
    assert.equal(Number(await scalar('select count(*) from account_events where account_id=$1', [prop])), 0)
    await assert.rejects(sql(`insert into trading_accounts(user_id,name,nominal_balance,starting_balance) values($1,'Forged',100,100)`, [alice]), /row-level security/)
    await assert.rejects(sql(`insert into account_events(user_id,account_id,event_type,happened_on,description) values($1,$2,'status',current_date,'Forged')`, [bob, bobAccount]), /permission denied|row-level security/)
    await assert.rejects(sql(`insert into storage.objects(bucket_id,name,owner) values('account-documents',$1,$2)`, [`${alice}/${prop}/fake.pdf`, bob]), /row-level security/)
    await sql(`insert into storage.objects(bucket_id,name,owner) values('account-documents',$1,$2)`, [`${bob}/${bobAccount}/own.pdf`, bob])
    assert.equal(Number(await scalar(`select count(*) from storage.objects where bucket_id='account-documents'`)), 1)
  } finally { await db.exec('reset role') }
  assert.equal(await scalar(`select public from storage.buckets where id='account-documents'`), false)
})

test('cash summaries use only received payouts and separate currencies', async () => {
  const source = readFileSync(new URL('../app/utils/accounting.ts', import.meta.url), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  const { cashSummary } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
  assert.deepEqual(cashSummary([
    { status: 'received', received_amount: '2400', currency: 'USD' },
    { status: 'approved', received_amount: 999, currency: 'USD' },
    { status: 'rejected', received_amount: 999, currency: 'USD' },
    { status: 'received', received_amount: 100, currency: 'EUR' },
  ], [
    { kind: 'challenge', amount: '500', currency: 'USD' },
    { kind: 'reset', amount: 50, currency: 'USD' },
    { kind: 'refund', amount: 50, currency: 'USD' },
    { kind: 'fee', amount: 20, currency: 'EUR' },
  ]), [
    { currency: 'EUR', received: 100, costs: 20, refunds: 0, net: 80 },
    { currency: 'USD', received: 2400, costs: 550, refunds: 50, net: 1900 },
  ])
})
