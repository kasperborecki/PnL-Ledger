<script setup lang="ts">
import ChartCard from '~/components/ui/ChartCard.vue'
import SectionCard from '~/components/ui/SectionCard.vue'
import StatCard from '~/components/ui/StatCard.vue'

const ledger = useLedger()

const dashboardKpis = computed(() => ledger.dashboardKpis.value ?? [])

const equitySeries = computed(() => [
  {
    name: 'Equity',
    data: ledger.equitySeries.value.map((point) => point.y),
  },
])

const equityValue = computed(() => ledger.formatSignedMoney(ledger.stats.value.netPnl ?? 0))

const equityOptions = computed(() => ({
  chart: {
    type: 'area',
    toolbar: { show: false },
    zoom: { enabled: false },
    foreColor: '#9ca3af',
    background: 'transparent',
  },
  colors: ['#22c55e'],
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 3 },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.28,
      opacityTo: 0.02,
      stops: [0, 88, 100],
    },
  },
  grid: {
    borderColor: 'rgba(255,255,255,0.05)',
    strokeDashArray: 4,
  },
  xaxis: {
    categories: ledger.dailySeries.value.map((day) => day.label),
    axisBorder: { color: 'rgba(255,255,255,0.08)' },
    axisTicks: { color: 'rgba(255,255,255,0.08)' },
    labels: { style: { colors: '#9ca3af' } },
  },
  yaxis: {
    labels: {
      formatter: (value: number) => ledger.formatPlainMoney(value),
      style: { colors: '#9ca3af' },
    },
  },
  tooltip: {
    theme: 'dark',
    y: {
      formatter: (value: number) => ledger.formatSignedMoney(value),
    },
  },
  theme: { mode: 'dark' },
}))

const splitLegend = computed(() => {
  const total = Math.max(ledger.stats.value.totalTrades, 1)

  return [
    {
      label: 'Wins',
      value: ledger.stats.value.wins,
      pnl: ledger.stats.value.grossWins,
      share: `${Math.round((ledger.stats.value.wins / total) * 100)}%`,
      tone: 'positive',
    },
    {
      label: 'Losses',
      value: ledger.stats.value.losses,
      pnl: -ledger.stats.value.grossLosses,
      share: `${Math.round((ledger.stats.value.losses / total) * 100)}%`,
      tone: 'negative',
    },
    {
      label: 'Breakeven',
      value: ledger.stats.value.breakeven,
      pnl: 0,
      share: `${Math.round((ledger.stats.value.breakeven / total) * 100)}%`,
      tone: 'warning',
    },
  ]
})

const dashboardSignals = computed(() => [
  {
    label: 'Expectancy',
    value: ledger.formatSignedMoney(ledger.stats.value.expectancy),
    note: 'Per trade',
  },
  {
    label: 'Avg Duration',
    value: ledger.formatDuration(ledger.stats.value.avgHoldMinutes),
    note: 'Execution pace',
  },
  {
    label: 'Best Streak',
    value: String(ledger.stats.value.streak.best),
    note: 'Winning flow',
  },
  {
    label: 'Total Trades',
    value: ledger.formatNumber(ledger.stats.value.totalTrades),
    note: 'Sample size',
  },
])

const topSetups = computed(() => ledger.setups.value.slice(0, 4))
const topSessions = computed(() => ledger.sessions.value.slice(0, 3))
</script>

<template>
  <div class="page-stack">
    <div class="kpi-grid dashboard-kpi-grid">
      <StatCard
        v-for="(kpi, index) in dashboardKpis"
        :key="index"
        v-bind="kpi ?? {}"
      />
    </div>

    <div class="two-col dashboard-main-grid">
      <ChartCard
        title="Equity Curve"
        subtitle="Cumulative net P&L across the filtered trades."
        type="area"
        :series="equitySeries"
        :options="equityOptions"
        :height="340"
        :value="equityValue"
      />

      <SectionCard title="Outcome Breakdown" subtitle="Quick pulse on how this sample resolves.">
        <div class="dashboard-outcome-list">
          <div
            v-for="item in splitLegend"
            :key="item.label"
            class="dashboard-outcome-item"
          >
            <div class="dashboard-outcome-main">
              <div class="dashboard-outcome-label">
                <span class="dashboard-dot" :class="item.tone" />
                {{ item.label }}
              </div>
              <div class="dashboard-outcome-meta">
                {{ item.value }} trades
                <span>{{ item.share }}</span>
              </div>
            </div>
            <div class="dashboard-outcome-value" :class="item.tone">
              {{ item.pnl > 0 ? '+' : '' }}{{ ledger.formatPlainMoney(item.pnl) }}
            </div>
          </div>
        </div>

        <div class="dashboard-signal-grid">
          <div
            v-for="signal in dashboardSignals"
            :key="signal.label"
            class="dashboard-signal-card"
          >
            <div class="detail-label">{{ signal.label }}</div>
            <div class="detail-value">{{ signal.value }}</div>
            <div class="dashboard-signal-note">{{ signal.note }}</div>
          </div>
        </div>
      </SectionCard>
    </div>

    <div class="two-col">
      <SectionCard title="Top Setups" subtitle="What is actually paying you right now.">
        <div class="dashboard-rank-list">
          <div
            v-for="setup in topSetups"
            :key="setup.name"
            class="dashboard-rank-item"
          >
            <div>
              <div class="dashboard-rank-title">{{ setup.name }}</div>
              <div class="dashboard-rank-meta">
                {{ setup.trades }} trades / {{ ledger.formatNumber(setup.winRate) }}% WR / 1 : {{ ledger.formatRatio(setup.avgRR) }}
              </div>
            </div>
            <div class="dashboard-rank-value" :class="setup.pnl >= 0 ? 'positive' : 'negative'">
              {{ ledger.formatSignedMoney(setup.pnl) }}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Session Edge" subtitle="Where the edge is showing up.">
        <div class="dashboard-rank-list">
          <div
            v-for="session in topSessions"
            :key="session.name"
            class="dashboard-rank-item"
          >
            <div>
              <div class="dashboard-rank-title">{{ session.name }}</div>
              <div class="dashboard-rank-meta">
                {{ session.trades }} trades / {{ ledger.formatNumber(session.winRate) }}% WR
              </div>
            </div>
            <div class="dashboard-rank-value" :class="session.pnl >= 0 ? 'positive' : 'negative'">
              {{ ledger.formatSignedMoney(session.pnl) }}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  </div>
</template>
