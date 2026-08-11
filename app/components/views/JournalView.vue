<script setup lang="ts">
import JournalTimeline from '~/components/journal/JournalTimeline.vue'
import SectionCard from '~/components/ui/SectionCard.vue'
import StatCard from '~/components/ui/StatCard.vue'

const ledger = useLedger()
const journalDays = computed(() => ledger.journalDays.value ?? [])

const journalKpis = computed(() => [
  {
    label: 'Journal Days',
    value: String(journalDays.value.length),
    note: 'Sessions with logged review',
    icon: 'mdi-notebook-outline',
    tone: 'neutral' as const,
  },
  {
    label: 'Win Rate',
    value: `${ledger.stats.value.winRate.toFixed(1)}%`,
    note: 'Across reviewed trades',
    icon: 'mdi-target',
    tone: 'positive' as const,
  },
  {
    label: 'Avg Duration',
    value: ledger.formatDuration(ledger.stats.value.avgHoldMinutes),
    note: 'How long the edge lasts',
    icon: 'mdi-clock-outline',
    tone: 'neutral' as const,
  },
  {
    label: 'Discipline',
    value: `${(5 + ledger.stats.value.winRate / 20).toFixed(1)}/10`,
    note: 'Derived from execution quality',
    icon: 'mdi-badge-account-outline',
    tone: 'positive' as const,
  },
])
</script>

<template>
  <div class="page-stack">
    <div class="kpi-grid journal-kpi-grid">
      <StatCard v-for="(kpi, index) in journalKpis" :key="index" v-bind="kpi" />
    </div>

    <SectionCard
      title="Journal Timeline"
      subtitle="Every review here is pulled directly from the trade entry flow."
    >
      <JournalTimeline :days="journalDays" />
    </SectionCard>
  </div>
</template>
