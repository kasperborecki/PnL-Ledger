<script setup lang="ts">
import PositionCalculator from '~/components/management/PositionCalculator.vue'

definePageMeta({
  title: 'Lot Calculator',
  subtitle: 'Position sizing with live quotes and broker-style pip values',
})

const accounts = useTradingAccounts()
const defaultStartingBalance = computed(() => accounts.balance.value ?? 0)
</script>

<template>
  <p v-if="!accounts.selected.value" class="muted mb-4">Select an account above to use its balance for position sizing.</p>
  <PositionCalculator :key="accounts.selectedId.value" :default-starting-balance="defaultStartingBalance" />
</template>
