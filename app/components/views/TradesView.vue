<script setup lang="ts">
import SectionCard from '~/components/ui/SectionCard.vue'
import TradeDetailPanel from '~/components/trades/TradeDetailPanel.vue'
import TradeTable from '~/components/trades/TradeTable.vue'
import type { Trade } from '~/data/ledger'

const ledger = useLedger()

const filteredTrades = computed(() => ledger.filteredTrades.value ?? [])
const searchQuery = ledger.searchQuery
const selectedTradeId = ledger.selectedTradeId
const selectedTrade = computed(() => ledger.selectedTrade.value)

const tradeCountLabel = computed(() => {
  const count = filteredTrades.value.length
  const total = ledger.trades.value.length
  return `${count} of ${total} trades`
})

function handleSelectTrade(trade: Trade) {
  selectedTradeId.value = trade.id
}
</script>

<template>
  <div class="page-stack">
    <div class="page-columns">
      <SectionCard title="Trade Journal" :subtitle="tradeCountLabel">
        <div class="stack">
          <div class="two-up">
            <PInputText
              v-model="searchQuery"
              placeholder="Search symbol, setup, notes..."
              class="input-dark"
            />
            <div class="d-flex align-center ga-2 justify-end flex-wrap">
              <v-chip variant="tonal" color="success">
                Symbol
              </v-chip>
              <v-chip variant="tonal" color="success">
                Setup
              </v-chip>
              <v-chip variant="tonal" color="success">
                Emotion
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

      <TradeDetailPanel :trade="selectedTrade" />
    </div>
  </div>
</template>
