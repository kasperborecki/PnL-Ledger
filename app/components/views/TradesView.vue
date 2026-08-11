<script setup lang="ts">
import SectionCard from '~/components/ui/SectionCard.vue'
import OpenTradeDetailPanel from '~/components/trades/OpenTradeDetailPanel.vue'
import TradeDetailPanel from '~/components/trades/TradeDetailPanel.vue'
import TradeTable from '~/components/trades/TradeTable.vue'
import type { OpenTrade, Trade } from '~/data/ledger'

const ledger = useLedger()

const filteredTrades = computed(() => ledger.filteredTrades.value ?? [])
const filteredOpenTrades = computed(() => ledger.filteredOpenTrades.value ?? [])
const searchQuery = ledger.searchQuery
const selectedTradeId = ledger.selectedTradeId
const selectedOpenTradeId = ledger.selectedOpenTradeId
const selectedTrade = computed(() => ledger.selectedTrade.value)
const selectedOpenTrade = computed(() => ledger.selectedOpenTrade.value)

const tradeCountLabel = computed(() => {
  const count = filteredTrades.value.length
  const total = ledger.trades.value.length
  return `${count} of ${total} trades`
})

const openTradeCountLabel = computed(() => {
  const count = filteredOpenTrades.value.length
  const total = ledger.openTrades.value.length
  return `${count} of ${total} active`
})

function handleSelectTrade(trade: Trade) {
  selectedOpenTradeId.value = ''
  selectedTradeId.value = trade.id
}

function handleSelectOpenTrade(trade: OpenTrade) {
  selectedTradeId.value = ''
  selectedOpenTradeId.value = trade.id
}
</script>

<template>
  <div class="page-stack">
    <div class="page-columns">
      <div class="stack">
        <SectionCard title="Active Trades" :subtitle="openTradeCountLabel">
          <div class="stack">
            <div class="two-up">
              <PInputText
                v-model="searchQuery"
                placeholder="Search symbol, setup, notes..."
                class="input-dark"
              />
              <div class="d-flex align-center ga-2 justify-end flex-wrap">
                <PButton
                  type="button"
                  label="Start trade"
                  icon="pi pi-plus"
                  severity="success"
                  class="input-dark"
                  @click="ledger.openStartTradeDialog()"
                />
              </div>
            </div>

            <div v-if="filteredOpenTrades.length" class="open-trade-grid">
              <button
                v-for="trade in filteredOpenTrades"
                :key="trade.id"
                type="button"
                class="open-trade-card"
                :class="{ 'is-active': selectedOpenTradeId === trade.id }"
                @click="handleSelectOpenTrade(trade)"
              >
                <div class="open-trade-card-head">
                  <div>
                    <strong>{{ trade.symbol }} {{ trade.direction }}</strong>
                    <div class="muted">{{ trade.setup }} - {{ trade.session }}</div>
                  </div>
                  <PTag value="Open" severity="warning" />
                </div>
                <div class="open-trade-meta">
                  <span>{{ trade.date }} {{ trade.time }}</span>
                  <span>Entry {{ ledger.formatPrice(trade.entry) }}</span>
                </div>
                <div class="open-trade-metrics">
                  <div>
                    <span class="muted">SL</span>
                    <strong>{{ ledger.formatPrice(trade.stopLoss) }}</strong>
                  </div>
                  <div>
                    <span class="muted">TP</span>
                    <strong>{{ ledger.formatPrice(trade.takeProfit) }}</strong>
                  </div>
                  <div>
                    <span class="muted">Risk</span>
                    <strong>{{ ledger.formatNumber(trade.riskPercent) }}%</strong>
                  </div>
                </div>
              </button>
            </div>

            <div v-else class="upload-empty">
              No active trades in this filter yet.
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Trade Journal" :subtitle="tradeCountLabel">
          <div class="stack">
            <div class="two-up">
              <div class="d-flex align-center ga-2 justify-end flex-wrap">
                <v-chip variant="tonal" color="success">
                  Symbol
                </v-chip>
                <v-chip variant="tonal" color="success">
                  Setup
                </v-chip>
                <v-chip variant="tonal" color="success">
                  Session
                </v-chip>
              </div>
            </div>

            <TradeTable
              :trades="filteredTrades"
              :selected-id="selectedTradeId"
              @select="handleSelectTrade"
            />
          </div>
        </SectionCard>
      </div>

      <OpenTradeDetailPanel v-if="selectedOpenTrade" :trade="selectedOpenTrade" />
      <TradeDetailPanel v-else :trade="selectedTrade" />
    </div>
  </div>
</template>
