<script setup lang="ts">
import ImagePreviewDialog from '~/components/ui/ImagePreviewDialog.vue'
import type { OpenTrade } from '~/data/ledger'

const props = defineProps<{
  trade: OpenTrade | null
}>()

const ledger = useLedger()
const setupEngine = useTradingSetups()
const tradeActionBusy = ref(false)
const isImagePreviewOpen = ref(false)
const previewImageUrl = ref<string | null>(null)
const previewImageTitle = ref('')

const setupEvaluations = computed(() =>
  props.trade
    ? setupEngine.evaluations.value
      .filter((evaluation) => evaluation.open_trade_id === props.trade?.id)
      .sort((left, right) => String(right.graded_at).localeCompare(String(left.graded_at)))
    : [],
)

function setupName(setupId: string) {
  return setupEngine.setupSummaries.value.find((setup) => setup.id === setupId)?.name ?? 'Setup'
}

function formatEvaluationDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

async function handleCloseTrade() {
  if (!props.trade) {
    return
  }

  ledger.openOpenTradeCloseDialog(props.trade.id)
}

async function handleEditTrade() {
  if (!props.trade) {
    return
  }

  ledger.openOpenTradeEditDialog(props.trade.id)
}

async function openTradeEvaluation() {
  if (!props.trade) {
    return
  }

  await navigateTo(`/setups?openTrade=${props.trade.id}`)
}

async function handleDeleteTrade() {
  if (!props.trade || tradeActionBusy.value) {
    return
  }

  tradeActionBusy.value = true
  try {
    await ledger.deleteOpenTrade(props.trade.id)
  } finally {
    tradeActionBusy.value = false
  }
}

function openImagePreview(url: string | null, title: string) {
  if (!url) {
    return
  }

  previewImageUrl.value = url
  previewImageTitle.value = title
  isImagePreviewOpen.value = true
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
            label="Grade Setup"
            icon="pi pi-check-circle"
            text
            class="input-dark action-primary"
            @click="openTradeEvaluation"
          />
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
            label="Close"
            icon="pi pi-check-circle"
            severity="success"
            text
            class="input-dark action-primary"
            @click="handleCloseTrade"
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
          <div class="muted text-uppercase text-caption font-weight-bold">Status</div>
          <div class="text-h6 font-weight-bold">Open</div>
        </div>
        <div class="text-h4 font-weight-black positive">
          {{ ledger.formatPrice(props.trade.entry) }}
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
            <div class="detail-value">{{ ledger.formatPrice(props.trade.entry) }}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Stop Loss</div>
            <div class="detail-value">{{ ledger.formatPrice(props.trade.stopLoss) }}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Take Profit</div>
            <div class="detail-value">{{ ledger.formatPrice(props.trade.takeProfit) }}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Size</div>
            <div class="detail-value">{{ ledger.formatNumber(props.trade.size) }}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Risk</div>
            <div class="detail-value">{{ ledger.formatNumber(props.trade.riskPercent) }}%</div>
          </div>
        </div>

        <div>
          <div class="section-title">
            <div>
              <h2>Setup Evaluations</h2>
              <p>Saved setup scores linked to this active trade.</p>
            </div>
          </div>

          <div v-if="setupEvaluations.length" class="trade-evaluation-list">
            <div v-for="evaluation in setupEvaluations" :key="evaluation.id" class="trade-evaluation-row">
              <div>
                <div class="trade-evaluation-title">{{ setupName(evaluation.setup_id) }}</div>
                <div class="trade-evaluation-meta">
                  {{ formatEvaluationDate(evaluation.graded_at) }} - {{ evaluation.evaluation_type.replaceAll('_', ' ') }}
                </div>
              </div>
              <div class="trade-evaluation-score">
                <strong>{{ Number(evaluation.raw_score).toFixed(1) }} / {{ Number(evaluation.max_score).toFixed(1) }}</strong>
                <span>{{ Number(evaluation.normalized_percentage).toFixed(1) }}% - {{ evaluation.grade_label || 'No grade' }}</span>
              </div>
              <PTag :value="evaluation.is_valid ? 'Valid' : 'Invalid'" :severity="evaluation.is_valid ? 'success' : 'danger'" />
            </div>
          </div>

          <div v-else class="upload-empty">
            No setup evaluations linked yet.
          </div>
        </div>

        <div>
          <div class="section-title">
            <div>
              <h2>Start screenshot</h2>
              <p>Saved when the trade was started.</p>
            </div>
          </div>
          <div class="screenshot-grid">
            <button
              type="button"
              class="shot-card"
              :class="{ 'shot-card--interactive': props.trade.screenshotUrl }"
              @click="openImagePreview(props.trade.screenshotUrl, props.trade.screenshotLabel)"
            >
              <template v-if="props.trade.screenshotUrl">
                <img :src="props.trade.screenshotUrl" :alt="props.trade.screenshotLabel" class="shot-image" />
              </template>
              <div class="shot-card-caption">
                <v-icon size="30" class="mb-2">mdi-chart-box-outline</v-icon>
                <div class="font-weight-bold">{{ props.trade.screenshotLabel }}</div>
              </div>
            </button>
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-label">Why I entered</div>
          <div class="detail-value font-weight-regular">{{ props.trade.whyEntered || 'No notes yet.' }}</div>
        </div>

        <div class="detail-item">
          <div class="detail-label">Notes</div>
          <div class="detail-value font-weight-regular">{{ props.trade.notes || 'No notes yet.' }}</div>
        </div>
      </div>
    </div>

    <div v-else class="panel">
      <h2>No active trade selected</h2>
      <p class="muted">Click an active trade to inspect it and close it when the position is done.</p>
    </div>
  </v-card>

  <ImagePreviewDialog
    v-model:visible="isImagePreviewOpen"
    :url="previewImageUrl"
    :title="previewImageTitle"
  />
</template>
