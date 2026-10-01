export type TradingAccount = {
  id: string
  user_id: string
  name: string
  firm: string
  reference: string
  kind: 'prop' | 'personal' | 'demo'
  stage: 'challenge' | 'verification' | 'funded' | 'live' | 'demo'
  status: 'active' | 'passed' | 'lost' | 'closed'
  currency: string
  nominal_balance: number
  starting_balance: number
  current_balance: number
  trading_pnl: number
  trade_count: number
  profit_split: number
  profit_target: number | null
  daily_loss_limit: number | null
  max_loss_limit: number | null
  rules_notes: string
  started_on: string
  ended_on: string | null
  status_reason: string
  notes: string
  predecessor_id: string | null
}

export function useTradingAccounts() {
  const auth = useAuth()
  const supabase = useSupabase()
  const accounts = useState<TradingAccount[]>('trading-accounts', () => [])
  const selectedId = useState('trading-account-selected', () => 'All')
  const reportingCurrency = useState('trading-reporting-currency', () => 'USD')
  const error = useState<string | null>('trading-accounts-error', () => null)
  const ownerId = useState<string | null>('trading-accounts-owner', () => null)
  const selected = computed(() => accounts.value.find(a => a.id === selectedId.value) ?? null)
  const currency = computed(() => selected.value?.currency ?? reportingCurrency.value)
  const options = computed(() => [
    { label: `All accounts · ${reportingCurrency.value}`, value: 'All' },
    ...accounts.value.map(a => ({ label: `${a.name} · ${a.currency}${a.status !== 'active' ? ` · ${a.status}` : ''}`, value: a.id })),
  ])
  const currencies = computed(() => [...new Set(['USD', ...accounts.value.map(a => a.currency)])].sort())
  const scope = computed(() => accounts.value.filter(a => selected.value ? a.id === selectedId.value : a.currency === currency.value))
  const scopeIds = computed(() => new Set(scope.value.map(a => a.id)))
  const balance = computed(() => selected.value ? Number(selected.value.current_balance) : null)

  function clear() {
    accounts.value = []
    selectedId.value = 'All'
    reportingCurrency.value = 'USD'
    ownerId.value = null
    error.value = null
  }

  async function refresh() {
    const userId = auth.user.value?.id
    if (!userId) { clear(); return }
    if (ownerId.value !== userId) clear()
    ownerId.value = userId
    const { data, error: fetchError } = await supabase.from('trading_account_balances').select('*').eq('user_id', userId).order('created_at')
    if (auth.user.value?.id !== userId) return
    if (fetchError) {
      accounts.value = []
      error.value = `Accounts could not be loaded. Apply supabase/010_trading_accounts.sql if needed. ${fetchError.message}`
      return
    }
    error.value = null
    accounts.value = (data ?? []) as TradingAccount[]
    if (selectedId.value !== 'All' && !accounts.value.some(a => a.id === selectedId.value)) selectedId.value = 'All'
  }

  function defaultAccountId() {
    if (selected.value?.status === 'active') return selected.value.id
    const active = scope.value.filter(a => a.status === 'active')
    return active.length === 1 ? active[0]!.id : ''
  }

  function requireAccount(id: string, allowArchived = false) {
    const account = accounts.value.find(a => a.id === id)
    if (!account) throw new Error('Choose an account first. You can create one on the Accounts page.')
    if (!allowArchived && account.status !== 'active') throw new Error('Choose an active account for a new trade.')
    return account.id
  }

  function money(value: number, code = currency.value) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(Number(value))
  }

  return { accounts, selectedId, selected, reportingCurrency, currency, currencies, scope, scopeIds, balance, options, error, refresh, clear, defaultAccountId, requireAccount, money }
}
