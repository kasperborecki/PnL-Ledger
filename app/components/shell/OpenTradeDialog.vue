<script setup lang="ts">
import ImagePreviewDialog from '~/components/ui/ImagePreviewDialog.vue'

const ledger = useLedger()
const startScreenshot = ref<File | null>(null)
const afterScreenshot = ref<File | null>(null)
const submitError = ref<string | null>(null)
const statusNote = ref<string | null>(null)
const isImagePreviewOpen = ref(false)
const previewImageUrl = ref<string | null>(null)
const previewImageTitle = ref('')

const tradeSymbolOptions = computed(() => ledger.symbolOptions.value.filter((option) => option.value !== 'All'))
const tradeSetupOptions = computed(() => ledger.setupOptions.value.filter((option) => option.value !== 'All'))
const tradeSessionOptions = computed(() => ledger.sessionOptions.filter((option) => option.value !== 'All'))
const tradeEmotionOptions = computed(() => ledger.emotionOptions.value.filter((option) => option.value !== 'All'))

const visible = computed({
  get: () => ledger.isOpenTradeDialogOpen.value,
  set: (value: boolean) => {
    ledger.isOpenTradeDialogOpen.value = value
  },
})

const mode = computed(() => ledger.openTradeDialogMode.value)
const isCloseMode = computed(() => mode.value === 'close')
const isEditMode = computed(() => mode.value === 'edit')
const startDraft = ledger.openTradeDraft
const closeDraft = ledger.closeTradeDraft
const selectedOpenTrade = computed(() => ledger.selectedOpenTrade.value)

const dialogTitle = computed(() => {
  if (isCloseMode.value) {
    return 'Close Trade'
  }

  return isEditMode.value ? 'Edit Active Trade' : 'Start Trade'
})
const dialogDescription = computed(() =>
  isCloseMode.value
    ? 'Finish the active position, add the result and move it into the main journal.'
    : isEditMode.value
      ? 'Update the active position details without closing it.'
      : 'Capture the setup with one screenshot and the core execution data before the trade is finished.',
)
const footerNote = computed(() =>
  isCloseMode.value
    ? 'The start screenshot is kept automatically. Add an after screenshot only if you want one, or paste it with Ctrl+V.'
    : isEditMode.value
      ? 'Leave the screenshot empty to keep the current one, or paste a new image with Ctrl+V to replace it.'
      : 'One start screenshot is required here so the setup is saved before the trade is finished. You can paste it with Ctrl+V.',
)
const dialogNote = computed(() => submitError.value || statusNote.value || footerNote.value)

const directionOptions = ['Long', 'Short']
const resultOptions = ['Win', 'Loss', 'BE']

watch(visible, (isOpen) => {
  if (!isOpen) {
    startScreenshot.value = null
    afterScreenshot.value = null
    submitError.value = null
    statusNote.value = null
    window.removeEventListener('paste', handlePasteEvent)
    return
  }

  window.addEventListener('paste', handlePasteEvent)
})

const startScreenshotSummary = computed(() => {
  const file = startScreenshot.value
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
  startScreenshot.value = null
  afterScreenshot.value = null
  submitError.value = null
  statusNote.value = null
  ledger.closeOpenTradeDialog()
}

function handleStartScreenshotChange(event: Event) {
  const input = event.target as HTMLInputElement
  startScreenshot.value = input.files?.[0] ?? null
  statusNote.value = null
  input.value = ''
}

function handleAfterScreenshotChange(event: Event) {
  const input = event.target as HTMLInputElement
  afterScreenshot.value = input.files?.[0] ?? null
  statusNote.value = null
  input.value = ''
}

function clearStartScreenshot() {
  startScreenshot.value = null
  statusNote.value = null
}

function clearAfterScreenshot() {
  afterScreenshot.value = null
  statusNote.value = null
}

function extractImageFromClipboard(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items?.length) {
    return null
  }

  for (const item of items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) {
      continue
    }

    const file = item.getAsFile()
    if (!file) {
      continue
    }

    const extension = file.type.split('/')[1] || 'png'
    return new File([file], `pasted-screenshot-${Date.now()}.${extension}`, {
      type: file.type,
      lastModified: Date.now(),
    })
  }

  return null
}

function handlePasteEvent(event: ClipboardEvent) {
  if (!visible.value) {
    return
  }

  const pastedImage = extractImageFromClipboard(event)
  if (!pastedImage) {
    return
  }

  event.preventDefault()
  submitError.value = null

  if (isCloseMode.value) {
    afterScreenshot.value = pastedImage
    statusNote.value = 'Pasted image attached to After trade.'
    return
  }

  startScreenshot.value = pastedImage
  statusNote.value = isEditMode.value
    ? 'Pasted image will replace the current Before trade screenshot.'
    : 'Pasted image attached to Before trade.'
}

function openImagePreview(url: string | null, title: string) {
  if (!url) {
    return
  }

  previewImageUrl.value = url
  previewImageTitle.value = title
  isImagePreviewOpen.value = true
}

function openLocalImagePreview(file: File | null, title: string) {
  if (!file) {
    return
  }

  if (previewImageUrl.value?.startsWith('blob:')) {
    URL.revokeObjectURL(previewImageUrl.value)
  }

  previewImageUrl.value = URL.createObjectURL(file)
  previewImageTitle.value = title
  isImagePreviewOpen.value = true
}

watch(isImagePreviewOpen, (isOpen) => {
  if (!isOpen && previewImageUrl.value?.startsWith('blob:')) {
    URL.revokeObjectURL(previewImageUrl.value)
    previewImageUrl.value = null
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('paste', handlePasteEvent)

  if (previewImageUrl.value?.startsWith('blob:')) {
    URL.revokeObjectURL(previewImageUrl.value)
  }
})

async function submit() {
  submitError.value = null

  try {
    if (isCloseMode.value) {
      await ledger.submitOpenTradeCloseDraft([
        { slot: 2, label: 'After trade', file: afterScreenshot.value },
      ])
      afterScreenshot.value = null
      return
    }

    await ledger.submitOpenTradeDraft({
      label: 'Before trade',
      file: startScreenshot.value,
    })
    startScreenshot.value = null
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : String(error)
    console.error('Failed to save open trade flow', error)
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
          <div class="trade-dialog-eyebrow">Active flow</div>
          <h2>{{ dialogTitle }}</h2>
          <p>{{ dialogDescription }}</p>
        </div>
      </div>
    </template>

    <form class="trade-form mt-4" @submit.prevent="submit">
      <div v-if="!isCloseMode" class="trade-form-grid">
        <section class="trade-form-section">
          <div class="trade-form-section-title">Trade info</div>
          <div v-if="isEditMode && selectedOpenTrade" class="import-trade-banner mb-4">
            <div class="import-trade-label">Editing now</div>
            <div class="import-trade-value">
              {{ selectedOpenTrade.symbol }} {{ selectedOpenTrade.direction }} - {{ selectedOpenTrade.setup }} - {{ selectedOpenTrade.date }} {{ selectedOpenTrade.time }}
            </div>
          </div>
          <div class="form-grid form-grid--2">
            <label class="field">
              <span>Date</span>
              <input v-model="startDraft.date" type="date" class="form-input" />
            </label>

            <label class="field">
              <span>Time</span>
              <input v-model="startDraft.time" type="time" class="form-input" />
            </label>

            <label class="field">
              <span>Symbol</span>
              <PDropdown
                v-model="startDraft.symbol"
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
                v-model="startDraft.setup"
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
                v-model="startDraft.session"
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
                v-model="startDraft.emotion"
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
          <div class="trade-form-section-title">Execution</div>
          <div class="form-grid form-grid--3">
            <label class="field">
              <span>Direction</span>
              <PSelectButton v-model="startDraft.direction" class="input-dark" :options="directionOptions" />
            </label>

            <label class="field">
              <span>Entry</span>
              <input v-model.number="startDraft.entry" type="number" step="0.00001" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Size</span>
              <input v-model.number="startDraft.size" type="number" step="0.01" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Stop loss</span>
              <input v-model.number="startDraft.stopLoss" type="number" step="0.00001" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Take profit</span>
              <input v-model.number="startDraft.takeProfit" type="number" step="0.00001" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Risk %</span>
              <input v-model.number="startDraft.riskPercent" type="number" step="0.01" class="form-input form-input--number" />
            </label>
          </div>
        </section>

        <section class="trade-form-section trade-form-section--full">
          <div class="trade-form-section-title">Start capture</div>
          <div class="form-grid form-grid--2">
            <label class="field">
              <span>Why I entered</span>
              <PTextarea v-model="startDraft.whyEntered" auto-resize rows="3" class="input-dark" />
            </label>

            <label class="field">
              <span>Notes</span>
              <PTextarea v-model="startDraft.notes" auto-resize rows="3" class="input-dark" />
            </label>

            <div class="field field--full">
              <span>Start screenshot</span>
              <label class="upload-dropzone upload-dropzone--stacked">
                <input
                  type="file"
                  accept="image/*"
                  class="upload-input"
                  @change="handleStartScreenshotChange"
                />
                <div class="upload-dropzone-copy">
                  <strong>Before trade</strong>
                  <span>{{ isEditMode ? 'Paste or upload a new image only if you want to replace the current setup screenshot.' : 'One image from the setup before entry.' }}</span>
                </div>
                <PTag :value="startScreenshot ? 'Selected' : isEditMode ? 'Keep current' : 'Required'" :severity="startScreenshot ? 'success' : isEditMode ? 'secondary' : 'warning'" />
              </label>

              <div v-if="isEditMode && selectedOpenTrade?.screenshotUrl" class="upload-list">
                <div class="upload-item upload-item--stacked">
                  <div>
                    <div class="upload-item-name">Current screenshot</div>
                    <div class="muted">{{ selectedOpenTrade.screenshotLabel }}</div>
                  </div>
                  <img
                    :src="selectedOpenTrade.screenshotUrl"
                    :alt="selectedOpenTrade.screenshotLabel"
                    class="open-trade-shot-preview"
                    @click="openImagePreview(selectedOpenTrade.screenshotUrl, selectedOpenTrade.screenshotLabel)"
                  />
                </div>
              </div>

              <div class="upload-list">
                <div class="upload-item">
                  <div>
                    <div class="upload-item-name">Before trade</div>
                    <div class="muted">
                      {{ startScreenshotSummary ? `${startScreenshotSummary.name} - ${startScreenshotSummary.sizeLabel}` : 'No file selected yet' }}
                    </div>
                  </div>
                  <div class="d-flex align-center ga-2">
                    <PButton
                      v-if="startScreenshot"
                      type="button"
                      icon="pi pi-search-plus"
                      severity="secondary"
                      class="input-dark upload-action-button"
                      @click="openLocalImagePreview(startScreenshot, 'Before trade')"
                    />
                    <PButton
                      v-if="startScreenshot"
                      type="button"
                      icon="pi pi-times"
                      severity="secondary"
                      class="input-dark upload-action-button upload-action-button--danger"
                      @click="clearStartScreenshot"
                    />
                    <PTag
                      :value="startScreenshotSummary ? 'Ready' : isEditMode ? 'Unchanged' : 'Missing'"
                      :severity="startScreenshotSummary ? 'success' : isEditMode ? 'secondary' : 'warning'"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div v-else class="trade-form-grid">
        <section class="trade-form-section">
          <div class="trade-form-section-title">Active trade</div>
          <div v-if="selectedOpenTrade" class="import-trade-banner">
            <div class="import-trade-label">Closing now</div>
            <div class="import-trade-value">
              {{ selectedOpenTrade.symbol }} {{ selectedOpenTrade.direction }} - {{ selectedOpenTrade.setup }} - {{ selectedOpenTrade.date }} {{ selectedOpenTrade.time }}
            </div>
          </div>

          <div class="form-grid form-grid--2 mt-4">
            <label class="field">
              <span>Date</span>
              <input v-model="closeDraft.date" type="date" class="form-input" />
            </label>

            <label class="field">
              <span>Time</span>
              <input v-model="closeDraft.time" type="time" class="form-input" />
            </label>

            <label class="field">
              <span>Symbol</span>
              <PDropdown
                v-model="closeDraft.symbol"
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
                v-model="closeDraft.setup"
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
                v-model="closeDraft.session"
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
                v-model="closeDraft.emotion"
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
          <div class="trade-form-section-title">Result & management</div>
          <div class="form-grid form-grid--3">
            <label class="field">
              <span>Direction</span>
              <PSelectButton v-model="closeDraft.direction" class="input-dark" :options="directionOptions" />
            </label>

            <label class="field">
              <span>Result</span>
              <PSelectButton v-model="closeDraft.result" class="input-dark" :options="resultOptions" />
            </label>

            <label class="field">
              <span>Size</span>
              <input v-model.number="closeDraft.size" type="number" step="0.01" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Entry</span>
              <input v-model.number="closeDraft.entry" type="number" step="0.00001" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Exit</span>
              <input v-model.number="closeDraft.exit" type="number" step="0.00001" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Stop loss</span>
              <input v-model.number="closeDraft.stopLoss" type="number" step="0.00001" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Take profit</span>
              <input v-model.number="closeDraft.takeProfit" type="number" step="0.00001" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>R:R</span>
              <input v-model.number="closeDraft.rr" type="number" step="0.01" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Risk %</span>
              <input v-model.number="closeDraft.riskPercent" type="number" step="0.01" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Hold minutes</span>
              <input v-model.number="closeDraft.holdMinutes" type="number" step="1" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Commission</span>
              <input v-model.number="closeDraft.commission" type="number" step="0.01" class="form-input form-input--number" />
            </label>

            <label class="field">
              <span>Net P&amp;L</span>
              <input v-model.number="closeDraft.netPnl" type="number" step="0.01" class="form-input form-input--number" />
            </label>
          </div>
        </section>

        <section class="trade-form-section trade-form-section--full">
          <div class="trade-form-section-title">Review</div>
          <div class="form-grid form-grid--2">
            <label class="field">
              <span>Why I entered</span>
              <PTextarea v-model="closeDraft.whyEntered" auto-resize rows="3" class="input-dark" />
            </label>

            <label class="field">
              <span>What went well</span>
              <PTextarea v-model="closeDraft.whatWentWell" auto-resize rows="3" class="input-dark" />
            </label>

            <label class="field">
              <span>What to improve</span>
              <PTextarea v-model="closeDraft.whatToImprove" auto-resize rows="3" class="input-dark" />
            </label>

            <label class="field">
              <span>Notes</span>
              <PTextarea v-model="closeDraft.notes" auto-resize rows="3" class="input-dark" />
            </label>

            <label class="field field--full">
              <span>Tags</span>
              <PInputText
                v-model="closeDraft.tags"
                class="input-dark"
                placeholder="Momentum, Plan, Patience"
              />
            </label>

            <div class="field field--full">
              <span>Screenshots</span>
              <div class="trade-screenshot-grid">
                <div class="upload-item upload-item--stacked">
                  <div>
                    <div class="upload-item-name">Before trade</div>
                    <div class="muted">Attached from the active trade start.</div>
                  </div>
                  <img
                    v-if="selectedOpenTrade?.screenshotUrl"
                    :src="selectedOpenTrade.screenshotUrl"
                    alt="Before trade"
                    class="open-trade-shot-preview"
                    @click="openImagePreview(selectedOpenTrade?.screenshotUrl ?? null, selectedOpenTrade?.screenshotLabel ?? 'Before trade')"
                  />
                  <PTag :value="selectedOpenTrade?.screenshotUrl ? 'Attached' : 'Missing'" :severity="selectedOpenTrade?.screenshotUrl ? 'success' : 'warning'" />
                </div>

                <label class="upload-dropzone upload-dropzone--stacked">
                  <input
                    type="file"
                    accept="image/*"
                    class="upload-input"
                    @change="handleAfterScreenshotChange"
                  />
                  <div class="upload-dropzone-copy">
                    <strong>After trade</strong>
                    <span>Optional image after exit or final management.</span>
                  </div>
                  <PTag :value="afterScreenshot ? 'Selected' : 'Optional'" :severity="afterScreenshot ? 'success' : 'secondary'" />
                </label>
              </div>

              <div class="upload-list">
                <div class="upload-item">
                  <div>
                    <div class="upload-item-name">After trade</div>
                    <div class="muted">
                      {{ afterScreenshotSummary ? `${afterScreenshotSummary.name} - ${afterScreenshotSummary.sizeLabel}` : 'No file selected' }}
                    </div>
                  </div>
                  <div class="d-flex align-center ga-2">
                    <PButton
                      v-if="afterScreenshot"
                      type="button"
                      icon="pi pi-search-plus"
                      severity="secondary"
                      class="input-dark upload-action-button"
                      @click="openLocalImagePreview(afterScreenshot, 'After trade')"
                    />
                    <PButton
                      v-if="afterScreenshot"
                      type="button"
                      icon="pi pi-times"
                      severity="secondary"
                      class="input-dark upload-action-button upload-action-button--danger"
                      @click="clearAfterScreenshot"
                    />
                    <PTag :value="afterScreenshotSummary ? 'Ready' : 'Empty'" :severity="afterScreenshotSummary ? 'success' : 'secondary'" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="trade-dialog-footer">
        <div class="trade-dialog-footer-note" :class="{ negative: submitError }">
          {{ dialogNote }}
        </div>
        <div class="trade-dialog-actions">
          <PButton type="button" label="Cancel" severity="secondary" text class="input-dark action-cancel" @click="closeDialog" />
          <PButton
            type="submit"
            :label="isCloseMode ? 'Close trade' : isEditMode ? 'Save changes' : 'Start trade'"
            icon="pi pi-check"
            severity="success"
            class="input-dark action-primary"
          />
        </div>
      </div>
    </form>
  </PDialog>

  <ImagePreviewDialog
    v-model:visible="isImagePreviewOpen"
    :url="previewImageUrl"
    :title="previewImageTitle"
  />
</template>
