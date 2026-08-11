<script setup lang="ts">
import PlaybookGrid from '~/components/playbook/PlaybookGrid.vue'
import SectionCard from '~/components/ui/SectionCard.vue'

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

const ledger = useLedger()

const allTimeSetupInsights = computed(() => {
  const grouped = new Map<string, typeof ledger.trades.value>()

  for (const trade of ledger.trades.value ?? []) {
    const bucket = grouped.get(trade.setup) ?? []
    bucket.push(trade)
    grouped.set(trade.setup, bucket)
  }

  return [...grouped.entries()]
    .map(([name, trades]) => {
      const wins = trades.filter((trade) => trade.result === 'Win').length
      const losses = trades.filter((trade) => trade.result === 'Loss').length
      const pnl = trades.reduce((sum, trade) => sum + trade.netPnl, 0)
      const rr = trades.length ? trades.reduce((sum, trade) => sum + trade.rr, 0) / trades.length : 0
      const winRate = trades.length ? (wins / trades.length) * 100 : 0
      const profitFactor = losses === 0 ? 'Infinity' : (wins ? wins / losses : 0).toFixed(2)

      const item: PlaybookCard = {
        name,
        trades: trades.length,
        wins,
        losses,
        winRate,
        avgRR: rr,
        pnl,
        grade: pnl > 250 ? 'A' : pnl > 0 ? 'B' : 'D',
        expectancy: trades.length ? pnl / trades.length : 0,
        expectancyLabel: ledger.formatSignedMoney(trades.length ? pnl / trades.length : 0),
        avgRRLabel: `1 : ${ledger.formatRatio(rr)}`,
        profitFactor,
      }

      return item
    })
    .sort((left, right) => right.pnl - left.pnl)
})

const playbookItems = computed(() => [
  ...ledger.savedPlaybookCards.value,
  ...allTimeSetupInsights.value,
])

const setupInsights = computed(() => allTimeSetupInsights.value.slice(0, 6))
const hasPlaybookItems = computed(() => playbookItems.value.length > 0)
</script>

<template>
  <div class="page-stack">
    <SectionCard
      title="Playbook"
      subtitle="Ranked setups with real stats, not guesses."
    >
      <div class="muted">
        This view combines all-time setup performance from your trades with saved playbook summaries from the database.
        If nothing appears yet, add a few trades or save a playbook setup in the playbook form.
      </div>
    </SectionCard>

    <SectionCard
      title="Top Setups"
      subtitle="Your current edge by setup."
    >
      <div class="dashboard-outcome-list">
        <div v-for="item in setupInsights" :key="item.name" class="dashboard-outcome-item">
          <div class="dashboard-outcome-main">
            <div class="dashboard-outcome-label">
              <span class="dashboard-dot" :class="item.pnl >= 0 ? 'positive' : 'negative'" />
              <span>{{ item.name }}</span>
            </div>
            <div class="dashboard-outcome-value" :class="item.pnl >= 0 ? 'positive' : 'negative'">
              {{ ledger.formatSignedMoney(item.pnl) }}
            </div>
          </div>
          <div class="dashboard-outcome-meta">
            <span>{{ item.trades }} trades</span>
            <span>Win rate {{ ledger.formatNumber(item.winRate) }}%</span>
            <span>1 : {{ ledger.formatRatio(item.avgRR) }}</span>
          </div>
        </div>
      </div>
    </SectionCard>

    <SectionCard
      v-if="!hasPlaybookItems"
      title="No playbook data yet"
      subtitle="Add a setup or save a playbook card to see it here."
    >
      <div class="muted">
        The playbook view will populate once there are saved setups or trades to analyze.
      </div>
    </SectionCard>

    <PlaybookGrid v-else :items="playbookItems" />
  </div>
</template>
