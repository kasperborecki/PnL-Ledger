<script setup lang="ts">
import PlaybookGrid from '~/components/playbook/PlaybookGrid.vue'
import SectionCard from '~/components/ui/SectionCard.vue'
import type { Trade } from '~/data/ledger'

type PlaybookHighlightTrade = {
  id: string
  date: string
  symbol: string
  direction: Trade['direction']
  session: Trade['session']
  result: Trade['result']
  netPnl: number
  rr: number
  note: string
}

type PlaybookGalleryShot = {
  id: string
  label: string
  url: string
  tradeLabel: string
  pnl: number
  rr: number
}

type PlaybookInsight = {
  label: string
  value: string
  tone?: 'positive' | 'negative' | 'warning'
}

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
  bestRRTrades?: PlaybookHighlightTrade[]
  gallery?: PlaybookGalleryShot[]
  insights?: PlaybookInsight[]
  strategyBrief?: string
}

const ledger = useLedger()

function mostProfitableBucket<T extends string>(trades: Trade[], key: (trade: Trade) => T) {
  const buckets = new Map<T, { pnl: number, trades: number }>()

  for (const trade of trades) {
    const name = key(trade)
    const bucket = buckets.get(name) ?? { pnl: 0, trades: 0 }
    bucket.pnl += trade.netPnl
    bucket.trades += 1
    buckets.set(name, bucket)
  }

  return [...buckets.entries()]
    .sort((left, right) => right[1].pnl - left[1].pnl)[0] ?? null
}

function firstFilledNote(trade: Trade) {
  return trade.whatWentWell || trade.whyEntered || trade.notes || trade.whatToImprove || 'No trade notes yet.'
}

function makeStrategyBrief(trades: Trade[], wins: number, losses: number) {
  const bestTrade = [...trades].sort((left, right) => right.netPnl - left.netPnl)[0]
  const worstTrade = [...trades].sort((left, right) => left.netPnl - right.netPnl)[0]

  if (!bestTrade) return 'No closed trades to summarize yet.'

  const bestLabel = `${bestTrade.symbol} ${bestTrade.direction.toLowerCase()} delivered ${ledger.formatSignedMoney(bestTrade.netPnl)}`
  const balanceLabel = losses
    ? `${wins}W / ${losses}L`
    : `${wins}W with no closed losses`

  return worstTrade && worstTrade.netPnl < 0
    ? `${bestLabel}; biggest leak is ${worstTrade.symbol} at ${ledger.formatSignedMoney(worstTrade.netPnl)}. Current sample: ${balanceLabel}.`
    : `${bestLabel}. Current sample: ${balanceLabel}.`
}

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
      const bestSession = mostProfitableBucket(trades, (trade) => trade.session)
      const bestSymbol = mostProfitableBucket(trades, (trade) => trade.symbol)
      const directionEdge = mostProfitableBucket(trades, (trade) => trade.direction)
      const bestRRTrades = [...trades]
        .sort((left, right) => right.rr - left.rr)
        .slice(0, 3)
        .map((trade) => ({
          id: trade.id,
          date: trade.date,
          symbol: trade.symbol,
          direction: trade.direction,
          session: trade.session,
          result: trade.result,
          netPnl: trade.netPnl,
          rr: trade.rr,
          note: firstFilledNote(trade),
        }))
      const gallery = [...trades]
        .sort((left, right) => {
          const rrDiff = right.rr - left.rr
          return rrDiff || right.netPnl - left.netPnl
        })
        .flatMap((trade) =>
          trade.screenshots
            .filter((shot) => Boolean(shot.url))
            .map((shot) => ({
              id: `${trade.id}-${shot.label}`,
              label: shot.label,
              url: shot.url as string,
              tradeLabel: `${trade.date} - ${trade.symbol} ${trade.direction}`,
              pnl: trade.netPnl,
              rr: trade.rr,
            })),
        )
        .slice(0, 4)

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
        bestRRTrades,
        gallery,
        strategyBrief: makeStrategyBrief(trades, wins, losses),
        insights: [
          bestSession
            ? {
                label: 'Best session',
                value: `${bestSession[0]} / ${ledger.formatSignedMoney(bestSession[1].pnl)}`,
                tone: bestSession[1].pnl >= 0 ? 'positive' : 'negative',
              }
            : null,
          bestSymbol
            ? {
                label: 'Best symbol',
                value: `${bestSymbol[0]} / ${ledger.formatSignedMoney(bestSymbol[1].pnl)}`,
                tone: bestSymbol[1].pnl >= 0 ? 'positive' : 'negative',
              }
            : null,
          directionEdge
            ? {
                label: 'Direction edge',
                value: `${directionEdge[0]} / ${directionEdge[1].trades} trades`,
              }
            : null,
        ].filter((insight): insight is PlaybookInsight => Boolean(insight)),
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
