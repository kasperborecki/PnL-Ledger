<script setup lang="ts">
import SectionCard from '~/components/ui/SectionCard.vue'

type AccountCurrency = string

type QuoteItem = {
  symbol: string
  price: number | null
  timestamp: string
  status: 'ok' | 'fallback' | 'partial' | 'error'
  source: 'yahoo' | 'frankfurter' | 'none'
}

type QuoteResponse = {
  status: 'ok' | 'fallback' | 'partial' | 'error'
  data: QuoteItem[]
}

type InstrumentAssetClass = 'forex' | 'index' | 'commodity' | 'crypto' | 'stock'

type InstrumentRow = {
  symbol: string
  display_name: string
  asset_class: InstrumentAssetClass
  price_precision: number | string
  tick_size: number | string
  contract_size: number | string
  lot_step: number | string
  currency: string
  is_active: boolean
}

type InstrumentProfile = {
  symbol: string
  label: string
  assetClass: InstrumentAssetClass
  pipSize: number
  contractSize: number
  lotStep: number
  quoteCurrency: string
  quotePrecision: number
}

const BASE_CURRENCY = 'USD'

const props = defineProps<{
  defaultStartingBalance: number
}>()

const supabase = useSupabase()
const auth = useAuth()

const fallbackInstruments: InstrumentProfile[] = [
  { symbol: 'EURUSD', label: 'EUR/USD', assetClass: 'forex', pipSize: 0.0001, contractSize: 100000, lotStep: 0.01, quoteCurrency: 'USD', quotePrecision: 5 },
  { symbol: 'GBPUSD', label: 'GBP/USD', assetClass: 'forex', pipSize: 0.0001, contractSize: 100000, lotStep: 0.01, quoteCurrency: 'USD', quotePrecision: 5 },
  { symbol: 'USDJPY', label: 'USD/JPY', assetClass: 'forex', pipSize: 0.01, contractSize: 100000, lotStep: 0.01, quoteCurrency: 'JPY', quotePrecision: 3 },
  { symbol: 'USDCHF', label: 'USD/CHF', assetClass: 'forex', pipSize: 0.0001, contractSize: 100000, lotStep: 0.01, quoteCurrency: 'CHF', quotePrecision: 5 },
  { symbol: 'EURCHF', label: 'EUR/CHF', assetClass: 'forex', pipSize: 0.0001, contractSize: 100000, lotStep: 0.01, quoteCurrency: 'CHF', quotePrecision: 5 },
  { symbol: 'GBPCHF', label: 'GBP/CHF', assetClass: 'forex', pipSize: 0.0001, contractSize: 100000, lotStep: 0.01, quoteCurrency: 'CHF', quotePrecision: 5 },
  { symbol: 'XAUUSD', label: 'XAU/USD', assetClass: 'commodity', pipSize: 0.1, contractSize: 100, lotStep: 0.01, quoteCurrency: 'USD', quotePrecision: 2 },
  { symbol: 'NAS100', label: 'NAS100', assetClass: 'index', pipSize: 1, contractSize: 1, lotStep: 0.01, quoteCurrency: 'USD', quotePrecision: 1 },
  { symbol: 'NASDAQ', label: 'NASDAQ', assetClass: 'index', pipSize: 1, contractSize: 1, lotStep: 0.01, quoteCurrency: 'USD', quotePrecision: 1 },
  { symbol: 'US30', label: 'US30', assetClass: 'index', pipSize: 1, contractSize: 1, lotStep: 0.01, quoteCurrency: 'USD', quotePrecision: 1 },
  { symbol: 'US500', label: 'US500', assetClass: 'index', pipSize: 0.1, contractSize: 1, lotStep: 0.01, quoteCurrency: 'USD', quotePrecision: 1 },
  { symbol: 'BTCUSD', label: 'BTC/USD', assetClass: 'crypto', pipSize: 1, contractSize: 1, lotStep: 0.01, quoteCurrency: 'USD', quotePrecision: 2 },
  { symbol: 'ETHUSD', label: 'ETH/USD', assetClass: 'crypto', pipSize: 1, contractSize: 1, lotStep: 0.01, quoteCurrency: 'USD', quotePrecision: 2 },
]

const fallbackInstrumentMap = new Map(fallbackInstruments.map((instrument) => [instrument.symbol, instrument] as const))
const bridgeSymbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF'] as const

const form = reactive({
  startingBalance: props.defaultStartingBalance || 0,
  riskPercent: 1,
  symbol: 'EURUSD',
  stopLossPips: 20,
})

const quoteMap = ref<Record<string, QuoteItem>>({})
const instrumentRows = ref<InstrumentRow[]>([])
const quoteLoading = ref(false)
const quoteError = ref<string | null>(null)
const instrumentError = ref<string | null>(null)
const manualStartingBalance = ref(false)
let quoteTimer: ReturnType<typeof setTimeout> | null = null

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase()
}

function normalizeCurrency(value: string | null | undefined) {
  return (value ?? '').trim().toUpperCase() || BASE_CURRENCY
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0
}

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value)
}

function formatCurrency(value: number, currency: AccountCurrency = BASE_CURRENCY) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(value)
  } catch {
    return `${formatNumber(value, 2)} ${currency}`
  }
}

function quoteFor(symbol: string) {
  return quoteMap.value[normalizeSymbol(symbol)]?.price ?? null
}

function currencyRate(fromCurrency: string, toCurrency: string): number | null {
  const from = normalizeCurrency(fromCurrency)
  const to = normalizeCurrency(toCurrency)

  if (from === to) {
    return 1
  }

  const direct = quoteFor(`${from}${to}`)
  if (direct != null) {
    return direct
  }

  const inverse = quoteFor(`${to}${from}`)
  if (inverse != null && inverse !== 0) {
    return 1 / inverse
  }

  if (from !== BASE_CURRENCY && to !== BASE_CURRENCY) {
    const fromToBase = currencyRate(from, BASE_CURRENCY)
    const baseToTarget = currencyRate(BASE_CURRENCY, to)

    if (fromToBase != null && baseToTarget != null) {
      return fromToBase * baseToTarget
    }
  }

  return null
}

function inferQuoteCurrency(row: InstrumentRow, preset?: InstrumentProfile) {
  if (preset) {
    return preset.quoteCurrency
  }

  const symbol = normalizeSymbol(row.symbol)
  if (symbol.includes('/')) {
    return symbol.split('/')[1] || row.currency || BASE_CURRENCY
  }

  if (row.asset_class === 'forex' && symbol.length >= 6) {
    return symbol.slice(-3)
  }

  if (row.asset_class === 'commodity' || row.asset_class === 'index' || row.asset_class === 'crypto') {
    return row.currency || BASE_CURRENCY
  }

  return row.currency || BASE_CURRENCY
}

function inferPipSize(row: InstrumentRow, preset?: InstrumentProfile) {
  if (preset) {
    return preset.pipSize
  }

  const symbol = normalizeSymbol(row.symbol)
  const tickSize = toNumber(row.tick_size)
  const quoteCurrency = inferQuoteCurrency(row)

  if (row.asset_class === 'forex') {
    return quoteCurrency === 'JPY' ? 0.01 : 0.0001
  }

  if (row.asset_class === 'commodity') {
    if (symbol.startsWith('XAU')) return 0.1
    if (symbol.startsWith('XAG')) return 0.01
    return tickSize > 0 ? tickSize : 0.01
  }

  if (row.asset_class === 'index' || row.asset_class === 'crypto') {
    return tickSize > 0 ? tickSize : 1
  }

  return tickSize > 0 ? tickSize : 0.0001
}

function buildInstrumentProfile(row: InstrumentRow): InstrumentProfile {
  const symbol = normalizeSymbol(row.symbol)
  const preset = fallbackInstrumentMap.get(symbol)
  const quoteCurrency = normalizeCurrency(inferQuoteCurrency(row, preset))

  return {
    symbol,
    label: row.display_name?.trim() || preset?.label || symbol,
    assetClass: row.asset_class,
    pipSize: inferPipSize(row, preset),
    contractSize: Math.max(0.0001, toNumber(row.contract_size) || preset?.contractSize || 1),
    lotStep: Math.max(0.0001, toNumber(row.lot_step) || preset?.lotStep || 0.01),
    quoteCurrency,
    quotePrecision: Math.max(0, Math.min(8, Math.trunc(toNumber(row.price_precision) || preset?.quotePrecision || 2))),
  }
}

const instrumentLibrary = computed(() => {
  const merged = new Map<string, InstrumentProfile>()

  for (const preset of fallbackInstruments) {
    merged.set(preset.symbol, preset)
  }

  for (const row of instrumentRows.value) {
    if (!row.is_active) {
      continue
    }

    merged.set(normalizeSymbol(row.symbol), buildInstrumentProfile(row))
  }

  return [...merged.values()].sort((left, right) => left.label.localeCompare(right.label))
})

const instrumentMap = computed(() => new Map(instrumentLibrary.value.map((instrument) => [instrument.symbol, instrument] as const)))
const selectedInstrument = computed(() => instrumentMap.value.get(normalizeSymbol(form.symbol)) ?? instrumentLibrary.value[0] ?? fallbackInstruments[0])
const selectedQuoteRow = computed(() => quoteMap.value[normalizeSymbol(form.symbol)] ?? null)
const accountCurrency = computed(() => normalizeCurrency(auth.profile.value?.baseCurrency ?? BASE_CURRENCY))
const accountBalanceLabel = computed(() => `Account Balance (${accountCurrency.value}):`)
const accountBalance = computed(() => Math.max(0, Number(form.startingBalance) || 0))
const riskPercent = computed(() => Math.max(0, Number(form.riskPercent) || 0))
const stopLossPips = computed(() => Math.max(0, Number(form.stopLossPips) || 0))
const riskAmount = computed(() => accountBalance.value * (riskPercent.value / 100))
const quoteToAccountRate = computed(() => currencyRate(selectedInstrument.value.quoteCurrency, accountCurrency.value))
const pipValuePerLotQuote = computed(() => selectedInstrument.value.contractSize * selectedInstrument.value.pipSize)
const pipValuePerLotAccount = computed(() => pipValuePerLotQuote.value * (quoteToAccountRate.value ?? 1))
const riskPerLot = computed(() => pipValuePerLotAccount.value * stopLossPips.value)
const rawLots = computed(() => (riskPerLot.value > 0 ? riskAmount.value / riskPerLot.value : 0))
const roundedLots = computed(() => {
  const step = selectedInstrument.value.lotStep
  if (step <= 0) {
    return rawLots.value
  }

  return Math.max(0, Math.round(rawLots.value / step) * step)
})
const stopDistancePrice = computed(() => stopLossPips.value * selectedInstrument.value.pipSize)
const quotePrecision = computed(() => selectedInstrument.value.quotePrecision)
const conversionLabel = computed(() => {
  if (selectedInstrument.value.quoteCurrency === accountCurrency.value) {
    return `1 ${selectedInstrument.value.quoteCurrency} = 1 ${accountCurrency.value}`
  }

  const rate = quoteToAccountRate.value
  if (rate == null) {
    return `Missing FX conversion ${selectedInstrument.value.quoteCurrency} -> ${accountCurrency.value}, using 1:1 fallback`
  }

  return `1 ${selectedInstrument.value.quoteCurrency} = ${formatNumber(rate, 5)} ${accountCurrency.value}`
})
const currentStatus = computed(() => {
  if (quoteError.value) {
    return { label: 'Quote error', severity: 'danger' as const }
  }

  if (!selectedQuoteRow.value) {
    return { label: quoteLoading.value ? 'Loading...' : 'Manual / cached', severity: 'secondary' as const }
  }

  if (selectedInstrument.value.quoteCurrency !== accountCurrency.value && quoteToAccountRate.value == null) {
    return { label: 'Missing FX conversion', severity: 'warning' as const }
  }

  if (selectedQuoteRow.value.status === 'fallback') {
    return { label: 'Fallback quote', severity: 'warning' as const }
  }

  if (selectedQuoteRow.value.status === 'partial') {
    return { label: 'Partial quote', severity: 'warning' as const }
  }

  return { label: 'Live quote', severity: 'success' as const }
})
const currentPriceLabel = computed(() => {
  if (selectedQuoteRow.value?.price == null) {
    return '-'
  }

  return formatNumber(selectedQuoteRow.value.price, quotePrecision.value)
})
const pipLabel = computed(() => formatNumber(selectedInstrument.value.pipSize, selectedInstrument.value.pipSize < 1 ? 5 : 0))
const contractLabel = computed(() => formatNumber(selectedInstrument.value.contractSize, 0))
const riskLabel = computed(() => formatCurrency(riskAmount.value, accountCurrency.value))
const riskPerLotLabel = computed(() => formatCurrency(riskPerLot.value, accountCurrency.value))
const lotValueLabel = computed(() => formatCurrency(pipValuePerLotAccount.value, accountCurrency.value))
const instrumentHint = computed(() => {
  if (instrumentRows.value.length) {
    return 'Sizing uses your active Symbol Dictionary entries. If a symbol is missing, the calculator falls back to the built-in presets.'
  }

  return 'Sizing is currently using the built-in presets. Add your instruments in Symbol Dictionary for exact contract and lot-step values.'
})

async function loadInstruments() {
  await auth.ensureAuthReady()
  const currentUser = auth.user.value
  if (!currentUser) {
    instrumentRows.value = []
    instrumentError.value = null
    return
  }

  instrumentError.value = null

  try {
    const { data, error: loadError } = await supabase
      .from('instruments')
      .select('symbol, display_name, asset_class, price_precision, tick_size, contract_size, lot_step, currency, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('display_name', { ascending: true })

    if (loadError) {
      throw loadError
    }

    instrumentRows.value = (data ?? []) as InstrumentRow[]
  } catch (caught) {
    instrumentRows.value = []
    instrumentError.value = caught instanceof Error ? caught.message : String(caught)
  }
}

async function refreshQuotes() {
  const symbol = normalizeSymbol(form.symbol)
  if (!symbol) {
    quoteMap.value = {}
    quoteError.value = null
    return
  }

  quoteLoading.value = true
  quoteError.value = null

  try {
    const symbols = Array.from(new Set([symbol, ...bridgeSymbols]))
    const response = await $fetch<QuoteResponse>('/api/quotes', {
      query: { symbols: symbols.join(',') },
    })

    quoteMap.value = Object.fromEntries(
      (response.data ?? []).map((item) => [normalizeSymbol(item.symbol), item]),
    )
  } catch (caught) {
    quoteMap.value = {}
    quoteError.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    quoteLoading.value = false
  }
}

if (import.meta.client) {
  watch(
    () => auth.user.value?.id,
    () => {
      void loadInstruments()
    },
    { immediate: true },
  )

  watch(
    () => form.symbol,
    () => {
      if (quoteTimer) {
        window.clearTimeout(quoteTimer)
      }

      quoteTimer = window.setTimeout(() => {
        void refreshQuotes()
      }, 160)
    },
    { immediate: true },
  )
}

if (import.meta.client) {
  watch(
    instrumentLibrary,
    (items) => {
      const currentSymbol = normalizeSymbol(form.symbol)
      if (!items.length) {
        return
      }

      if (!items.some((item) => item.symbol === currentSymbol)) {
        form.symbol = items[0].symbol
      }
    },
    { immediate: true },
  )
}

watch(
  () => props.defaultStartingBalance,
  (value) => {
    if (!manualStartingBalance.value && !form.startingBalance) {
      form.startingBalance = value || 0
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (quoteTimer) {
    window.clearTimeout(quoteTimer)
  }
})
</script>

<template>
  <SectionCard
    title="Position Calculator"
    subtitle="Pick the instrument and risk, then the calculator will size the position for you."
  >
    <div class="calculator-shell">
      <div class="position-calculator-panel glass-card glass-card--soft">
        <div class="position-calculator-header">
          <div>
            <div class="detail-label">Position sizing</div>
            <div class="position-calculator-title">Risk calculator</div>
          </div>

          <PTag
            :value="currentStatus.label"
            :severity="currentStatus.severity"
          />
        </div>

        <div class="position-calculator-field">
          <label>{{ accountBalanceLabel }}</label>
          <input
            v-model.number="form.startingBalance"
            type="number"
            min="0"
            step="0.01"
            class="form-input form-input--number calculator-input"
            @input="manualStartingBalance = true"
          >
        </div>

        <div class="position-calculator-field">
          <label>Risk Percentage (%):</label>
          <input
            v-model.number="form.riskPercent"
            type="number"
            min="0"
            step="0.01"
            class="form-input form-input--number calculator-input"
          >
        </div>

        <div class="position-calculator-field">
          <label>Stop Loss (Pips):</label>
          <input
            v-model.number="form.stopLossPips"
            type="number"
            min="0"
            step="0.1"
            class="form-input form-input--number calculator-input"
          >
        </div>

        <div class="position-calculator-field">
          <label>Instrument:</label>
          <PDropdown
            v-model="form.symbol"
            :options="instrumentLibrary"
            option-label="label"
            option-value="symbol"
            filter
            class="input-dark calculator-select calculator-select--pair"
            placeholder="Select instrument"
          />
        </div>

        <div class="position-calculator-summary">
          <span>Pip size: {{ pipLabel }}</span>
          <span>Contract: {{ contractLabel }}</span>
        </div>

        <div class="muted position-calculator-note">
          {{ instrumentHint }}
        </div>

        <div v-if="instrumentError" class="position-calculator-note negative">
          Instruments could not be loaded: {{ instrumentError }}
        </div>
      </div>

      <div class="position-calculator-results glass-card">
        <div class="position-calculator-results-head">
          <div>
            <div class="detail-label">Instrument</div>
            <div class="position-calculator-title">{{ selectedInstrument.label }}</div>
          </div>

          <div class="position-calculator-price">
            <div class="detail-label">Current price</div>
            <div class="position-calculator-price-value">{{ currentPriceLabel }}</div>
          </div>
        </div>

        <div class="position-calculator-rate">
          {{ conversionLabel }}
        </div>

        <div class="position-calculator-grid">
          <div class="position-calculator-stat">
            <div class="detail-label">Risk amount</div>
            <div class="detail-value">{{ riskLabel }}</div>
          </div>

          <div class="position-calculator-stat">
            <div class="detail-label">Position size</div>
            <div class="detail-value">{{ formatNumber(roundedLots, 2) }} lots</div>
          </div>

          <div class="position-calculator-stat">
            <div class="detail-label">Risk / 1 lot</div>
            <div class="detail-value">{{ riskPerLotLabel }}</div>
          </div>

          <div class="position-calculator-stat">
            <div class="detail-label">1 pip / tick</div>
            <div class="detail-value">{{ lotValueLabel }}</div>
          </div>

          <div class="position-calculator-stat">
            <div class="detail-label">Stop distance</div>
            <div class="detail-value">{{ formatNumber(stopLossPips, 1) }} pips / {{ formatNumber(stopDistancePrice, selectedInstrument.quotePrecision) }} price</div>
          </div>

          <div class="position-calculator-stat">
            <div class="detail-label">Raw lots</div>
            <div class="detail-value">{{ formatNumber(rawLots, 4) }}</div>
          </div>
        </div>

        <div class="position-calculator-foot">
          <span>Quote: {{ selectedInstrument.quoteCurrency }}</span>
          <span>Account: {{ accountCurrency }}</span>
          <span v-if="selectedQuoteRow">Updated {{ new Date(selectedQuoteRow.timestamp).toLocaleString() }}</span>
        </div>
      </div>
    </div>
  </SectionCard>
</template>
