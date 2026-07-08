<script setup lang="ts">
import { computed } from 'vue'
import type { Trade } from '~/data/ledger'

type JournalDay = {
  date: string
  label: string
  pnl: number
  trades: Trade[]
  wins: number
  losses: number
}

const props = withDefaults(
  defineProps<{
    days?: JournalDay[]
  }>(),
  {
    days: () => [],
  },
)

const safeDays = computed(() => props.days ?? [])
</script>

<template>
  <div class="journal-list">
    <div v-for="day in safeDays" :key="day.date" class="glass-card journal-day">
      <div class="journal-header">
        <div>
          <h2>{{ day.label }}</h2>
          <p class="muted">
            {{ day.trades?.length ?? 0 }} trades - {{ day.wins ?? 0 }}W / {{ day.losses ?? 0 }}L
          </p>
        </div>
        <div class="text-h4 font-weight-black" :class="day.pnl >= 0 ? 'positive' : 'negative'">
          {{ day.pnl >= 0 ? '+' : '' }}{{ day.pnl.toFixed(2) }}
        </div>
      </div>

      <div class="journal-list">
        <article v-for="trade in day.trades ?? []" :key="trade.id" class="journal-entry">
          <div class="journal-entry-top">
            <div class="journal-entry-title">
              {{ trade.time }} - {{ trade.symbol }}
              <span :class="trade.direction === 'Long' ? 'positive' : 'negative'">
                {{ trade.direction }}
              </span>
              - {{ trade.setup }}
            </div>
            <div class="font-weight-bold" :class="trade.netPnl >= 0 ? 'positive' : 'negative'">
              {{ trade.netPnl >= 0 ? '+' : '' }}{{ trade.netPnl.toFixed(2) }}
            </div>
          </div>

          <div class="journal-grid">
            <div class="journal-box">
              <div class="label">Why I entered</div>
              <div class="text">{{ trade.whyEntered }}</div>
            </div>
            <div class="journal-box">
              <div class="label">What went well</div>
              <div class="text">{{ trade.whatWentWell }}</div>
            </div>
            <div class="journal-box">
              <div class="label">What to improve</div>
              <div class="text">{{ trade.whatToImprove }}</div>
            </div>
            <div class="journal-box">
              <div class="label">Emotion</div>
              <div class="text">{{ trade.emotion }}</div>
            </div>
          </div>

          <div class="mt-3 d-flex flex-wrap ga-2">
            <PTag
              v-for="tag in trade.tags"
              :key="tag"
              :value="tag"
              severity="secondary"
            />
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
