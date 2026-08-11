<script setup lang="ts">
import MonthlyCalendar from '~/components/calendar/MonthlyCalendar.vue'
import SectionCard from '~/components/ui/SectionCard.vue'

const ledger = useLedger()
const calendarDays = computed(() => ledger.calendarDays.value ?? [])
const selectedDayTrades = computed(() => ledger.selectedDayTrades.value ?? [])
const selectedDay = ledger.selectedDay

const currentMonthLabel = computed(() => ledger.calendarMonthLabel.value)
const currentDaySummary = computed(
  () => calendarDays.value.find((day) => day.date === selectedDay.value) ?? null,
)

function previousMonth() {
  ledger.previousCalendarMonth()
}

function nextMonth() {
  ledger.nextCalendarMonth()
}

function handleSelectDay(day: string) {
  selectedDay.value = day
}
</script>

<template>
  <div class="page-stack">
    <div class="calendar-toolbar glass-card">
      <div>
        <div class="section-kicker">Monthly navigation</div>
        <h2 class="calendar-toolbar-title">Calendar</h2>
        <p class="calendar-toolbar-subtitle">Move through months with the controls on the right.</p>
      </div>

      <div class="calendar-toolbar-actions">
        <v-btn variant="tonal" class="calendar-switcher-btn" icon="mdi-chevron-left" @click="previousMonth" />
        <v-btn variant="tonal" class="calendar-toolbar-pill">{{ currentMonthLabel }}</v-btn>
        <v-btn variant="tonal" class="calendar-switcher-btn" icon="mdi-chevron-right" @click="nextMonth" />
      </div>
    </div>

    <div class="page-columns">
      <MonthlyCalendar
        :days="calendarDays"
        :selected-day="selectedDay"
        @select="handleSelectDay"
      />

      <SectionCard
        title="Selected Day"
        subtitle="Daily breakdown for the highlighted date."
      >
        <div class="stack">
          <div class="detail-hero">
            <div>
              <div class="muted text-uppercase text-caption font-weight-bold">
                {{ currentDaySummary?.date ?? selectedDay }}
              </div>
              <div class="text-h6 font-weight-bold">
                {{ currentDaySummary?.trades ?? 0 }} trades
              </div>
            </div>
            <div
              class="text-h4 font-weight-black"
              :class="(currentDaySummary?.pnl ?? 0) >= 0 ? 'positive' : 'negative'"
            >
              {{
                currentDaySummary
                  ? ledger.formatSignedMoney(currentDaySummary.pnl)
                  : ledger.formatSignedMoney(0)
              }}
            </div>
          </div>

          <div class="drawer-stack" v-if="selectedDayTrades.length">
            <div
              v-for="trade in selectedDayTrades"
              :key="trade.id"
              class="journal-entry"
            >
              <div class="journal-entry-top">
                <div class="journal-entry-title">
                  {{ trade.time }} - {{ trade.symbol }} {{ trade.direction }} - {{ trade.setup }}
                </div>
                <div class="font-weight-bold" :class="trade.netPnl >= 0 ? 'positive' : 'negative'">
                  {{ ledger.formatSignedMoney(trade.netPnl) }}
                </div>
              </div>

              <div class="journal-grid">
                <div class="journal-box">
                  <div class="label">Duration</div>
                  <div class="text">{{ ledger.formatDuration(trade.holdMinutes) }}</div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="detail-item">
            <div class="detail-label">No trades</div>
            <div class="detail-value">Nothing logged for this day yet.</div>
          </div>
        </div>
      </SectionCard>
    </div>
  </div>
</template>
