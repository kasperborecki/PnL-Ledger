<script setup lang="ts">
import { computed } from 'vue'
import type { Trade } from '~/data/ledger'

const props = withDefaults(
  defineProps<{
    trades?: Trade[]
    selectedId?: string
  }>(),
  {
    trades: () => [],
  },
)

const emit = defineEmits<{
  (event: 'select', trade: Trade): void
}>()

const ledger = useLedger()
const safeTrades = computed(() => props.trades ?? [])

function tradeById(id?: string) {
  return safeTrades.value.find((trade) => trade.id === id)
}

function resultSeverity(result: Trade['result']) {
  if (result === 'Win') return 'success'
  if (result === 'Loss') return 'danger'
  return 'warning'
}

function directionSeverity(direction: Trade['direction']) {
  return direction === 'Long' ? 'success' : 'danger'
}
</script>

<template>
  <div class="glass-card table-shell">
    <PDataTable
      :value="safeTrades"
      data-key="id"
      :row-class="() => 'trade-row'"
      striped-rows
      paginator
      :rows="10"
      responsive-layout="scroll"
      :selection="tradeById(selectedId)"
      selection-mode="single"
      @row-click="(event) => emit('select', event.data)"
    >
      <PColumn field="date" header="Date">
        <template #body="{ data }">
          {{ new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${data.date}T00:00:00Z`)) }}
        </template>
      </PColumn>

      <PColumn field="time" header="Time" />
      <PColumn field="symbol" header="Symbol">
        <template #body="{ data }">
          <strong>{{ data.symbol }}</strong>
        </template>
      </PColumn>

      <PColumn field="setup" header="Setup" />

      <PColumn field="direction" header="Dir">
        <template #body="{ data }">
          <PTag :value="data.direction" :severity="directionSeverity(data.direction)" />
        </template>
      </PColumn>

      <PColumn field="rr" header="R:R">
        <template #body="{ data }">
          1 : {{ data.rr.toFixed(1) }}
        </template>
      </PColumn>

      <PColumn field="netPnl" header="P&L">
        <template #body="{ data }">
          <span :class="data.netPnl >= 0 ? 'positive' : 'negative'">
            {{ ledger.formatSignedMoney(data.netPnl) }}
          </span>
        </template>
      </PColumn>

      <PColumn field="result" header="Result">
        <template #body="{ data }">
          <PTag :value="data.result" :severity="resultSeverity(data.result)" />
        </template>
      </PColumn>

      <PColumn field="session" header="Session" />
      <PColumn field="holdMinutes" header="Hold">
        <template #body="{ data }">
          {{ data.holdMinutes }}m
        </template>
      </PColumn>
    </PDataTable>
  </div>
</template>
