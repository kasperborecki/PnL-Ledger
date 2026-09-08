<script setup lang="ts">
import { computed, ref } from 'vue'
import ImagePreviewDialog from '~/components/ui/ImagePreviewDialog.vue'
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

const props = withDefaults(
  defineProps<{
    items?: PlaybookCard[]
  }>(),
  {
    items: () => [],
  },
)

const safeItems = computed(() => props.items ?? [])
const previewVisible = ref(false)
const previewUrl = ref<string | null>(null)
const previewTitle = ref('')

function openPreview(url: string, title: string) {
  previewUrl.value = url
  previewTitle.value = title
  previewVisible.value = true
}
</script>

<template>
  <div class="setup-grid playbook-grid">
    <article v-for="item in safeItems" :key="item.name" class="glass-card setup-card playbook-card">
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

      <div v-if="item.strategyBrief || item.insights?.length" class="playbook-summary">
        <p v-if="item.strategyBrief">{{ item.strategyBrief }}</p>

        <div v-if="item.insights?.length" class="playbook-insights">
          <div v-for="insight in item.insights" :key="insight.label" class="playbook-insight">
            <span>{{ insight.label }}</span>
            <strong :class="insight.tone">{{ insight.value }}</strong>
          </div>
        </div>
      </div>

      <div v-if="item.bestRRTrades?.length" class="playbook-section">
        <div class="playbook-section-head">
          <span>Top 3 Best R:R</span>
          <small>highest multiple trades</small>
        </div>

        <div class="playbook-rr-list">
          <div v-for="(trade, index) in item.bestRRTrades" :key="trade.id" class="playbook-rr-row">
            <div class="playbook-rank">{{ index + 1 }}</div>
            <div class="playbook-rr-main">
              <strong>{{ trade.symbol }} {{ trade.direction }}</strong>
              <span>{{ trade.date }} - {{ trade.session }} - {{ trade.result }}</span>
              <p>{{ trade.note }}</p>
            </div>
            <div class="playbook-rr-values">
              <strong>1 : {{ trade.rr.toFixed(2) }}</strong>
              <span :class="trade.netPnl >= 0 ? 'positive' : 'negative'">
                {{ trade.netPnl >= 0 ? '+' : '' }}{{ trade.netPnl.toFixed(2) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="item.gallery?.length" class="playbook-section">
        <div class="playbook-section-head">
          <span>Trade Gallery</span>
          <small>{{ item.gallery.length }} screenshots</small>
        </div>

        <div class="playbook-gallery">
          <button
            v-for="shot in item.gallery"
            :key="shot.id"
            type="button"
            class="playbook-shot"
            @click="openPreview(shot.url, `${item.name} - ${shot.label}`)"
          >
            <img :src="shot.url" :alt="shot.label">
            <span>{{ shot.label }}</span>
            <small>{{ shot.tradeLabel }} / 1 : {{ shot.rr.toFixed(2) }}</small>
          </button>
        </div>
      </div>
    </article>

    <ImagePreviewDialog
      v-model:visible="previewVisible"
      :url="previewUrl"
      :title="previewTitle"
    />
  </div>
</template>
