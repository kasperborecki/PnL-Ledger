<script setup lang="ts">
import SectionCard from '~/components/ui/SectionCard.vue'
import type { TradingAccount } from '~/composables/useTradingAccounts'
import { cashSummary, type Payout, type CashEntry } from '~/utils/accounting'
import { requireCurrencyCode, requireDate, requireNumber, requireText } from '~/utils/validation'

type AccountDocument = { id: string; account_id: string; payout_id: string | null; name: string; storage_path: string; created_at: string }
type AccountEvent = { id: string; account_id: string; event_type: string; happened_on: string; description: string; created_at: string }
type Movement = { id: string; account_id: string; transaction_type: string; amount: number; currency: string; happened_at: string; notes: string }

const accounts = useTradingAccounts()
const auth = useAuth()
const ledger = useLedger()
const supabase = useSupabase()
const busy = ref(false)
const loading = ref(false)
const error = ref('')
const notice = ref('')
const archiveFilter = ref('active')
const detailId = ref('')
const tab = ref('Overview')
const payouts = ref<Payout[]>([])
const cashEntries = ref<CashEntry[]>([])
const documents = ref<AccountDocument[]>([])
const events = ref<AccountEvent[]>([])
const movements = ref<Movement[]>([])
const tabs = ['Overview', 'Trades', 'Payouts', 'Costs & refunds', 'Documents', 'History']
const detail = computed(() => accounts.accounts.value.find(a => a.id === detailId.value) ?? null)
const visibleAccounts = computed(() => accounts.scope.value.filter(a => archiveFilter.value === 'all' || (archiveFilter.value === 'active' ? a.status === 'active' : a.status !== 'active')))
const accountPayouts = computed(() => payouts.value.filter(p => p.account_id === detailId.value))
const accountCosts = computed(() => cashEntries.value.filter(c => c.account_id === detailId.value))
const accountDocuments = computed(() => documents.value.filter(d => d.account_id === detailId.value))
const accountEvents = computed(() => events.value.filter(e => e.account_id === detailId.value))
const accountMovements = computed(() => movements.value.filter(m => m.account_id === detailId.value))
const accountTrades = computed(() => ledger.trades.value.filter(t => t.accountId === detailId.value))
const accountOpenTrades = computed(() => ledger.openTrades.value.filter(t => t.accountId === detailId.value))
const totals = computed(() => cashSummary(payouts.value.filter(p => accounts.scopeIds.value.has(p.account_id)), cashEntries.value.filter(c => accounts.scopeIds.value.has(c.account_id))))
const detailTotals = computed(() => cashSummary(accountPayouts.value, accountCosts.value))
const predecessor = computed(() => accounts.accounts.value.find(a => a.id === detail.value?.predecessor_id))
const successors = computed(() => accounts.accounts.value.filter(a => a.predecessor_id === detailId.value))
const money = (value: number, currency?: string) => accounts.money(Number(value), currency ?? detail.value?.currency ?? 'USD')
const accountName = (id: string) => accounts.accounts.value.find(a => a.id === id)?.name ?? 'Account'
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const number = (value: unknown, label: string, min = 0) => requireNumber(value, label, { min, max: 1_000_000_000 })
const optionalLimit = (value: unknown, label: string) => value === '' || value === null ? null : number(value, label, 0.01)
const text = (value: unknown, label: string, maxLength = 2000) => requireText(value, label, { allowEmpty: true, maxLength })

async function loadDetails() {
  await auth.ensureAuthReady()
  const userId = auth.user.value?.id
  if (!userId) return
  loading.value = true
  try {
    await accounts.refresh()
    if (accounts.error.value) throw new Error(accounts.error.value)
    const results = await Promise.all([
      supabase.from('account_payouts').select('*').eq('user_id', userId).order('requested_on', { ascending: false }),
      supabase.from('account_cash_entries').select('*').eq('user_id', userId).order('happened_on', { ascending: false }),
      supabase.from('account_documents').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('account_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('account_transactions').select('*').eq('user_id', userId).order('happened_at', { ascending: false }),
    ])
    for (const result of results) if (result.error) throw result.error
    if (auth.user.value?.id !== userId) return
    payouts.value = results[0]!.data as Payout[]
    cashEntries.value = results[1]!.data as CashEntry[]
    documents.value = results[2]!.data as AccountDocument[]
    events.value = results[3]!.data as AccountEvent[]
    movements.value = results[4]!.data as Movement[]
  } finally { loading.value = false }
}

async function run(action: () => Promise<void>, success = '') {
  if (busy.value) return
  busy.value = true
  error.value = ''
  notice.value = ''
  try { await action(); notice.value = success }
  catch (caught) { error.value = caught && typeof caught === 'object' && 'message' in caught ? String(caught.message) : String(caught) }
  finally { busy.value = false }
}

function owner() {
  if (!auth.user.value) throw new Error('Sign in to manage accounts.')
  return auth.user.value.id
}

const accountDialog = ref(false)
const editingAccountId = ref<string | null>(null)
function emptyAccount() {
  return { name: '', firm: '', reference: '', kind: 'prop', stage: 'challenge', currency: 'USD', nominal_balance: 100000, starting_balance: 100000, profit_split: 80, started_on: today(), profit_target: null as number | null, daily_loss_limit: null as number | null, max_loss_limit: null as number | null, rules_notes: '', notes: '', predecessor_id: null as string | null }
}
const accountForm = ref(emptyAccount())
const stageOptions = computed(() => accountForm.value.kind === 'prop' ? ['challenge', 'verification', 'funded'] : accountForm.value.kind === 'personal' ? ['live'] : ['demo'])
watch(() => accountForm.value.kind, () => {
  if (!stageOptions.value.includes(accountForm.value.stage)) accountForm.value.stage = stageOptions.value[0]!
})

function openAccount(account?: TradingAccount, next = false) {
  editingAccountId.value = account && !next ? account.id : null
  accountForm.value = account ? {
    name: next ? `${account.name} · ${account.stage === 'challenge' ? 'verification' : 'funded'}` : account.name,
    firm: account.firm, reference: next ? '' : account.reference, kind: account.kind,
    stage: next ? (account.kind === 'prop' ? (account.stage === 'challenge' ? 'verification' : 'funded') : account.stage) : account.stage,
    currency: account.currency, nominal_balance: Number(account.nominal_balance),
    starting_balance: Number(next ? account.nominal_balance : account.starting_balance), profit_split: Number(account.profit_split),
    started_on: next ? today() : account.started_on, profit_target: account.profit_target,
    daily_loss_limit: account.daily_loss_limit, max_loss_limit: account.max_loss_limit,
    rules_notes: account.rules_notes, notes: next ? '' : account.notes, predecessor_id: next ? account.id : account.predecessor_id,
  } : emptyAccount()
  accountDialog.value = true
}

async function saveAccount() {
  await run(async () => {
    const f = accountForm.value
    const payload = { ...f, user_id: owner(), name: requireText(f.name, 'Name', { maxLength: 120 }), firm: text(f.firm, 'Firm', 120), reference: text(f.reference, 'Reference', 120),
      currency: requireCurrencyCode(f.currency), nominal_balance: number(f.nominal_balance, 'Account size'), starting_balance: number(f.starting_balance, 'Starting balance'),
      profit_split: requireNumber(f.profit_split, 'Profit split', { min: 0, max: 100 }), started_on: requireDate(f.started_on),
      profit_target: optionalLimit(f.profit_target, 'Profit target'), daily_loss_limit: optionalLimit(f.daily_loss_limit, 'Daily loss limit'), max_loss_limit: optionalLimit(f.max_loss_limit, 'Maximum loss'),
      notes: text(f.notes, 'Notes'), rules_notes: text(f.rules_notes, 'Rules'),
    }
    const query = editingAccountId.value ? supabase.from('trading_accounts').update(payload).eq('id', editingAccountId.value).eq('user_id', owner()) : supabase.from('trading_accounts').insert(payload)
    const result = await query.select('id').single()
    if (result.error) throw result.error
    detailId.value = result.data.id
    accountDialog.value = false
    archiveFilter.value = 'all'
    accounts.selectedId.value = 'All'
    accounts.reportingCurrency.value = payload.currency
    await loadDetails()
  }, 'Account saved.')
}

const statusDialog = ref(false)
const statusForm = reactive({ status: 'lost', ended_on: today(), status_reason: '' })
function openStatus() {
  Object.assign(statusForm, { status: detail.value?.status === 'active' ? 'lost' : 'active', ended_on: today(), status_reason: '' })
  statusDialog.value = true
}
async function saveStatus() {
  await run(async () => {
    if (!detail.value) return
    const reason = requireText(statusForm.status_reason, 'Reason', { allowEmpty: statusForm.status !== 'lost', maxLength: 2000 })
    const ended = statusForm.status === 'active' ? null : requireDate(statusForm.ended_on)
    if (ended && ended < detail.value.started_on) throw new Error('End date cannot precede the start date.')
    const { error: saveError } = await supabase.from('trading_accounts').update({ status: statusForm.status, ended_on: ended, status_reason: reason }).eq('id', detailId.value).eq('user_id', owner())
    if (saveError) throw saveError
    statusDialog.value = false
    archiveFilter.value = 'all'
    await loadDetails()
  }, 'Status saved. Account history is preserved.')
}

const payoutDialog = ref(false)
const editingPayoutId = ref<string | null>(null)
const payoutForm = reactive({ status: 'requested', requested_on: today(), received_on: today(), gross_amount: 0, profit_split: 80, received_amount: 0, currency: 'USD', balance_effect: 0, notes: '' })
function openPayout(payout?: Payout) {
  editingPayoutId.value = payout?.id ?? null
  Object.assign(payoutForm, payout ?? { status: 'requested', requested_on: today(), received_on: today(), gross_amount: 0, profit_split: Number(detail.value?.profit_split ?? 80), received_amount: 0, currency: detail.value?.currency ?? 'USD', balance_effect: 0, notes: '' })
  if (!payoutForm.received_on) payoutForm.received_on = today()
  payoutDialog.value = true
}
async function savePayout() {
  await run(async () => {
    const f = payoutForm
    const received = f.status === 'received'
    const payload = { user_id: owner(), account_id: detailId.value, status: f.status, requested_on: requireDate(f.requested_on), received_on: received ? requireDate(f.received_on) : null,
      gross_amount: number(f.gross_amount, 'Gross amount', 0.01), profit_split: requireNumber(f.profit_split, 'Profit split', { min: 0, max: 100 }),
      received_amount: received ? number(f.received_amount, 'Received amount', 0.01) : 0, currency: requireCurrencyCode(f.currency),
      balance_effect: number(f.balance_effect, 'Balance change', -1_000_000_000), notes: text(f.notes, 'Notes') }
    if (payload.received_on && payload.received_on < payload.requested_on) throw new Error('Receipt date cannot precede the request date.')
    const result = editingPayoutId.value ? await supabase.from('account_payouts').update(payload).eq('id', editingPayoutId.value).eq('user_id', owner()) : await supabase.from('account_payouts').insert(payload)
    if (result.error) throw result.error
    payoutDialog.value = false
    await loadDetails()
  }, 'Payout saved. Only received payouts count towards your cash result.')
}

const costDialog = ref(false)
const editingCostId = ref<string | null>(null)
const costForm = reactive({ kind: 'challenge', amount: 0, currency: 'USD', happened_on: today(), notes: '' })
function openCost(entry?: CashEntry) {
  editingCostId.value = entry?.id ?? null
  Object.assign(costForm, entry ?? { kind: 'challenge', amount: 0, currency: detail.value?.currency ?? 'USD', happened_on: today(), notes: '' })
  costDialog.value = true
}
async function saveCost() {
  await run(async () => {
    const payload = { user_id: owner(), account_id: detailId.value, kind: costForm.kind, amount: number(costForm.amount, 'Amount', 0.01), currency: requireCurrencyCode(costForm.currency), happened_on: requireDate(costForm.happened_on), notes: text(costForm.notes, 'Notes') }
    const result = editingCostId.value ? await supabase.from('account_cash_entries').update(payload).eq('id', editingCostId.value).eq('user_id', owner()) : await supabase.from('account_cash_entries').insert(payload)
    if (result.error) throw result.error
    costDialog.value = false
    await loadDetails()
  }, 'Cash entry saved. Trading balance is unchanged.')
}

const movementDialog = ref(false)
const movementForm = reactive({ amount: 0, happened_on: today(), notes: '', transaction_type: 'adjustment' })
async function saveMovement() {
  await run(async () => {
    if (!detail.value) return
    const amount = number(movementForm.amount, 'Signed amount', -1_000_000_000)
    if (!amount) throw new Error('Amount cannot be zero.')
    if ((movementForm.transaction_type === 'deposit' && amount < 0) || (movementForm.transaction_type === 'withdrawal' && amount > 0)) throw new Error('Use a positive amount for deposits and a negative amount for withdrawals.')
    const result = await supabase.from('account_transactions').insert({ user_id: owner(), account_id: detailId.value, transaction_type: movementForm.transaction_type, amount, currency: detail.value.currency, happened_at: `${requireDate(movementForm.happened_on)}T12:00:00Z`, notes: requireText(movementForm.notes, 'Reason', { maxLength: 500 }) })
    if (result.error) throw result.error
    movementDialog.value = false
    Object.assign(movementForm, { amount: 0, happened_on: today(), notes: '', transaction_type: 'adjustment' })
    await loadDetails()
  }, 'Balance movement saved.')
}

const documentName = ref('')
const documentPayoutId = ref<string | null>(null)
const documentFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const payoutOptions = computed(() => [{ label: 'Account document', value: null }, ...accountPayouts.value.map(p => ({ label: `${p.requested_on} · ${money(p.gross_amount, p.currency)} · ${p.status}`, value: p.id }))])
async function uploadDocument() {
  await run(async () => {
    const file = documentFile.value
    if (!file || !detail.value) throw new Error('Choose a PDF or image first.')
    const types: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
    if (!types[file.type]) throw new Error('Choose a PDF, JPG, PNG or WebP file.')
    if (file.size > 10 * 1024 * 1024) throw new Error('File must be smaller than 10 MB.')
    const name = requireText(documentName.value || file.name, 'Document name', { maxLength: 200 })
    const path = `${owner()}/${detailId.value}/${crypto.randomUUID()}.${types[file.type]}`
    const upload = await supabase.storage.from('account-documents').upload(path, file, { contentType: file.type, upsert: false })
    if (upload.error) throw upload.error
    const result = await supabase.from('account_documents').insert({ user_id: owner(), account_id: detailId.value, payout_id: documentPayoutId.value, name, storage_path: path })
    if (result.error) {
      await supabase.storage.from('account-documents').remove([path])
      throw result.error
    }
    documentName.value = ''
    documentFile.value = null
    if (fileInput.value) fileInput.value.value = ''
    await loadDetails()
  }, 'Document attached.')
}
async function downloadDocument(document: AccountDocument) {
  await run(async () => {
    const result = await supabase.storage.from('account-documents').download(document.storage_path)
    if (result.error) throw result.error
    const url = URL.createObjectURL(result.data)
    const link = window.document.createElement('a')
    link.href = url
    const extension = document.storage_path.split('.').pop()
    link.download = document.name.toLowerCase().endsWith(`.${extension}`) ? document.name : `${document.name}.${extension}`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  })
}

function showAccount(id: string) { detailId.value = id; tab.value = 'Overview' }
function viewTrades() {
  accounts.selectedId.value = detailId.value
  ledger.timeframe.value = 'All'
  ledger.selectedSymbol.value = 'All'
  ledger.selectedSetup.value = 'All'
  ledger.selectedSession.value = 'All'
  void navigateTo('/trades')
}
watch(detailId, () => { documentPayoutId.value = null; documentFile.value = null; documentName.value = ''; if (fileInput.value) fileInput.value.value = '' })
watch(accounts.selectedId, id => { if (id !== 'All') { showAccount(id); archiveFilter.value = 'all' } })
watch(accounts.reportingCurrency, () => { if (detail.value && !accounts.scopeIds.value.has(detailId.value)) detailId.value = '' })
onMounted(() => { if (accounts.selectedId.value !== 'All') { detailId.value = accounts.selectedId.value; archiveFilter.value = 'all' }; void run(loadDetails) })
</script>

<template>
  <div class="page-stack accounts-page">
    <div v-if="error" class="sync-banner" role="alert">{{ error }}</div>
    <div v-if="notice" class="account-notice" role="status">{{ notice }}</div>
    <SectionCard title="Your funding journey" subtitle="Account balances track trading capital. Cash results track received payouts, refunds and costs.">
      <template #action><PButton label="Add account" icon="pi pi-plus" severity="success" :disabled="busy || loading || !!accounts.error.value" @click="openAccount()" /></template>
      <div class="account-cash-grid">
        <div v-for="total in totals" :key="total.currency" class="account-cash-tile">
          <span class="muted">Cash result · {{ total.currency }}</span>
          <strong :class="total.net >= 0 ? 'positive' : 'negative'">{{ money(total.net, total.currency) }}</strong>
          <span>Received {{ money(total.received, total.currency) }} · Refunds {{ money(total.refunds, total.currency) }} · Costs {{ money(total.costs, total.currency) }}</span>
        </div>
        <p v-if="!totals.length" class="muted">Record your first cost or received payout to see your cash result. Trading P&amp;L is shown separately.</p>
      </div>
      <p class="muted mt-3">Cash totals include the selected accounts across their full history, including archived accounts. Currencies are kept separate. Personal-account deposits and withdrawals are capital movements.</p>
    </SectionCard>

    <div class="account-toolbar">
      <PSelectButton v-model="archiveFilter" :options="[{ label: 'Active', value: 'active' }, { label: 'Archive', value: 'archive' }, { label: 'All', value: 'all' }]" option-label="label" option-value="value" :allow-empty="false" />
      <PButton label="Refresh" icon="pi pi-refresh" text :loading="loading" :disabled="busy" @click="run(loadDetails)" />
    </div>
    <div v-if="loading && !accounts.accounts.value.length" class="account-empty">Loading accounts…</div>
    <div v-else-if="!visibleAccounts.length" class="account-empty glass-card">No accounts in this view. Add an account or change the account and archive filters.</div>
    <div class="account-grid">
      <button v-for="account in visibleAccounts" :key="account.id" type="button" class="account-tile glass-card" :class="{ selected: detailId === account.id }" @click="showAccount(account.id)">
        <div class="account-toolbar"><span class="muted">{{ account.firm || account.kind }} · {{ account.stage }}</span><PTag :value="account.status" :severity="account.status === 'active' ? 'success' : account.status === 'lost' ? 'danger' : 'secondary'" /></div>
        <h2>{{ account.name }}</h2>
        <span class="muted">Size {{ money(account.nominal_balance, account.currency) }}</span>
        <strong class="account-balance-value">{{ money(account.current_balance, account.currency) }}</strong>
        <div class="account-toolbar"><span>Trading P&amp;L</span><span :class="Number(account.trading_pnl) >= 0 ? 'positive' : 'negative'">{{ money(account.trading_pnl, account.currency) }}</span></div>
        <span class="muted">{{ account.trade_count }} trades · Since {{ account.started_on }}</span>
      </button>
    </div>

    <SectionCard v-if="detail" :title="detail.name" :subtitle="`${detail.firm || detail.kind} · ${detail.stage} · ${detail.status} · ${detail.reference || 'No reference'}`">
      <template #action><div class="account-actions-row"><PButton label="Edit" text :disabled="busy" @click="openAccount(detail)" /><PButton label="Next stage / retry" text :disabled="busy" @click="openAccount(detail, true)" /><PButton label="Change status" outlined :disabled="busy" @click="openStatus" /></div></template>
      <nav class="account-tabs" aria-label="Account details"><button v-for="item in tabs" :key="item" :class="{ active: tab === item }" @click="tab = item">{{ item }}</button></nav>

      <div v-if="tab === 'Overview'" class="stack">
        <div class="account-metrics">
          <div><span>Starting balance</span><strong>{{ money(detail.starting_balance) }}</strong></div>
          <div><span>Current balance</span><strong>{{ money(detail.current_balance) }}</strong></div>
          <div><span>Trading P&amp;L</span><strong>{{ money(detail.trading_pnl) }}</strong></div>
          <div><span>Your profit share</span><strong>{{ detail.profit_split }}%</strong></div>
        </div>
        <div v-for="total in detailTotals" :key="total.currency" class="account-notice">Cash result: <strong>{{ money(total.net, total.currency) }}</strong> · Received {{ money(total.received, total.currency) }} · Costs {{ money(total.costs, total.currency) }} · Refunds {{ money(total.refunds, total.currency) }}</div>
        <p class="muted">{{ detail.started_on }} → {{ detail.ended_on || 'ongoing' }}<span v-if="detail.status_reason"> · {{ detail.status_reason }}</span></p>
        <div v-if="predecessor || successors.length" class="account-actions-row"><span class="muted">Related stages:</span><PButton v-if="predecessor" :label="`← ${predecessor.name}`" text @click="showAccount(predecessor.id)" /><PButton v-for="next in successors" :key="next.id" :label="`${next.name} →`" text @click="showAccount(next.id)" /></div>
        <div class="account-metrics">
          <div><span>Profit target</span><strong>{{ detail.profit_target ? money(detail.profit_target) : 'Not set' }}</strong></div>
          <div><span>Daily loss limit</span><strong>{{ detail.daily_loss_limit ? money(detail.daily_loss_limit) : 'Not set' }}</strong></div>
          <div><span>Maximum loss limit</span><strong>{{ detail.max_loss_limit ? money(detail.max_loss_limit) : 'Not set' }}</strong></div>
        </div>
        <p class="muted">Limits are reference values. Open-position equity and intraday drawdown are not monitored automatically.</p>
        <p v-if="detail.rules_notes" class="account-notes">{{ detail.rules_notes }}</p>
        <p v-if="detail.notes" class="account-notes">{{ detail.notes }}</p>
        <div class="account-toolbar"><h3>Balance movements</h3><PButton label="Add movement" icon="pi pi-plus" text :disabled="busy" @click="movementDialog = true" /></div>
        <p class="muted">Deposits, withdrawals and signed corrections change this account's balance. Record prop payouts in Payouts and challenge fees in Costs &amp; refunds.</p>
        <div v-for="movement in accountMovements" :key="movement.id" class="account-row"><div>{{ movement.transaction_type }} · {{ movement.happened_at.slice(0, 10) }}<p class="muted">{{ movement.notes }}</p></div><strong>{{ money(movement.amount, movement.currency) }}</strong></div>
        <p v-if="!accountMovements.length" class="muted">No balance movements yet.</p>
      </div>

      <div v-if="tab === 'Trades'" class="stack">
        <div class="account-toolbar"><span>{{ accountTrades.length }} closed · {{ accountOpenTrades.length }} open</span><PButton label="Open trade journal" icon="pi pi-arrow-right" @click="viewTrades" /></div>
        <div v-for="trade in accountOpenTrades" :key="trade.id" class="account-row"><span>{{ trade.date }} · {{ trade.symbol }} · {{ trade.direction }} · Open</span><PButton label="Review" text @click="ledger.openOpenTradeEditDialog(trade.id)" /></div>
        <div v-for="trade in accountTrades" :key="trade.id" class="account-row"><span>{{ trade.date }} · {{ trade.symbol }} · {{ trade.direction }}</span><span>{{ money(trade.netPnl) }} <PButton label="Review" text @click="ledger.openTradeEditDialog(trade.id)" /></span></div>
        <p v-if="!accountTrades.length && !accountOpenTrades.length" class="muted">No trades assigned to this account.</p>
      </div>

      <div v-if="tab === 'Payouts'" class="stack">
        <div class="account-toolbar"><p class="muted">Track requests through to receipt. Attach certificates in Documents.</p><PButton label="Add payout" icon="pi pi-plus" :disabled="busy" @click="openPayout()" /></div>
        <div v-for="payout in accountPayouts" :key="payout.id" class="account-row">
          <div><strong>{{ money(payout.gross_amount, payout.currency) }}</strong> · <PTag :value="payout.status" /><p class="muted">Requested {{ payout.requested_on }} · Share {{ payout.profit_split }}%<span v-if="payout.received_on"> · Received {{ money(payout.received_amount, payout.currency) }} on {{ payout.received_on }}</span></p><p class="muted">Account balance change: {{ money(payout.balance_effect) }}{{ payout.status !== 'received' ? ' (applied on receipt)' : '' }}</p><p v-if="payout.notes" class="account-notes">{{ payout.notes }}</p><div class="account-actions-row"><PButton v-for="doc in accountDocuments.filter(d => d.payout_id === payout.id)" :key="doc.id" :label="doc.name" icon="pi pi-download" text :disabled="busy" @click="downloadDocument(doc)" /></div></div>
          <div class="account-actions-row"><PButton label="Attach certificate" text @click="tab = 'Documents'; documentPayoutId = payout.id" /><PButton label="Edit" text :disabled="busy" @click="openPayout(payout)" /></div>
        </div>
        <p v-if="!accountPayouts.length" class="muted">No payouts yet.</p>
      </div>

      <div v-if="tab === 'Costs & refunds'" class="stack">
        <div class="account-toolbar"><p class="muted">Money paid for the challenge, resets and fees, plus refunds.</p><PButton label="Add cost / refund" icon="pi pi-plus" :disabled="busy" @click="openCost()" /></div>
        <div v-for="entry in accountCosts" :key="entry.id" class="account-row"><div>{{ entry.kind }} · {{ entry.happened_on }}<p class="muted">{{ entry.notes }}</p></div><span :class="entry.kind === 'refund' ? 'positive' : 'negative'">{{ entry.kind === 'refund' ? '+' : '−' }}{{ money(entry.amount, entry.currency) }} <PButton label="Edit" text :disabled="busy" @click="openCost(entry)" /></span></div>
        <p v-if="!accountCosts.length" class="muted">No costs or refunds recorded.</p>
      </div>

      <div v-if="tab === 'Documents'" class="stack">
        <form class="account-form" @submit.prevent="uploadDocument">
          <label class="field"><span>Document name</span><input v-model="documentName" class="form-input" placeholder="Payout certificate" maxlength="200"></label>
          <label class="field"><span>Attach to</span><PDropdown v-model="documentPayoutId" :options="payoutOptions" option-label="label" option-value="value" class="input-dark" /></label>
          <label class="field"><span>PDF, JPG, PNG or WebP · up to 10 MB</span><input ref="fileInput" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" @change="documentFile = ($event.target as HTMLInputElement).files?.[0] ?? null"></label>
          <PButton type="submit" label="Upload document" icon="pi pi-upload" :loading="busy" :disabled="!documentFile || loading" />
        </form>
        <p class="muted">Documents are private and available only to your signed-in account.</p>
        <div v-for="doc in accountDocuments" :key="doc.id" class="account-row"><div>{{ doc.name }}<p class="muted">{{ doc.created_at.slice(0, 10) }} · {{ doc.payout_id ? 'Payout certificate' : 'Account document' }}</p></div><PButton label="Download" icon="pi pi-download" text :disabled="busy" @click="downloadDocument(doc)" /></div>
        <p v-if="!accountDocuments.length" class="muted">No documents attached.</p>
      </div>

      <div v-if="tab === 'History'" class="stack">
        <div v-for="event in accountEvents" :key="event.id" class="account-history-row"><span class="muted">{{ event.happened_on }} · {{ event.event_type }}</span><p>{{ event.description }}</p></div>
        <p v-if="!accountEvents.length" class="muted">No history entries yet.</p>
      </div>
    </SectionCard>

    <PDialog v-model:visible="accountDialog" modal :header="editingAccountId ? 'Edit account' : 'Add account / stage'" :style="{ width: '760px', maxWidth: '95vw' }" :closable="!busy">
      <form class="account-form" @submit.prevent="saveAccount">
        <p v-if="accountForm.predecessor_id" class="account-full muted">Linked to {{ accountName(accountForm.predecessor_id) }}. Each stage keeps its own trades and balance. Update the previous stage's status separately.</p>
        <label class="field"><span>Name</span><input v-model="accountForm.name" class="form-input" required maxlength="120"></label>
        <label class="field"><span>Firm / broker</span><input v-model="accountForm.firm" class="form-input" maxlength="120"></label>
        <label class="field"><span>Account reference</span><input v-model="accountForm.reference" class="form-input" placeholder="Account ID" maxlength="120"></label>
        <label class="field"><span>Type</span><PDropdown v-model="accountForm.kind" :options="['prop', 'personal', 'demo']" class="input-dark" /></label>
        <label class="field"><span>Stage</span><PDropdown v-model="accountForm.stage" :options="stageOptions" class="input-dark" /></label>
        <label class="field"><span>Currency</span><input v-model="accountForm.currency" class="form-input" required pattern="[A-Za-z]{3}" maxlength="3"></label>
        <label class="field"><span>Nominal account size</span><input v-model.number="accountForm.nominal_balance" class="form-input" type="number" min="0" step="0.01" required></label>
        <label class="field"><span>Starting balance at start of journal</span><input v-model.number="accountForm.starting_balance" class="form-input" type="number" min="0" step="0.01" required></label>
        <label class="field"><span>Start date</span><input v-model="accountForm.started_on" class="form-input" type="date" required></label>
        <label class="field"><span>Your profit share (%)</span><input v-model.number="accountForm.profit_split" class="form-input" type="number" min="0" max="100" step="0.01" required></label>
        <label class="field"><span>Profit target (amount, optional)</span><input v-model.number="accountForm.profit_target" class="form-input" type="number" min="0.01" step="0.01"></label>
        <label class="field"><span>Daily loss limit (amount, optional)</span><input v-model.number="accountForm.daily_loss_limit" class="form-input" type="number" min="0.01" step="0.01"></label>
        <label class="field"><span>Maximum loss (amount, optional)</span><input v-model.number="accountForm.max_loss_limit" class="form-input" type="number" min="0.01" step="0.01"></label>
        <label class="field account-full"><span>Rules (drawdown method, reset time, payout terms)</span><textarea v-model="accountForm.rules_notes" class="form-input" rows="2" maxlength="2000" /></label>
        <label class="field account-full"><span>Notes</span><textarea v-model="accountForm.notes" class="form-input" rows="2" maxlength="2000" /></label>
        <p class="muted account-full">Record the purchase fee in Costs &amp; refunds after saving. For a new stage, use Next stage / retry to preserve the previous stage's statistics.</p>
        <p v-if="error" class="negative account-full" role="alert">{{ error }}</p>
        <PButton type="submit" label="Save account" severity="success" :loading="busy" class="account-full" />
      </form>
    </PDialog>

    <PDialog v-model:visible="statusDialog" modal header="Change account status" :style="{ width: '520px', maxWidth: '95vw' }" :closable="!busy">
      <form class="stack" @submit.prevent="saveStatus">
        <label class="field"><span>Status</span><PDropdown v-model="statusForm.status" :options="['active', 'passed', 'lost', 'closed']" class="input-dark" /></label>
        <label v-if="statusForm.status !== 'active'" class="field"><span>Effective end date</span><input v-model="statusForm.ended_on" class="form-input" type="date" required></label>
        <label class="field"><span>Reason / review</span><textarea v-model="statusForm.status_reason" class="form-input" rows="4" :required="statusForm.status === 'lost'" maxlength="2000" /></label>
        <p v-if="accountOpenTrades.length" class="muted">This account has {{ accountOpenTrades.length }} open trades. They remain available for review and closure.</p>
        <p class="muted">All trades, payouts and documents remain in the archive.</p>
        <p v-if="error" class="negative" role="alert">{{ error }}</p>
        <PButton type="submit" label="Save status" :loading="busy" />
      </form>
    </PDialog>

    <PDialog v-model:visible="payoutDialog" modal :header="editingPayoutId ? 'Edit payout' : 'Add payout'" :style="{ width: '660px', maxWidth: '95vw' }" :closable="!busy">
      <form class="account-form" @submit.prevent="savePayout">
        <label class="field"><span>Status</span><PDropdown v-model="payoutForm.status" :options="['requested', 'approved', 'received', 'rejected']" class="input-dark" /></label>
        <label class="field"><span>Request date</span><input v-model="payoutForm.requested_on" type="date" class="form-input" required></label>
        <label class="field"><span>Gross settlement amount</span><input v-model.number="payoutForm.gross_amount" type="number" min="0.01" step="0.01" class="form-input" required></label>
        <label class="field"><span>Settlement currency</span><input v-model="payoutForm.currency" class="form-input" required pattern="[A-Za-z]{3}" maxlength="3"></label>
        <label class="field"><span>Your share (%)</span><input v-model.number="payoutForm.profit_split" type="number" min="0" max="100" step="0.01" class="form-input" required></label>
        <div class="field"><span>Expected share before fees</span><strong>{{ Number(payoutForm.gross_amount * payoutForm.profit_split / 100).toFixed(2) }} {{ payoutForm.currency }}</strong></div>
        <label v-if="payoutForm.status === 'received'" class="field"><span>Actually received (settlement currency)</span><input v-model.number="payoutForm.received_amount" type="number" min="0.01" step="0.01" class="form-input" required></label>
        <label v-if="payoutForm.status === 'received'" class="field"><span>Received on</span><input v-model="payoutForm.received_on" type="date" class="form-input" required></label>
        <label class="field account-full"><span>Signed balance change on the trading account ({{ detail?.currency }})</span><input v-model.number="payoutForm.balance_effect" type="number" step="0.01" class="form-input" required><small class="muted">For a deduction of 1,000 enter −1000. Applied once when status is received. Use 0 if the account balance does not change.</small></label>
        <label class="field account-full"><span>Notes</span><textarea v-model="payoutForm.notes" class="form-input" rows="2" maxlength="2000" /></label>
        <p v-if="error" class="negative account-full" role="alert">{{ error }}</p>
        <PButton type="submit" label="Save payout" :loading="busy" class="account-full" />
      </form>
    </PDialog>

    <PDialog v-model:visible="costDialog" modal header="Cost / refund" :style="{ width: '520px', maxWidth: '95vw' }" :closable="!busy">
      <form class="account-form" @submit.prevent="saveCost">
        <label class="field"><span>Type</span><PDropdown v-model="costForm.kind" :options="['challenge', 'reset', 'fee', 'refund']" class="input-dark" /></label>
        <label class="field"><span>Date paid / refunded</span><input v-model="costForm.happened_on" class="form-input" type="date" required></label>
        <label class="field"><span>Amount</span><input v-model.number="costForm.amount" class="form-input" type="number" min="0.01" step="0.01" required></label>
        <label class="field"><span>Currency</span><input v-model="costForm.currency" class="form-input" pattern="[A-Za-z]{3}" maxlength="3" required></label>
        <label class="field account-full"><span>Notes</span><textarea v-model="costForm.notes" class="form-input" rows="2" maxlength="2000" /></label>
        <p v-if="error" class="negative account-full" role="alert">{{ error }}</p>
        <PButton type="submit" label="Save entry" :loading="busy" class="account-full" />
      </form>
    </PDialog>

    <PDialog v-model:visible="movementDialog" modal header="Account balance movement" :style="{ width: '520px', maxWidth: '95vw' }" :closable="!busy">
      <form class="stack" @submit.prevent="saveMovement">
        <label class="field"><span>Type</span><PDropdown v-model="movementForm.transaction_type" :options="['adjustment', 'deposit', 'withdrawal']" class="input-dark" /></label>
        <label class="field"><span>Signed amount ({{ detail?.currency }})</span><input v-model.number="movementForm.amount" class="form-input" type="number" step="0.01" required></label>
        <label class="field"><span>Date</span><input v-model="movementForm.happened_on" class="form-input" type="date" required></label>
        <label class="field"><span>Reason</span><textarea v-model="movementForm.notes" class="form-input" rows="2" maxlength="500" required /></label>
        <p class="muted">Use a negative amount to reduce the balance. To reverse a mistake, add an opposite movement with a reason. This does not count as a payout or personal cost.</p>
        <p v-if="error" class="negative" role="alert">{{ error }}</p>
        <PButton type="submit" label="Save movement" :loading="busy" />
      </form>
    </PDialog>
  </div>
</template>

<style scoped>
.account-toolbar, .account-actions-row, .account-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.account-actions-row { justify-content: flex-start; }
.account-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 16px; }
.account-tile { display: flex; flex-direction: column; gap: 12px; padding: 22px; text-align: left; color: inherit; border: 1px solid rgba(255,255,255,.09); cursor: pointer; transition: border-color .15s; }
.account-tile:hover, .account-tile.selected { border-color: #22c55e; }
.account-tile h2 { font-size: 1.15rem; overflow-wrap: anywhere; }
.account-balance-value { font-size: 1.65rem; }
.account-cash-grid { display: flex; flex-wrap: wrap; gap: 16px; }
.account-cash-tile { flex: 1 1 250px; display: grid; gap: 8px; }
.account-cash-tile strong { font-size: 1.8rem; }
.account-cash-tile > span:last-child { font-size: .8rem; color: #9ca3af; }
.account-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; }
.account-metrics > div { display: grid; gap: 8px; padding: 16px; border-radius: 12px; background: rgba(255,255,255,.025); }
.account-metrics span { color: #9ca3af; font-size: .8rem; }
.account-metrics strong { font-size: 1.1rem; }
.account-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0 24px; border-bottom: 1px solid rgba(255,255,255,.08); }
.account-tabs button { padding: 12px; color: #9ca3af; border-bottom: 2px solid transparent; }
.account-tabs button { appearance: none; background: transparent; border-top: 0; border-left: 0; border-right: 0; cursor: pointer; font: inherit; }
.account-tabs button:focus-visible, .account-tile:focus-visible { outline: 2px solid #4ade80; outline-offset: 3px; }
.accounts-page :deep(.section-title) { flex-wrap: wrap; }
.accounts-page :deep(.section-title > div:first-child) { flex: 1 1 220px; }
.accounts-page :deep(.section-title > .p-button) { flex-shrink: 0; }
.account-tabs button.active { color: #4ade80; border-color: #4ade80; }
.account-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; padding-top: 12px; }
.account-full { grid-column: 1 / -1; }
.account-row { padding: 16px 0; border-bottom: 1px solid rgba(255,255,255,.07); }
.account-row p { margin-top: 6px; }
.account-history-row { padding: 12px 16px; border-left: 2px solid #22c55e; }
.account-history-row p { margin-top: 8px; white-space: pre-wrap; overflow-wrap: anywhere; }
.account-notes { white-space: pre-wrap; overflow-wrap: anywhere; }
.account-notice { padding: 14px 18px; border-radius: 12px; background: rgba(34,197,94,.08); }
.account-empty { padding: 32px; text-align: center; color: #9ca3af; }
@media (max-width: 620px) { .account-form { grid-template-columns: 1fr; } .account-toolbar { align-items: flex-start; } }
</style>
