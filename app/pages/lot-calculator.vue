<script setup lang="ts">
import PositionCalculator from '~/components/management/PositionCalculator.vue'

definePageMeta({
  title: 'Lot Calculator',
  subtitle: 'Position sizing with live quotes and broker-style pip values',
})

const auth = useAuth()
const defaultStartingBalance = computed(() => auth.currentBalance.value ?? 0)
</script>

<template>
  <PositionCalculator :default-starting-balance="defaultStartingBalance" />
</template>
