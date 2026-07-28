<script setup lang="ts">
const route = useRoute()
const ledger = useLedger()

const title = computed(() => String(route.meta.title ?? 'P&L Ledger'))
const subtitle = computed(() => String(route.meta.subtitle ?? 'Trading Journal & Performance Tracker'))
const symbolOptions = computed(() => ledger.symbolOptions.value)
const setupOptions = computed(() => ledger.setupOptions.value)
const sessionOptions = computed(() => ledger.sessionOptions)
const timeframe = computed({
  get: () => ledger.timeframe.value,
  set: (value) => {
    ledger.timeframe.value = value as typeof ledger.timeframe.value
  },
})
const selectedSymbol = computed({
  get: () => ledger.selectedSymbol.value,
  set: (value) => {
    ledger.selectedSymbol.value = value
  },
})
const selectedSetup = computed({
  get: () => ledger.selectedSetup.value,
  set: (value) => {
    ledger.selectedSetup.value = value
  },
})
const selectedSession = computed({
  get: () => ledger.selectedSession.value,
  set: (value) => {
    ledger.selectedSession.value = value
  },
})

function setTimeframe(value: string) {
  timeframe.value = value as typeof ledger.timeframe.value
}
</script>

<template>
  <header class="app-topbar">
    <div class="topbar-main">
      <div class="topbar-heading">
        <div>
          <div class="topbar-kicker">Workspace</div>
          <h1 class="page-title">{{ title }}</h1>
          <div class="page-subtitle">{{ subtitle }}</div>
        </div>
      </div>

      <div class="topbar-primary">
        <div class="range-chip-group">
          <button
            v-for="option in ledger.rangeOptions"
            :key="option.value"
            class="range-chip"
            :class="{ 'is-active': timeframe === option.value }"
            @click="setTimeframe(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="topbar-filters">
      <PDropdown
        v-model="selectedSymbol"
        :options="symbolOptions"
        option-label="label"
        option-value="value"
        class="input-dark"
        placeholder="Symbol"
        style="min-width: 170px"
      />

      <PDropdown
        v-model="selectedSetup"
        :options="setupOptions"
        option-label="label"
        option-value="value"
        class="input-dark"
        placeholder="Setup"
        style="min-width: 190px"
      />

      <PDropdown
        v-model="selectedSession"
        :options="sessionOptions"
        option-label="label"
        option-value="value"
        class="input-dark"
        placeholder="Session"
        style="min-width: 170px"
      />
    </div>

    <div v-if="ledger.loadError.value" class="sync-banner">
      Data sync error: {{ ledger.loadError.value }}
    </div>
  </header>
</template>
