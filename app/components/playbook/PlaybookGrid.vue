<script setup lang="ts">
import { computed } from 'vue'

type PlaybookCard = {
  name: string
  trades: number
  wins: number
  losses: number
  winRate: number
  avgRR: number
  pnl: number
  grade: string
  expectancy: number
  expectancyLabel: string
  avgRRLabel: string
  profitFactor: string
}

const props = withDefaults(
  defineProps<{
    items?: PlaybookCard[]
  }>(),
  {
    items: () => [],
  },
)

const safeItems = computed(() => props.items ?? [])
</script>

<template>
  <div class="setup-grid">
    <article v-for="item in safeItems" :key="item.name" class="glass-card setup-card">
      <div class="setup-header">
        <div class="playbook-hero">
          <div class="playbook-letter">{{ item.grade }}</div>
          <div>
            <h2>{{ item.name }}</h2>
            <p class="muted">{{ item.trades }} trades</p>
          </div>
        </div>
        <div class="text-h5 font-weight-black" :class="item.pnl >= 0 ? 'positive' : 'negative'">
          {{ item.pnl >= 0 ? '+' : '' }}{{ item.pnl.toFixed(2) }}
        </div>
      </div>

      <div class="setup-metrics">
        <div class="setup-metric">
          <div class="label">Win Rate</div>
          <div class="value">{{ item.winRate.toFixed(0) }}%</div>
        </div>
        <div class="setup-metric">
          <div class="label">PF</div>
          <div class="value">{{ item.profitFactor }}</div>
        </div>
        <div class="setup-metric">
          <div class="label">Avg R:R</div>
          <div class="value">{{ item.avgRRLabel }}</div>
        </div>
        <div class="setup-metric">
          <div class="label">Expectancy</div>
          <div class="value" :class="item.expectancy >= 0 ? 'positive' : 'negative'">
            {{ item.expectancyLabel }}
          </div>
        </div>
      </div>
    </article>
  </div>
</template>
