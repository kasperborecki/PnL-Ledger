<script setup lang="ts">
type CalendarDay = {
  key: string
  empty: boolean
  day: number | null
  date: string | null
  pnl: number
  trades: number
  status: 'none' | 'positive' | 'negative' | 'neutral'
  label: string
}

import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    days?: CalendarDay[]
    selectedDay: string
  }>(),
  {
    days: () => [],
  },
)

const emit = defineEmits<{
  (event: 'select', day: string): void
}>()

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const safeDays = computed(() => props.days ?? [])

function dayClass(day: CalendarDay) {
  return [
    'calendar-day',
    day.empty ? 'is-empty' : '',
    day.status === 'positive' ? 'is-positive' : '',
    day.status === 'negative' ? 'is-negative' : '',
    day.status === 'neutral' ? 'is-neutral' : '',
    day.date && props.selectedDay === day.date ? 'is-active' : '',
  ]
}
</script>

<template>
  <div class="glass-card">
    <div class="panel">
      <div class="section-title">
        <div>
          <h2>Monthly P&L Calendar</h2>
          <p>Track your daily trading performance and consistency.</p>
        </div>
        <div class="text-h5 font-weight-black positive">
          {{ safeDays.filter((day) => !day.empty).reduce((sum, day) => sum + day.pnl, 0).toFixed(2) }}
        </div>
      </div>

      <div class="calendar-grid mb-3">
        <div v-for="weekday in weekdays" :key="weekday" class="calendar-weekday">
          {{ weekday }}
        </div>
      </div>

      <div class="calendar-grid">
        <button
          v-for="day in safeDays"
          :key="day.key"
          :class="dayClass(day)"
          @click="day.date && emit('select', day.date)"
        >
          <template v-if="!day.empty">
            <div class="calendar-number">{{ day.day }}</div>
            <div class="calendar-pnl" :class="day.pnl >= 0 ? 'positive' : 'negative'">
              <template v-if="day.trades">{{ day.pnl > 0 ? '+' : '' }}{{ day.pnl.toFixed(2) }}</template>
              <template v-else>-</template>
            </div>
            <div class="calendar-meta">
              <span>{{ day.trades }} t</span>
              <span>{{ day.label }}</span>
            </div>
          </template>
        </button>
      </div>
    </div>
  </div>
</template>
