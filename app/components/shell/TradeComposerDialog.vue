<script setup lang="ts">
const ledger = useLedger()
const beforeScreenshot = ref<File | null>(null)
const afterScreenshot = ref<File | null>(null)
const submitError = ref<string | null>(null)

const tradeSymbolOptions = computed(() => ledger.symbolOptions.value.filter((option) => option.value !== 'All'))
const tradeSetupOptions = computed(() => ledger.setupOptions.value.filter((option) => option.value !== 'All'))
const tradeSessionOptions = computed(() => ledger.sessionOptions.filter((option) => option.value !== 'All'))
const tradeEmotionOptions = computed(() => ledger.emotionOptions.value.filter((option) => option.value !== 'All'))

const visible = computed({
  get: () => ledger.isTradeDialogOpen.value,
  set: (value: boolean) => {
    ledger.isTradeDialogOpen.value = value
  },
})

const draft = ledger.newTradeDraft
const isEditingTrade = computed(() => Boolean(ledger.editingTradeId.value))
const dialogTitle = computed(() => (isEditingTrade.value ? 'Edit Trade' : 'New Trade'))
const footerNote = computed(() =>
  isEditingTrade.value
    ? 'Leave a screenshot slot empty to keep the current image. Upload a new file to replace it.'
    : '',
)

const directionOptions = ['Long', 'Short']
const resultOptions = ['Win', 'Loss', 'BE']

watch(visible, (isOpen) => {
  if (!isOpen) {
    beforeScreenshot.value = null
    afterScreenshot.value = null
    submitError.value = null
  }
})

const beforeScreenshotSummary = computed(() => {
  const file = beforeScreenshot.value
  return file
    ? {
        name: file.name,
        sizeLabel: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      }
    : null
})

const afterScreenshotSummary = computed(() => {
  const file = afterScreenshot.value
  return file
    ? {
        name: file.name,
        sizeLabel: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      }
    : null
})

function closeDialog() {
  beforeScreenshot.value = null
  afterScreenshot.value = null
  submitError.value = null
  ledger.closeTradeDialog()
}

function handleBeforeScreenshotChange(event: Event) {
  const input = event.target as HTMLInputElement
  beforeScreenshot.value = input.files?.[0] ?? null
  input.value = ''
}

function handleAfterScreenshotChange(event: Event) {
  const input = event.target as HTMLInputElement
  afterScreenshot.value = input.files?.[0] ?? null
  input.value = ''
}

async function submit() {
  submitError.value = null
  try {
    await ledger.submitTradeDraft([
      { slot: 1, label: 'Before trade', file: beforeScreenshot.value },
      { slot: 2, label: 'After trade', file: afterScreenshot.value },
    ])
    beforeScreenshot.value = null
    afterScreenshot.value = null
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to save trade draft', error)
  }
}
</script>

<template>
  <PDialog
    v-model:visible="visible"
    modal
    dismissable-mask
    :draggable="false"
    class="trade-dialog"
    :style="{ width: 'min(1180px, calc(100vw - 32px))' }"
    :breakpoints="{ '960px': '96vw', '640px': '100vw' }"
  >
    <template #header>
      <div class="trade-dialog-header">
        <div>
          <div class="trade-dialog-eyebrow">Quick capture</div>
          <h2>{{ dialogTitle }}</h2>
          <p>
            {{ isEditingTrade ? 'Update the existing trade and keep the journal in sync.' : 'Log the trade, save it to Supabase and complete the review in one flow.' }}
          </p>
        </div>
      </div>
    </template>

    <form class="trade-form mt-4" @submit.prevent="submit">
      <div class="trade-form-grid">
        <section class="trade-form-section">
          <div class="trade-form-section-title">Trade info</div>
          <div class="form-grid form-grid--2">
            <label class="field">
              <span>Date</span>
              <input v-model="draft.date" type="date" class="form-input" />
            </label>

            <label class="field">
              <span>Time</span>
              <input v-model="draft.time" type="time" class="form-input" />
            </label>

            <label class="field">
              <span>Symbol</span>
              <PDropdown
                v-model="draft.symbol"
                :options="tradeSymbolOptions"
                option-label="label"
                option-value="value"
                class="input-dark"
                placeholder="Select symbol"
              />
            </label>

            <label class="field">
              <span>Setup</span>
              <PDropdown
                v-model="draft.setup"
                :options="tradeSetupOptions"
                option-label="label"
                option-value="value"
                class="input-dark"
                placeholder="Select setup"
              />
            </label>

            <label class="field">
              <span>Session</span>
              <PDropdown
                v-model="draft.session"
                :options="tradeSessionOptions"
                option-label="label"
                option-value="value"
                class="input-dark"
                placeholder="Select session"
              />
            </label>

            <label class="field">
              <span>Emotion</span>
              <PDropdown
                v-model="draft.emotion"
                :options="tradeEmotionOptions"
                option-label="label"
                option-value="value"
                class="input-dark"
                placeholder="Select emotion"
              />
            </label>
          </div>
        </section>

        <section class="trade-form-section">
          <div class="trade-form-section-title">Risk & result</div>
          <div class="form-grid form-grid--3">
            <label class="field">
              <span>Direction</span>
              <PSelectButton v-model="draft.direction" class="input-dark" :options="directionOptions" />
            </label>

            <label class="field">
              <span>Result</span>
              <PSelectButton v-model="draft.result" class="input-dark" :options="resultOptions" />
            </label>

            <label class="field">
              <span>Size</span>
              <input v-model.number="draft.size" type="number" step="0.01" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Entry</span>
              <input v-model.number="draft.entry" type="number" step="0.00001" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Exit</span>
              <input v-model.number="draft.exit" type="number" step="0.00001" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Stop loss</span>
              <input v-model.number="draft.stopLoss" type="number" step="0.00001" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Take profit</span>
              <input v-model.number="draft.takeProfit" type="number" step="0.00001" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>R:R</span>
              <input v-model.number="draft.rr" type="number" step="0.01" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Risk %</span>
              <input v-model.number="draft.riskPercent" type="number" step="0.01" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Hold minutes</span>
              <input v-model.number="draft.holdMinutes" type="number" step="1" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Commission</span>
              <input v-model.number="draft.commission" type="number" step="0.01" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Net P&L</span>
              <input v-model.number="draft.netPnl" type="number" step="0.01" class="form-input form-input--number" />
            </label>
          </div>
        </section>

        <section class="trade-form-section trade-form-section--full">
          <div class="trade-form-section-title">Review</div>
          <div class="form-grid form-grid--2">
            <label class="field">
              <span>Why I entered</span>
              <PTextarea v-model="draft.whyEntered" auto-resize rows="3" class="input-dark" />
            </label>

            <label class="field">
              <span>What went well</span>
              <PTextarea v-model="draft.whatWentWell" auto-resize rows="3" class="input-dark" />
            </label>

            <label class="field">
              <span>What to improve</span>
              <PTextarea v-model="draft.whatToImprove" auto-resize rows="3" class="input-dark" />
            </label>

            <label class="field">
              <span>Notes</span>
              <PTextarea v-model="draft.notes" auto-resize rows="3" class="input-dark" />
            </label>

            <label class="field field--full">
              <span>Tags</span>
              <PInputText
                v-model="draft.tags"
                class="input-dark"
                placeholder="Momentum, Plan, Patience"
              />
            </label>

            <div class="field field--full">
              <span>Chart screenshots</span>
              <div class="trade-screenshot-grid">
                <label class="upload-dropzone upload-dropzone--stacked">
                  <input
                    type="file"
                    accept="image/*"
                    class="upload-input"
                    @change="handleBeforeScreenshotChange"
                  />
                  <div class="upload-dropzone-copy">
                    <strong>Before trade</strong>
                    <span>One image from the setup before entry.</span>
                  </div>
                  <PTag :value="beforeScreenshot ? 'Selected' : 'Empty'" :severity="beforeScreenshot ? 'success' : 'secondary'" />
                </label>

                <label class="upload-dropzone upload-dropzone--stacked">
                  <input
                    type="file"
                    accept="image/*"
                    class="upload-input"
                    @change="handleAfterScreenshotChange"
                  />
                  <div class="upload-dropzone-copy">
                    <strong>After trade</strong>
                    <span>One image after exit or final management.</span>
                  </div>
                  <PTag :value="afterScreenshot ? 'Selected' : 'Empty'" :severity="afterScreenshot ? 'success' : 'secondary'" />
                </label>
              </div>

              <div class="upload-list">
                <div class="upload-item">
                  <div>
                    <div class="upload-item-name">Before trade</div>
                    <div class="muted">
                      {{ beforeScreenshotSummary ? `${beforeScreenshotSummary.name} - ${beforeScreenshotSummary.sizeLabel}` : 'No file selected' }}
                    </div>
                  </div>
                  <PTag :value="beforeScreenshotSummary ? 'Ready' : 'Empty'" :severity="beforeScreenshotSummary ? 'success' : 'secondary'" />
                </div>

                <div class="upload-item">
                  <div>
                    <div class="upload-item-name">After trade</div>
                    <div class="muted">
                      {{ afterScreenshotSummary ? `${afterScreenshotSummary.name} - ${afterScreenshotSummary.sizeLabel}` : 'No file selected' }}
                    </div>
                  </div>
                  <PTag :value="afterScreenshotSummary ? 'Ready' : 'Empty'" :severity="afterScreenshotSummary ? 'success' : 'secondary'" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="trade-dialog-footer">
        <div class="trade-dialog-footer-note" :class="{ negative: submitError }">
          {{ submitError || footerNote }}
        </div>
        <div class="trade-dialog-actions">
          <PButton type="button" label="Cancel" severity="secondary" text class="input-dark action-cancel" @click="closeDialog" />
          <PButton
            type="submit"
            :label="isEditingTrade ? 'Update trade' : 'Save trade'"
            icon="pi pi-check"
            severity="success"
            class="input-dark action-primary"
          />
        </div>
      </div>
    </form>
  </PDialog>
</template>
