<script setup lang="ts">
import SectionCard from '~/components/ui/SectionCard.vue'

type QuoteItem = {
  symbol: string
  price: number | null
  timestamp: string
  status: 'ok' | 'fallback' | 'partial' | 'error'
  source: 'yahoo' | 'exchangerate.host' | 'none'
}

type QuoteResponse = {
  status: 'ok' | 'fallback' | 'partial' | 'error'
  data: QuoteItem[]
}

type AccountCurrency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF'

const BASE_CURRENCY = 'USD' as const

type InstrumentPreset = {
  symbol: string
  label: string
  pipSize: number
  contractSize: number
  lotStep: number
  quoteCurrency: AccountCurrency
  quotePrecision: number
}

const props = defineProps<{
  defaultStartingBalance: number
}>()

const instrumentPresets: InstrumentPreset[] = [
  { symbol: 'EURUSD', label: 'EUR/USD', pipSize: 0.0001, contractSize: 100000, lotStep: 0.01, quoteCurrency: 'USD', quotePrecision: 5 },
  { symbol: 'GBPUSD', label: 'GBP/USD', pipSize: 0.0001, contractSize: 100000, lotStep: 0.01, quoteCurrency: 'USD', quotePrecision: 5 },
  { symbol: 'USDJPY', label: 'USD/JPY', pipSize: 0.01, contractSize: 100000, lotStep: 0.01, quoteCurrency: 'JPY', quotePrecision: 3 },
  { symbol: 'USDCHF', label: 'USD/CHF', pipSize: 0.0001, contractSize: 100000, lotStep: 0.01, quoteCurrency: 'CHF', quotePrecision: 5 },
  { symbol: 'EURCHF', label: 'EUR/CHF', pipSize: 0.0001, contractSize: 100000, lotStep: 0.01, quoteCurrency: 'CHF', quotePrecision: 5 },
  { symbol: 'GBPCHF', label: 'GBP/CHF', pipSize: 0.0001, contractSize: 100000, lotStep: 0.01, quoteCurrency: 'CHF', quotePrecision: 5 },
  { symbol: 'XAUUSD', label: 'XAU/USD', pipSize: 0.1, contractSize: 100, lotStep: 0.01, quoteCurrency: 'USD', quotePrecision: 2 },
  { symbol: 'NAS100', label: 'NAS100', pipSize: 1, contractSize: 1, lotStep: 0.01, quoteCurrency: 'USD', quotePrecision: 1 },
  { symbol: 'NASDAQ', label: 'NASDAQ', pipSize: 1, contractSize: 1, lotStep: 0.01, quoteCurrency: 'USD', quotePrecision: 1 },
  { symbol: 'US30', label: 'US30', pipSize: 1, contractSize: 1, lotStep: 0.01, quoteCurrency: 'USD', quotePrecision: 1 },
  { symbol: 'US500', label: 'US500', pipSize: 0.1, contractSize: 1, lotStep: 0.01, quoteCurrency: 'USD', quotePrecision: 1 },
]

const instrumentPresetMap = new Map(instrumentPresets.map((preset) => [preset.symbol, preset] as const))
const instrumentOptions = instrumentPresets.map((preset) => ({
  label: preset.label,
  value: preset.symbol,
}))

const form = reactive({
  startingBalance: props.defaultStartingBalance || 0,
  riskPercent: 1,
  symbol: 'EURUSD',
  stopLossPips: 20,
})

const quoteMap = ref<Record<string, QuoteItem>>({})
const quoteLoading = ref(false)
const quoteError = ref<string | null>(null)
const manualStartingBalance = ref(false)
let quoteTimer: ReturnType<typeof setTimeout> | null = null

const bridgeSymbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF'] as const

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value)
}

function formatCurrency(value: number, currency: AccountCurrency = BASE_CURRENCY) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(value)
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase()
}

function quoteFor(symbol: string) {
  return quoteMap.value[normalizeSymbol(symbol)]?.price ?? null
}

function currencyRate(fromCurrency: string, toCurrency: string): number | null {
  const from = normalizeSymbol(fromCurrency)
  const to = normalizeSymbol(toCurrency)

  if (!from || !to) {
    return null
  }

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

  if (from !== 'USD' && to !== 'USD') {
    const fromToUsd = currencyRate(from, 'USD')
    const usdToTo = currencyRate('USD', to)

    if (fromToUsd != null && usdToTo != null) {
      return fromToUsd * usdToTo
    }
  }

  return null
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

const selectedPreset = computed(() => instrumentPresetMap.get(normalizeSymbol(form.symbol)) ?? instrumentPresets[0])
const selectedQuoteRow = computed(() => quoteMap.value[normalizeSymbol(form.symbol)] ?? null)
const accountBalanceLabel = `Account Balance (${BASE_CURRENCY}):`
const accountBalance = computed(() => Math.max(0, Number(form.startingBalance) || 0))
const riskPercent = computed(() => Math.max(0, Number(form.riskPercent) || 0))
const stopLossPips = computed(() => Math.max(0, Number(form.stopLossPips) || 0))
const riskAmount = computed(() => accountBalance.value * (riskPercent.value / 100))
const quoteToAccountRate = computed(() => currencyRate(selectedPreset.value.quoteCurrency, BASE_CURRENCY) ?? 1)
const pipValuePerLotQuote = computed(() => selectedPreset.value.contractSize * selectedPreset.value.pipSize)
const pipValuePerLotAccount = computed(() => pipValuePerLotQuote.value * quoteToAccountRate.value)
const riskPerLot = computed(() => pipValuePerLotAccount.value * stopLossPips.value)
const rawLots = computed(() => (riskPerLot.value > 0 ? riskAmount.value / riskPerLot.value : 0))
const roundedLots = computed(() => {
  const step = selectedPreset.value.lotStep
  if (step <= 0) {
    return rawLots.value
  }

  return Math.max(0, Math.floor(rawLots.value / step) * step)
})
const stopDistancePrice = computed(() => stopLossPips.value * selectedPreset.value.pipSize)
const quotePrecision = computed(() => selectedPreset.value.quotePrecision)
const currentStatus = computed(() => {
  if (quoteError.value) {
    return { label: 'Quote error', severity: 'danger' as const }
  }

  if (!selectedQuoteRow.value) {
    return { label: quoteLoading.value ? 'Loading...' : 'Manual / cached', severity: 'secondary' as const }
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
const pipLabel = computed(() => formatNumber(selectedPreset.value.pipSize, selectedPreset.value.pipSize < 1 ? 5 : 0))
const contractLabel = computed(() => formatNumber(selectedPreset.value.contractSize, 0))
const rateLabel = computed(() => {
  const rate = quoteToAccountRate.value
  const quoteCurrency = selectedPreset.value.quoteCurrency
  if (!rate || !quoteCurrency) {
    return '1:1'
  }

  return `1 ${quoteCurrency} = ${formatNumber(rate, 5)} ${BASE_CURRENCY}`
})
const riskLabel = computed(() => formatCurrency(riskAmount.value))
const riskPerLotLabel = computed(() => formatCurrency(riskPerLot.value))
const lotValueLabel = computed(() => formatCurrency(pipValuePerLotAccount.value))

if (import.meta.client) {
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
            :options="instrumentOptions"
            option-label="label"
            option-value="value"
            filter
            class="input-dark calculator-select calculator-select--pair"
            placeholder="Select instrument"
          />
        </div>

        <div class="position-calculator-summary">
          <span>Pip size: {{ pipLabel }}</span>
          <span>Contract: {{ contractLabel }}</span>
        </div>
      </div>

      <div class="position-calculator-results glass-card">
        <div class="position-calculator-results-head">
          <div>
            <div class="detail-label">Instrument</div>
            <div class="position-calculator-title">{{ selectedPreset.label }}</div>
          </div>

          <div class="position-calculator-price">
            <div class="detail-label">Current price</div>
            <div class="position-calculator-price-value">{{ currentPriceLabel }}</div>
          </div>
        </div>

        <div class="position-calculator-rate">
          {{ rateLabel }}
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
            <div class="detail-value">{{ formatNumber(stopLossPips, 1) }} pips / {{ formatNumber(stopDistancePrice, selectedPreset.quotePrecision) }} price</div>
          </div>

          <div class="position-calculator-stat">
            <div class="detail-label">Raw lots</div>
            <div class="detail-value">{{ formatNumber(rawLots, 4) }}</div>
          </div>
        </div>

        <div class="position-calculator-foot">
          <span>Quote: {{ selectedPreset.quoteCurrency }}</span>
          <span v-if="selectedQuoteRow">Updated {{ new Date(selectedQuoteRow.timestamp).toLocaleString() }}</span>
        </div>
      </div>
    </div>
  </SectionCard>
</template>
