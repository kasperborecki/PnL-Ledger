<script setup lang="ts">
import ChartCard from '~/components/ui/ChartCard.vue'
import PlaybookGrid from '~/components/playbook/PlaybookGrid.vue'
import SectionCard from '~/components/ui/SectionCard.vue'
import StatCard from '~/components/ui/StatCard.vue'

const ledger = useLedger()
const playbookItems = computed(() => ledger.playbookCards.value ?? [])
const emotionItems = computed(() => ledger.emotions.value ?? [])

const analyticsKpis = computed(() => [
  {
    label: 'Expectancy',
    value: ledger.formatSignedMoney(ledger.stats.value.expectancy),
    note: 'Per trade',
    icon: 'mdi-flash',
    tone: 'positive' as const,
  },
  {
    label: 'Avg R:R',
    value: `1 : ${ledger.stats.value.avgRR.toFixed(1)}`,
    note: 'Risk control',
    icon: 'mdi-target',
    tone: 'neutral' as const,
  },
  {
    label: 'Avg Hold',
    value: `${ledger.stats.value.avgHoldMinutes}m`,
    note: 'Execution speed',
    icon: 'mdi-clock-outline',
    tone: 'neutral' as const,
  },
  {
    label: 'Win Streak',
    value: String(ledger.stats.value.streak.best),
    note: `Worst ${ledger.stats.value.streak.worst}`,
    icon: 'mdi-fire',
    tone: 'positive' as const,
  },
])

const hourlySeries = computed(() => [
  {
    name: 'P&L',
    data: ledger.hourlySeries.value.map((item) => item.pnl),
  },
])

const hourlyOptions = computed(() => ({
  chart: {
    type: 'heatmap',
    toolbar: { show: false },
    foreColor: '#9ca3af',
    background: 'transparent',
  },
  colors: ['#22c55e'],
  dataLabels: { enabled: false },
  stroke: {
    width: 2,
    colors: ['rgba(7, 10, 15, 0.95)'],
  },
  plotOptions: {
    heatmap: {
      radius: 8,
      enableShades: true,
      shadeIntensity: 0.6,
      colorScale: {
        ranges: [
          { from: -9999, to: -0.00001, color: '#ef4444' },
          { from: 0, to: 0, color: '#334155' },
          { from: 0.00001, to: 9999, color: '#22c55e' },
        ],
      },
    },
  },
  legend: { show: false },
  grid: { borderColor: 'rgba(255,255,255,0.05)' },
  xaxis: {
    categories: ledger.hourlySeries.value.map((item) => `${item.hour}`),
    labels: { style: { colors: '#9ca3af' } },
  },
  yaxis: { labels: { style: { colors: '#9ca3af' } } },
  tooltip: { theme: 'dark' },
  theme: { mode: 'dark' },
}))

const sessionSeries = computed(() => [
  {
    name: 'Session P&L',
    data: ledger.sessions.value.map((item) => item.pnl),
  },
])

const sessionOptions = computed(() => ({
  chart: {
    type: 'bar',
    toolbar: { show: false },
    foreColor: '#9ca3af',
    background: 'transparent',
  },
  plotOptions: {
    bar: {
      horizontal: true,
      borderRadius: 10,
      barHeight: '54%',
    },
  },
  colors: ['#22c55e'],
  dataLabels: { enabled: false },
  grid: { borderColor: 'rgba(255,255,255,0.05)' },
  xaxis: {
    categories: ledger.sessions.value.map((item) => item.name),
    labels: { style: { colors: '#9ca3af' } },
  },
  tooltip: {
    theme: 'dark',
    y: {
      formatter: (value: number) => ledger.formatSignedMoney(value),
    },
  },
  theme: { mode: 'dark' },
}))
</script>

<template>
  <div class="page-stack">
    <div class="kpi-grid analytics-kpi-grid">
      <StatCard
        v-for="(kpi, index) in analyticsKpis"
        :key="index"
        class="analytics-stat-card"
        v-bind="kpi"
      />
    </div>

    <SectionCard
      class="analytics-section analytics-section--wide"
      title="Setup Performance"
      subtitle="Which setups actually make money."
    >
      <PlaybookGrid :items="playbookItems" />
    </SectionCard>

    <div class="two-col analytics-chart-row">
      <ChartCard
        class="analytics-chart-card"
        title="P&L by Hour"
        subtitle="When you make and lose money."
        type="heatmap"
        :series="hourlySeries"
        :options="hourlyOptions"
        :height="340"
        :legend-items="[
          { label: '>1', color: '#22c55e' },
          { label: '0', color: '#334155' },
          { label: '<1', color: '#ef4444' },
        ]"
      />

      <ChartCard
        class="analytics-chart-card"
        title="By Session"
        subtitle="Where your edge lives."
        type="bar"
        :series="sessionSeries"
        :options="sessionOptions"
        :height="340"
      />
    </div>

    <SectionCard class="analytics-section" title="Psychology Impact" subtitle="How your emotions affect the P&L.">
      <div class="two-up">
        <div v-for="item in emotionItems" :key="item.name" class="detail-item">
          <div class="detail-label">{{ item.name }}</div>
          <div class="detail-value d-flex align-center justify-space-between">
            <span>{{ item.trades }} trades</span>
            <span :class="item.pnl >= 0 ? 'positive' : 'negative'">
              {{ ledger.formatSignedMoney(item.pnl) }}
            </span>
          </div>
        </div>
      </div>
    </SectionCard>
  </div>
</template>
