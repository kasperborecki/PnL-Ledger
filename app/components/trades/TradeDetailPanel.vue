<script setup lang="ts">
import type { Trade } from '~/data/ledger'

const props = defineProps<{
  trade: Trade | null
}>()

const ledger = useLedger()

const tradeActionBusy = ref(false)

function fixed(value: number | undefined, digits = 1) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : '-'
}

async function handleEditTrade() {
  if (!props.trade) {
    return
  }

  ledger.openTradeEditDialog(props.trade.id)
}

async function handleDeleteTrade() {
  if (!props.trade || tradeActionBusy.value) {
    return
  }

  tradeActionBusy.value = true
  try {
    await ledger.deleteTrade(props.trade.id)
  } finally {
    tradeActionBusy.value = false
  }
}
</script>

<template>
  <v-card class="glass-card detail-panel">
    <div v-if="props.trade" class="panel">
      <div class="journal-header">
        <div>
          <h2>{{ props.trade.symbol }} {{ props.trade.direction }} - {{ props.trade.setup }}</h2>
          <p class="muted">
            {{ props.trade.date }} - {{ props.trade.time }} - {{ props.trade.session }}
          </p>
        </div>
        <div class="d-flex ga-2 flex-wrap">
          <PButton
            type="button"
            label="Edit"
            icon="pi pi-pencil"
            severity="warning"
            text
            class="input-dark action-edit"
            @click="handleEditTrade"
          />
          <PButton
            type="button"
            label="Delete"
            icon="pi pi-trash"
            severity="danger"
            text
            class="input-dark action-danger"
            :loading="tradeActionBusy"
            @click="handleDeleteTrade"
          />
        </div>
      </div>

      <div class="detail-hero">
        <div>
          <div class="muted text-uppercase text-caption font-weight-bold">Result</div>
          <div class="text-h6 font-weight-bold">{{ props.trade.result }}</div>
        </div>
        <div class="text-h4 font-weight-black" :class="props.trade.netPnl >= 0 ? 'positive' : 'negative'">
          {{ ledger.formatSignedMoney(props.trade.netPnl) }}
        </div>
      </div>

      <div class="drawer-stack mt-4">
        <div class="detail-grid">
            <div class="detail-item">
              <div class="detail-label">Symbol</div>
            <div class="detail-value">{{ props.trade.symbol }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Direction</div>
            <div class="detail-value">{{ props.trade.direction }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Setup</div>
            <div class="detail-value">{{ props.trade.setup }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Session</div>
            <div class="detail-value">{{ props.trade.session }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Entry</div>
            <div class="detail-value">{{ ledger.formatNumber(props.trade.entry) }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Exit</div>
            <div class="detail-value">{{ ledger.formatNumber(props.trade.exit) }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Stop Loss</div>
            <div class="detail-value">{{ ledger.formatNumber(props.trade.stopLoss) }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Take Profit</div>
            <div class="detail-value">{{ ledger.formatNumber(props.trade.takeProfit) }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">R:R</div>
            <div class="detail-value">1 : {{ fixed(props.trade.rr) }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Risk</div>
            <div class="detail-value">{{ fixed(props.trade.riskPercent) }}%</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Size</div>
            <div class="detail-value">{{ props.trade.size }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Commission</div>
            <div class="detail-value">{{ ledger.formatSignedMoney(-props.trade.commission) }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Gross P&L</div>
            <div class="detail-value">{{ ledger.formatSignedMoney(props.trade.grossPnl) }}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Net P&L</div>
            <div class="detail-value" :class="props.trade.netPnl >= 0 ? 'positive' : 'negative'">
              {{ ledger.formatSignedMoney(props.trade.netPnl) }}
            </div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Hold</div>
            <div class="detail-value">{{ props.trade.holdMinutes }}m</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Emotion</div>
            <div class="detail-value">{{ props.trade.emotion }}</div>
            </div>
          </div>

        <div>
          <div class="section-title">
            <div>
              <h2>Screenshots</h2>
              <p>Screenshots are loaded from Supabase Storage for this trade.</p>
            </div>
          </div>
          <div class="screenshot-grid">
            <div v-for="shot in props.trade.screenshots" :key="shot.label" class="shot-card">
              <template v-if="shot.url">
                <img :src="shot.url" :alt="shot.label" class="shot-image" />
              </template>
              <div class="shot-card-caption">
                <v-icon size="30" class="mb-2">mdi-chart-box-outline</v-icon>
                <div class="font-weight-bold">{{ shot.label }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-label">Why I entered</div>
          <div class="detail-value font-weight-regular">{{ props.trade.whyEntered }}</div>
        </div>

        <div class="detail-item">
          <div class="detail-label">What went well</div>
          <div class="detail-value font-weight-regular">{{ props.trade.whatWentWell }}</div>
        </div>

        <div class="detail-item">
          <div class="detail-label">What to improve</div>
          <div class="detail-value font-weight-regular">{{ props.trade.whatToImprove }}</div>
        </div>

        <div class="detail-item">
          <div class="detail-label">Notes</div>
          <div class="detail-value font-weight-regular">{{ props.trade.notes }}</div>
        </div>

        <div class="d-flex flex-wrap ga-2">
          <PTag v-for="tag in props.trade.tags" :key="tag" :value="tag" severity="secondary" />
        </div>
      </div>
    </div>

    <div v-else class="panel">
      <h2>No trade selected</h2>
      <p class="muted">Click a trade row to see full execution details.</p>
    </div>
  </v-card>
</template>
