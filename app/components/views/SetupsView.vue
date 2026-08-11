<script setup lang="ts">
import SectionCard from '~/components/ui/SectionCard.vue'
import type { BuilderCriterion, BuilderSection, EvaluationAnswer, EvaluationAnswerRecord, EvaluationRecord, SetupSummary } from '~/composables/useTradingSetups'

const setupEngine = useTradingSetups()
const ledger = useLedger()
const route = useRoute()

const tab = ref<'library' | 'builder' | 'grade'>('library')
const detailTab = ref<'overview' | 'criteria' | 'grades' | 'performance' | 'versions'>('overview')
const selectedTemplate = ref('')
const draggedSectionUid = ref('')
const draggedCriterionUid = ref('')
const draggedCriterionSectionUid = ref('')
const evaluationActionError = ref('')
const isEvaluationPreviewOpen = ref(false)
const previewEvaluationId = ref('')

const visibleSetups = computed(() => setupEngine.setupSummaries.value.filter((setup) => !setup.isArchived))
const archivedSetups = computed(() => setupEngine.setupSummaries.value.filter((setup) => setup.isArchived))
const activeDetail = computed(() => setupEngine.activeDetail.value)
const activeEvaluations = computed(() =>
  activeDetail.value
    ? setupEngine.evaluations.value
      .filter((evaluation) => evaluation.setup_id === activeDetail.value?.setup.id)
      .sort((left, right) => String(right.graded_at).localeCompare(String(left.graded_at)))
    : [],
)
const evaluationResult = computed(() => setupEngine.evaluationResult.value)
const builderScore = computed(() => setupEngine.builderMaxScore.value)
const builderCriteriaCount = computed(() => setupEngine.builderCriteriaCount.value)
const setupOptions = computed(() => visibleSetups.value.map((setup) => ({ label: setup.name, value: setup.id })))
const activeSummary = computed(() => setupEngine.setupSummaries.value.find((setup) => setup.id === activeDetail.value?.setup.id) ?? null)
const previewEvaluation = computed(() =>
  setupEngine.evaluations.value.find((evaluation) => evaluation.id === previewEvaluationId.value) ?? null,
)
const previewEvaluationDetail = computed(() =>
  previewEvaluation.value ? setupEngine.detailById.value[previewEvaluation.value.setup_id] ?? null : null,
)
const previewEvaluationAnswers = computed(() =>
  previewEvaluationId.value ? setupEngine.evaluationAnswersById.value[previewEvaluationId.value] ?? [] : [],
)
const valueTypeOptions = [
  { label: 'Percentage', value: 'percentage' },
  { label: 'Score', value: 'score' },
]
const operatorOptions = ['>=', '>', '<=', '<', '='].map((value) => ({ label: value, value }))
const yesNoOptions = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
]
const detailTabs = [
  { label: 'Overview', value: 'overview' },
  { label: 'Criteria', value: 'criteria' },
  { label: 'Grades', value: 'grades' },
  { label: 'Performance', value: 'performance' },
  { label: 'Versions', value: 'versions' },
] as const

function openBuilder() {
  setupEngine.newDraft()
  selectedTemplate.value = ''
  tab.value = 'builder'
}

function useTemplate() {
  setupEngine.draftFromTemplate(selectedTemplate.value)
  tab.value = 'builder'
}

async function editSetup(setup: SetupSummary) {
  await setupEngine.editDraft(setup.id)
  tab.value = 'builder'
}

async function duplicateSetup(setup: SetupSummary) {
  await setupEngine.duplicateDraft(setup.id)
  tab.value = 'builder'
}

async function viewSetup(setup: SetupSummary) {
  await setupEngine.loadSetupDetail(setup.id)
  detailTab.value = 'overview'
  tab.value = 'library'
}

async function gradeSetup(setup: SetupSummary) {
  await setupEngine.loadSetupDetail(setup.id)
  tab.value = 'grade'
}

function gradeActiveDetail() {
  tab.value = 'grade'
}

function startEvaluationFromSelection() {
  setupEngine.startEvaluation(setupEngine.selectedSetupId.value)
}

function setupName(setupId: string) {
  return setupEngine.setupSummaries.value.find((setup) => setup.id === setupId)?.name ?? 'Setup'
}

async function saveEvaluation() {
  evaluationActionError.value = ''

  try {
    await setupEngine.saveEvaluation()
  } catch (caught) {
    evaluationActionError.value = caught instanceof Error ? caught.message : String(caught)
  }
}

async function editSavedEvaluation(evaluationId: string) {
  evaluationActionError.value = ''

  try {
    await setupEngine.editEvaluationDraft(evaluationId)
    tab.value = 'grade'
  } catch (caught) {
    evaluationActionError.value = caught instanceof Error ? caught.message : String(caught)
  }
}

async function deleteSavedEvaluation(evaluationId: string) {
  evaluationActionError.value = ''

  try {
    await setupEngine.deleteEvaluation(evaluationId)
  } catch (caught) {
    evaluationActionError.value = caught instanceof Error ? caught.message : String(caught)
  }
}

function openEvaluationPreview(evaluationId: string) {
  previewEvaluationId.value = evaluationId
  isEvaluationPreviewOpen.value = true
}

function answerForCriterion(criterion: BuilderCriterion) {
  return previewEvaluationAnswers.value.find((answer) => answer.criterion_id === criterion.id) ?? null
}

function selectedOptionIds(answer: EvaluationAnswerRecord | null) {
  if (!answer?.selected_options) {
    return []
  }

  return Array.isArray(answer.selected_options) ? answer.selected_options : []
}

function answerValueLabel(criterion: BuilderCriterion, answer: EvaluationAnswerRecord | null) {
  if (!answer) {
    return '-'
  }

  if (answer.boolean_value != null) {
    return answer.boolean_value ? 'Yes' : 'No'
  }

  if (answer.selected_option_id) {
    return criterion.options.find((option) => option.id === answer.selected_option_id)?.label ?? 'Selected option'
  }

  const multiSelected = selectedOptionIds(answer)
  if (multiSelected.length) {
    const labels = multiSelected.map((optionId) => criterion.options.find((option) => option.id === optionId)?.label ?? optionId)
    return labels.join(', ')
  }

  if (answer.numeric_value != null) {
    return String(Number(answer.numeric_value))
  }

  if (answer.text_value?.trim()) {
    return answer.text_value
  }

  return '-'
}

async function saveBuilder() {
  await setupEngine.saveDraft()
  detailTab.value = 'overview'
  tab.value = 'library'
}

function confirmDelete(setup: SetupSummary) {
  if (window.confirm(`Delete setup "${setup.name}" and all of its versions?`)) {
    void setupEngine.deleteSetup(setup.id)
  }
}

function startSectionDrag(section: BuilderSection) {
  draggedSectionUid.value = section.uid
}

function dropSection(section: BuilderSection) {
  setupEngine.moveSection(draggedSectionUid.value, section.uid)
  draggedSectionUid.value = ''
}

function startCriterionDrag(section: BuilderSection, criterion: BuilderCriterion) {
  draggedCriterionSectionUid.value = section.uid
  draggedCriterionUid.value = criterion.uid
}

function dropCriterion(section: BuilderSection, criterion: BuilderCriterion) {
  if (draggedCriterionSectionUid.value !== section.uid) {
    return
  }
  setupEngine.moveCriterion(section.uid, draggedCriterionUid.value, criterion.uid)
  draggedCriterionUid.value = ''
  draggedCriterionSectionUid.value = ''
}

function getAnswer(criterion: BuilderCriterion): EvaluationAnswer {
  const key = criterion.id ?? criterion.uid
  const existing = setupEngine.evaluationDraft.value.answers[key]
  if (existing) return existing

  const next: EvaluationAnswer = {
    selectedOptionIds: [],
    textValue: '',
    comment: '',
  }
  setupEngine.evaluationDraft.value.answers[key] = next
  return next
}

function toggleAnswerOption(criterion: BuilderCriterion, optionId: string, checked: boolean) {
  const answer = getAnswer(criterion)
  const selected = new Set(answer.selectedOptionIds ?? [])
  if (checked) selected.add(optionId)
  else selected.delete(optionId)
  answer.selectedOptionIds = [...selected]
}

function handleAnswerOptionChange(criterion: BuilderCriterion, optionId: string, event: Event) {
  toggleAnswerOption(criterion, optionId, (event.target as HTMLInputElement | null)?.checked === true)
}

function onCriterionTypeChange(criterion: BuilderCriterion) {
  if (criterion.criterionType === 'text') {
    criterion.maxPoints = 0
    criterion.options = []
  }

  if (criterion.criterionType === 'required_gate') {
    criterion.isRequired = true
    criterion.maxPoints = 0
    criterion.config = { yesPoints: 0, noPoints: 0 }
    criterion.options = []
  }

  if (criterion.criterionType === 'optional_bonus') {
    criterion.isBonus = true
    criterion.maxPoints = Math.max(criterion.maxPoints, 5)
    criterion.config = { yesPoints: criterion.maxPoints, noPoints: 0 }
    criterion.options = []
  }

  if ((criterion.criterionType === 'single_select' || criterion.criterionType === 'multi_select' || criterion.criterionType === 'checklist') && !criterion.options.length) {
    setupEngine.addCriterionOption(criterion)
  }
}

function formatPercent(value: number | null) {
  return value == null ? '-' : `${Number(value).toFixed(1)}%`
}

function tradeLabel(evaluation: EvaluationRecord) {
  if (evaluation.open_trade_id) {
    const openTrade = ledger.openTrades.value.find((item) => item.id === evaluation.open_trade_id)
    return openTrade ? `${openTrade.symbol} ${openTrade.direction} - ${openTrade.date}` : 'Active trade'
  }

  if (!evaluation.trade_id) {
    return evaluation.evaluation_type === 'pre_trade' ? 'Pre-trade grade' : 'No linked trade'
  }

  const trade = ledger.trades.value.find((item) => item.id === evaluation.trade_id)
  return trade ? `${trade.symbol} ${trade.direction} - ${trade.date}` : 'Linked trade'
}

function formatEvaluationDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function gradeSeverity(grade: string) {
  if (grade === 'A+' || grade === 'A') return 'success'
  if (grade === 'D') return 'danger'
  return 'secondary'
}

function applyRouteContext() {
  const tradeId = typeof route.query.trade === 'string' ? route.query.trade : ''
  const openTradeId = typeof route.query.openTrade === 'string' ? route.query.openTrade : ''
  if (!tradeId && !openTradeId) {
    return false
  }

  tab.value = 'grade'
  return true
}

onMounted(applyRouteContext)
watch(() => [route.query.trade, route.query.openTrade], applyRouteContext)
</script>

<template>
  <div class="page-stack">
    <SectionCard
      title="Setups"
      subtitle="Setup library and simple pair grades."
    >
      <template #action>
        <div class="setup-actions">
          <PButton
            type="button"
            label="New"
            icon="pi pi-plus"
            severity="success"
            class="action-primary"
            @click="openBuilder"
          />
          <PDropdown
            v-model="selectedTemplate"
            :options="setupEngine.templates.value"
            option-label="label"
            option-value="value"
            class="input-dark setup-template-select"
            placeholder="Template"
          />
          <PButton
            type="button"
            icon="pi pi-copy"
            class="action-neutral"
            :disabled="!selectedTemplate"
            :title="'Create from selected template'"
            @click="useTemplate"
          />
        </div>
      </template>

      <div class="setup-tabs">
        <button type="button" :class="{ 'is-active': tab === 'library' }" @click="tab = 'library'">Setups</button>
        <button type="button" :class="{ 'is-active': tab === 'builder' }" @click="tab = 'builder'">Builder</button>
        <button type="button" :class="{ 'is-active': tab === 'grade' }" @click="tab = 'grade'">Pair Grades</button>
      </div>

      <div v-if="setupEngine.loadError.value" class="sync-banner">
        Setup engine error: {{ setupEngine.loadError.value }}
      </div>
    </SectionCard>

    <section v-if="tab === 'library'" class="setup-workspace">
      <div class="setup-library-column">
        <div class="setup-library">
          <button
            v-for="setup in visibleSetups"
            :key="setup.id"
            type="button"
            class="setup-card"
            :class="{ 'is-selected': setupEngine.selectedSetupId.value === setup.id }"
            @click="viewSetup(setup)"
          >
            <div class="setup-card-head">
              <div>
                <div class="setup-title-row">
                  <strong>{{ setup.name }}</strong>
                  <v-icon v-if="setup.isFavorite" size="18" color="amber">mdi-star</v-icon>
                </div>
                <div class="muted">{{ setup.category || 'Uncategorized' }}</div>
              </div>
              <PTag :value="setup.isActive ? 'Active' : 'Inactive'" :severity="setup.isActive ? 'success' : 'secondary'" />
            </div>

            <div class="setup-metric-grid">
              <div>
                <span>Criteria</span>
                <strong>{{ setup.criteriaCount }}</strong>
              </div>
              <div>
                <span>Sections</span>
                <strong>{{ setup.sectionsCount }}</strong>
              </div>
              <div>
                <span>Max</span>
                <strong>{{ setup.maxScore }}</strong>
              </div>
              <div>
                <span>Version</span>
                <strong>v{{ setup.versionNumber }}</strong>
              </div>
            </div>

            <div class="setup-card-line">
              <span v-if="setup.topGradeLabel">{{ setup.topGradeLabel }} >= {{ setup.topGradeMin }}%</span>
              <span v-else>No grades</span>
              <span>{{ setup.tradesGraded }} graded</span>
            </div>

            <div class="setup-card-line">
              <span>Avg score {{ formatPercent(setup.avgScore) }}</span>
              <span>{{ setup.plannedTrades }} pre-trade grades</span>
            </div>

            <div class="setup-card-actions" @click.stop>
              <PButton type="button" label="Grade" icon="pi pi-check-circle" class="action-primary" @click="gradeSetup(setup)" />
              <PButton type="button" icon="pi pi-pencil" class="action-neutral setup-icon-btn" :title="'Edit'" @click="editSetup(setup)" />
              <PButton type="button" icon="pi pi-copy" class="action-neutral setup-icon-btn" :title="'Duplicate'" @click="duplicateSetup(setup)" />
              <PButton
                type="button"
                :icon="setup.isFavorite ? 'pi pi-star-fill' : 'pi pi-star'"
                class="action-neutral setup-icon-btn"
                :title="'Favorite'"
                @click="setupEngine.updateSetupState(setup.id, { is_favorite: !setup.isFavorite })"
              />
              <PButton
                type="button"
                icon="pi pi-folder"
                class="action-neutral setup-icon-btn"
                :title="'Archive'"
                @click="setupEngine.updateSetupState(setup.id, { is_archived: true })"
              />
              <PButton type="button" icon="pi pi-trash" class="action-danger setup-icon-btn" :title="'Delete'" @click="confirmDelete(setup)" />
            </div>
          </button>

          <div v-if="!visibleSetups.length" class="setup-empty">
            <strong>No custom setups yet.</strong>
            <span>Create one from scratch or start from a template.</span>
          </div>
        </div>

        <SectionCard
          v-if="archivedSetups.length"
          title="Archived"
          subtitle="Hidden from the active setup library."
          :padded="false"
        >
          <div class="setup-archive-list">
            <div v-for="setup in archivedSetups" :key="setup.id" class="setup-archive-row">
              <span>{{ setup.name }}</span>
              <PButton
                type="button"
                label="Restore"
                icon="pi pi-undo"
                class="action-neutral"
                @click="setupEngine.updateSetupState(setup.id, { is_archived: false })"
              />
            </div>
          </div>
        </SectionCard>
      </div>

      <aside class="setup-detail-panel">
        <template v-if="activeDetail">
          <div class="setup-detail-head">
            <div>
              <div class="setup-detail-kicker">Selected Setup</div>
              <h2>{{ activeDetail.setup.name }}</h2>
              <p>{{ activeDetail.setup.description || 'No description yet.' }}</p>
            </div>
            <div class="setup-actions">
              <PButton type="button" label="Grade" icon="pi pi-check-circle" class="action-primary" @click="gradeActiveDetail" />
              <PButton v-if="activeSummary" type="button" icon="pi pi-pencil" class="action-neutral setup-icon-btn" :title="'Edit'" @click="editSetup(activeSummary)" />
            </div>
          </div>

          <div class="setup-inner-tabs">
            <button
              v-for="item in detailTabs"
              :key="item.value"
              type="button"
              :class="{ 'is-active': detailTab === item.value }"
              @click="detailTab = item.value"
            >
              {{ item.label }}
            </button>
          </div>

          <div v-if="detailTab === 'overview'" class="setup-detail-body">
            <div class="setup-detail-stats">
              <div><span>Current version</span><strong>v{{ activeDetail.version.version_number }}</strong></div>
              <div><span>Criteria</span><strong>{{ activeDetail.sections.reduce((sum, section) => sum + section.criteria.length, 0) }}</strong></div>
              <div><span>Max score</span><strong>{{ setupEngine.calculateMaxScore(activeDetail.sections) }}</strong></div>
              <div><span>Required gates</span><strong>{{ activeDetail.sections.flatMap((section) => section.criteria).filter((criterion) => criterion.criterionType === 'required_gate' || criterion.isRequired).length }}</strong></div>
            </div>
          </div>

          <div v-else-if="detailTab === 'criteria'" class="setup-detail-body">
            <div class="setup-preview-list">
              <div v-for="section in activeDetail.sections" :key="section.id" class="setup-preview-section">
                <strong>{{ section.name }}</strong>
                <div v-for="criterion in section.criteria" :key="criterion.id" class="setup-preview-criterion">
                  <span>{{ criterion.name }}</span>
                  <small>{{ criterion.criterionType.replaceAll('_', ' ') }} - {{ criterion.maxPoints }} pts</small>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="detailTab === 'grades'" class="setup-detail-body">
            <div class="setup-grade-readonly">
              <div v-for="threshold in activeDetail.thresholds" :key="threshold.id" class="setup-choice-row">
                <span>{{ threshold.label }}</span>
                <strong>{{ threshold.minValue }} - {{ threshold.maxValue }} {{ threshold.valueType === 'percentage' ? '%' : 'pts' }}</strong>
              </div>
              <div v-if="!activeDetail.thresholds.length" class="muted">This setup does not use grade labels.</div>
            </div>
          </div>

          <div v-else-if="detailTab === 'performance'" class="setup-detail-body">
            <div class="setup-evaluation-history">
              <div v-for="evaluation in activeEvaluations" :key="evaluation.id" class="setup-evaluation-history-row">
                <div>
                  <strong>{{ tradeLabel(evaluation) }}</strong>
                  <span>{{ formatEvaluationDate(evaluation.graded_at) }} - {{ evaluation.evaluation_type.replaceAll('_', ' ') }}</span>
                </div>
                <div class="setup-evaluation-history-score">
                  <strong>{{ Number(evaluation.raw_score).toFixed(1) }} / {{ Number(evaluation.max_score).toFixed(1) }}</strong>
                  <span>{{ Number(evaluation.normalized_percentage).toFixed(1) }}% - {{ evaluation.grade_label || 'No grade' }}</span>
                </div>
                <PTag :value="evaluation.is_valid ? 'Valid' : 'Invalid'" :severity="evaluation.is_valid ? 'success' : 'danger'" />
                <PButton type="button" icon="pi pi-eye" class="action-neutral setup-icon-btn" :title="'View evaluation'" @click="openEvaluationPreview(evaluation.id)" />
              </div>
              <div v-if="!activeEvaluations.length" class="setup-empty setup-empty--compact">
                <strong>No saved evaluations yet</strong>
                <span>Saved setup evaluations will appear here.</span>
              </div>
            </div>
          </div>

          <div v-else class="setup-detail-body">
            <div class="setup-choice-row">
              <span>Current</span>
              <strong>v{{ activeDetail.version.version_number }}</strong>
            </div>
            <div class="muted">Every builder save creates a new scoring version, so historical trade grades keep pointing to the original version.</div>
          </div>
        </template>

        <div v-else class="setup-empty setup-empty--compact">
          <strong>Select a setup</strong>
          <span>Details, criteria, grades and versions will appear here.</span>
        </div>
      </aside>
    </section>

    <section v-else-if="tab === 'builder'" class="setup-builder-layout">
      <div class="setup-builder-main">
        <SectionCard title="Setup Information" subtitle="Name, category, tags and availability.">
          <div class="form-grid form-grid--2">
            <label class="field">
              <span>Name</span>
              <PInputText v-model="setupEngine.builderDraft.value.name" class="input-dark" placeholder="FXAlexG HTF Pullback" />
            </label>
            <label class="field">
              <span>Category</span>
              <PInputText v-model="setupEngine.builderDraft.value.category" class="input-dark" placeholder="Price Action" />
            </label>
            <label class="field field--full">
              <span>Description</span>
              <PTextarea v-model="setupEngine.builderDraft.value.description" auto-resize rows="3" class="input-dark" />
            </label>
            <label class="field">
              <span>Tags</span>
              <PInputText v-model="setupEngine.builderDraft.value.tagsText" class="input-dark" placeholder="Top Down, Pullback, HTF" />
            </label>
            <label class="field">
              <span>Preferred Symbols</span>
              <PInputText v-model="setupEngine.builderDraft.value.preferredSymbolsText" class="input-dark" placeholder="EURUSD, XAUUSD" />
            </label>
            <label class="field">
              <span>Preferred Session</span>
              <PInputText v-model="setupEngine.builderDraft.value.preferredSession" class="input-dark" placeholder="London" />
            </label>
            <label class="field">
              <span>Preferred Timeframe</span>
              <PInputText v-model="setupEngine.builderDraft.value.preferredTimeframe" class="input-dark" placeholder="H1 / M15" />
            </label>
            <label class="setup-switch-row">
              <input v-model="setupEngine.builderDraft.value.isActive" type="checkbox">
              <span>Active</span>
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Criteria" subtitle="Drag sections or criteria to change order.">
          <template #action>
            <PButton type="button" label="Section" icon="pi pi-plus" class="action-primary" @click="setupEngine.addSection" />
          </template>

          <div class="setup-section-list">
            <div
              v-for="section in setupEngine.builderDraft.value.sections"
              :key="section.uid"
              class="setup-builder-section"
              draggable="true"
              @dragstart="startSectionDrag(section)"
              @dragover.prevent
              @drop="dropSection(section)"
            >
              <div class="setup-builder-section-head">
                <div class="form-grid form-grid--2">
                  <label class="field">
                    <span>Section</span>
                    <PInputText v-model="section.name" class="input-dark" />
                  </label>
                  <label class="field">
                    <span>Weight</span>
                    <input v-model.number="section.weight" type="number" class="form-input form-input--number">
                  </label>
                  <label class="field field--full">
                    <span>Description</span>
                    <PTextarea v-model="section.description" auto-resize rows="2" class="input-dark" />
                  </label>
                </div>
                <PButton type="button" icon="pi pi-trash" class="action-danger setup-icon-btn" :title="'Remove section'" @click="setupEngine.removeSection(section.uid)" />
              </div>

              <div class="setup-criterion-list">
                <button
                  v-for="criterion in section.criteria"
                  :key="criterion.uid"
                  type="button"
                  class="setup-criterion-row"
                  :class="{ 'is-active': setupEngine.activeCriterionUid.value === criterion.uid }"
                  draggable="true"
                  @click="setupEngine.activeCriterionUid.value = criterion.uid"
                  @dragstart="startCriterionDrag(section, criterion)"
                  @dragover.prevent
                  @drop="dropCriterion(section, criterion)"
                >
                  <v-icon size="18">mdi-drag</v-icon>
                  <span>{{ criterion.name }}</span>
                  <small>{{ criterion.criterionType.replaceAll('_', ' ') }}</small>
                  <strong>{{ criterion.maxPoints }} pts</strong>
                </button>
              </div>

              <div class="setup-inline-actions">
                <PButton type="button" label="Criterion" icon="pi pi-plus" class="action-neutral" @click="setupEngine.addCriterion(section.uid)" />
                <PButton
                  v-if="section.criteria.length > 1 && setupEngine.activeBuilderCriterion.value"
                  type="button"
                  label="Remove selected"
                  icon="pi pi-minus"
                  class="action-danger"
                  @click="setupEngine.removeCriterion(section.uid, setupEngine.activeCriterionUid.value)"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard v-if="setupEngine.activeBuilderCriterion.value" title="Criterion Configuration">
          <div class="form-grid form-grid--2">
            <label class="field">
              <span>Question</span>
              <PInputText v-model="setupEngine.activeBuilderCriterion.value.name" class="input-dark" />
            </label>
            <label class="field">
              <span>Type</span>
              <PDropdown
                v-model="setupEngine.activeBuilderCriterion.value.criterionType"
                :options="setupEngine.criterionTypeOptions"
                option-label="label"
                option-value="value"
                class="input-dark"
                @change="onCriterionTypeChange(setupEngine.activeBuilderCriterion.value)"
              />
            </label>
            <label class="field">
              <span>Max Points</span>
              <input v-model.number="setupEngine.activeBuilderCriterion.value.maxPoints" type="number" min="0" class="form-input form-input--number">
            </label>
            <label class="setup-switch-row">
              <input v-model="setupEngine.activeBuilderCriterion.value.isRequired" type="checkbox">
              <span>Required</span>
            </label>
            <label class="setup-switch-row">
              <input v-model="setupEngine.activeBuilderCriterion.value.isBonus" type="checkbox">
              <span>Bonus</span>
            </label>
            <label class="field field--full">
              <span>Description</span>
              <PTextarea v-model="setupEngine.activeBuilderCriterion.value.description" auto-resize rows="2" class="input-dark" />
            </label>
            <label class="field field--full">
              <span>Help Text</span>
              <PTextarea v-model="setupEngine.activeBuilderCriterion.value.helpText" auto-resize rows="2" class="input-dark" />
            </label>
          </div>

          <div
            v-if="['boolean', 'required_gate', 'optional_bonus'].includes(setupEngine.activeBuilderCriterion.value.criterionType)"
            class="setup-config-grid"
          >
            <label class="field">
              <span>Yes Points</span>
              <input v-model.number="setupEngine.activeBuilderCriterion.value.config.yesPoints" type="number" class="form-input form-input--number">
            </label>
            <label class="field">
              <span>No Points</span>
              <input v-model.number="setupEngine.activeBuilderCriterion.value.config.noPoints" type="number" class="form-input form-input--number">
            </label>
          </div>

          <div
            v-if="['number', 'number_range'].includes(setupEngine.activeBuilderCriterion.value.criterionType)"
            class="setup-config-grid"
          >
            <label class="field">
              <span>Operator</span>
              <PDropdown
                v-model="setupEngine.activeBuilderCriterion.value.config.operator"
                :options="operatorOptions"
                option-label="label"
                option-value="value"
                class="input-dark"
              />
            </label>
            <label class="field">
              <span>Target</span>
              <input v-model.number="setupEngine.activeBuilderCriterion.value.config.target" type="number" class="form-input form-input--number">
            </label>
          </div>

          <div
            v-if="['single_select', 'multi_select', 'checklist'].includes(setupEngine.activeBuilderCriterion.value.criterionType)"
            class="setup-option-editor"
          >
            <div class="setup-editor-subhead">
              <strong>Options</strong>
              <PButton type="button" icon="pi pi-plus" class="action-neutral setup-icon-btn" :title="'Add option'" @click="setupEngine.addCriterionOption(setupEngine.activeBuilderCriterion.value)" />
            </div>
            <div v-for="option in setupEngine.activeBuilderCriterion.value.options" :key="option.uid" class="setup-option-row">
              <PInputText v-model="option.label" class="input-dark" />
              <input v-model.number="option.points" type="number" class="form-input form-input--number">
              <PButton type="button" icon="pi pi-trash" class="action-danger setup-icon-btn" :title="'Remove option'" @click="setupEngine.removeCriterionOption(setupEngine.activeBuilderCriterion.value, option.uid)" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Grades" subtitle="Labels and thresholds belong to this setup version.">
          <template #action>
            <PButton type="button" label="Grade" icon="pi pi-plus" class="action-neutral" @click="setupEngine.addThreshold" />
          </template>

          <div class="setup-grade-editor">
            <div v-for="threshold in setupEngine.builderDraft.value.thresholds" :key="threshold.uid" class="setup-grade-row">
              <PInputText v-model="threshold.label" class="input-dark" placeholder="A+" />
              <input v-model.number="threshold.minValue" type="number" class="form-input form-input--number">
              <input v-model.number="threshold.maxValue" type="number" class="form-input form-input--number">
              <PDropdown v-model="threshold.valueType" :options="valueTypeOptions" option-label="label" option-value="value" class="input-dark" />
              <PInputText v-model="threshold.displayToken" class="input-dark" placeholder="green" />
              <PButton type="button" icon="pi pi-trash" class="action-danger setup-icon-btn" :title="'Remove grade'" @click="setupEngine.removeThreshold(threshold.uid)" />
            </div>
          </div>
        </SectionCard>

        <div class="setup-save-row">
          <PButton type="button" label="Save Setup Version" icon="pi pi-save" class="action-primary" :loading="setupEngine.isSaving.value" @click="saveBuilder" />
        </div>
      </div>

      <aside class="setup-preview-panel">
        <div class="setup-preview-card">
          <div class="setup-preview-head">
            <div>
              <strong>{{ setupEngine.builderDraft.value.name || 'Untitled setup' }}</strong>
              <span>{{ setupEngine.builderDraft.value.category || 'No category' }}</span>
            </div>
            <PTag :value="setupEngine.builderDraft.value.isActive ? 'Active' : 'Inactive'" />
          </div>

          <div class="setup-preview-list">
            <div v-for="section in setupEngine.builderDraft.value.sections" :key="section.uid" class="setup-preview-section">
              <strong>{{ section.name || 'Untitled section' }}</strong>
              <div v-for="criterion in section.criteria" :key="criterion.uid" class="setup-preview-criterion">
                <span>{{ criterion.name }}</span>
                <small>0 / {{ criterion.maxPoints }}</small>
              </div>
            </div>
          </div>

          <div class="setup-preview-total">
            <span>0 / {{ builderScore }}</span>
            <strong>{{ builderCriteriaCount }} criteria</strong>
          </div>
          <div class="setup-preview-state">
            <span>Grade: -</span>
            <span>Validity: Waiting for required criteria</span>
          </div>
        </div>
      </aside>
    </section>

    <section v-else-if="tab === 'grade'" class="setup-grade-layout">
      <SectionCard
        title="Setup Evaluation"
        subtitle="Pick the setup, enter the pair, then fill the criteria. The grade is calculated from the form."
      >
        <template #action>
          <PButton
            v-if="setupEngine.evaluationDraft.value.id"
            type="button"
            label="Cancel edit"
            icon="pi pi-times"
            class="action-neutral"
            @click="setupEngine.startEvaluation(setupEngine.selectedSetupId.value)"
          />
        </template>

        <div class="pair-grade-form">
          <label class="field">
            <span>Setup</span>
            <PDropdown
              v-model="setupEngine.selectedSetupId.value"
              :options="setupOptions"
              option-label="label"
              option-value="value"
              class="input-dark"
              append-to="body"
              @change="startEvaluationFromSelection"
            />
          </label>
          <label class="field">
            <span>Pair</span>
            <PInputText v-model="setupEngine.evaluationDraft.value.symbol" class="input-dark" placeholder="EURUSD" />
          </label>
          <div class="pair-grade-date">
            <span>Date</span>
            <strong>Today</strong>
          </div>
        </div>
      </SectionCard>

      <div v-if="evaluationActionError" class="sync-banner">
        Evaluation error: {{ evaluationActionError }}
      </div>

      <div v-if="activeDetail" class="setup-evaluation-grid">
        <div class="setup-evaluation-form">
          <SectionCard
            v-for="section in activeDetail.sections"
            :key="section.id"
            :title="section.name"
            :subtitle="section.description"
          >
            <div class="setup-evaluation-criteria">
              <div v-for="criterion in section.criteria" :key="criterion.id" class="setup-evaluation-criterion">
                <div class="setup-evaluation-question">
                  <strong>{{ criterion.name }}</strong>
                  <span>{{ criterion.helpText || criterion.description }}</span>
                </div>

                <PSelectButton
                  v-if="['boolean', 'required_gate', 'optional_bonus'].includes(criterion.criterionType)"
                  v-model="getAnswer(criterion).booleanValue"
                  :options="yesNoOptions"
                  option-label="label"
                  option-value="value"
                  class="input-dark"
                />

                <div v-else-if="criterion.criterionType === 'single_select'" class="setup-radio-stack">
                  <label v-for="option in criterion.options" :key="option.id" class="setup-choice-row">
                    <input v-model="getAnswer(criterion).selectedOptionId" type="radio" :value="option.id">
                    <span>{{ option.label }}</span>
                    <strong>+{{ option.points }}</strong>
                  </label>
                </div>

                <div v-else-if="['multi_select', 'checklist'].includes(criterion.criterionType)" class="setup-radio-stack">
                  <label v-for="option in criterion.options" :key="option.id" class="setup-choice-row">
                    <input
                      type="checkbox"
                      :checked="getAnswer(criterion).selectedOptionIds?.includes(option.id ?? option.uid)"
                      @change="handleAnswerOptionChange(criterion, option.id ?? option.uid, $event)"
                    >
                    <span>{{ option.label }}</span>
                    <strong>+{{ option.points }}</strong>
                  </label>
                </div>

                <input
                  v-else-if="['numeric_score', 'slider', 'percentage', 'number', 'number_range'].includes(criterion.criterionType)"
                  v-model.number="getAnswer(criterion).numericValue"
                  type="number"
                  class="form-input form-input--number"
                  :min="criterion.config.min ?? 0"
                  :max="criterion.criterionType === 'percentage' ? 100 : criterion.maxPoints || undefined"
                  :step="criterion.config.step ?? 1"
                >

                <PTextarea v-else v-model="getAnswer(criterion).textValue" auto-resize rows="3" class="input-dark" />
              </div>
            </div>
          </SectionCard>
        </div>

        <aside class="setup-preview-panel">
          <div class="setup-preview-card">
            <div class="setup-preview-head">
              <div>
                <strong>{{ activeDetail.setup.name }} v{{ activeDetail.version.version_number }}</strong>
                <span>{{ setupEngine.evaluationDraft.value.symbol || 'Pair required' }}</span>
              </div>
              <PTag :value="evaluationResult.isValid ? 'Valid' : 'Invalid'" :severity="evaluationResult.isValid ? 'success' : 'danger'" />
            </div>
            <div class="setup-score-ring">
              <strong>{{ evaluationResult.rawScore.toFixed(1) }} / {{ evaluationResult.maxScore.toFixed(1) }}</strong>
              <span>{{ evaluationResult.normalizedPercentage.toFixed(1) }}%</span>
            </div>
            <div class="setup-preview-state">
              <span>Grade: {{ evaluationResult.gradeLabel || '-' }}</span>
              <span>Validity: {{ evaluationResult.isValid ? 'Valid setup' : evaluationResult.invalidReason }}</span>
            </div>
            <label class="field">
              <span>Notes</span>
              <PTextarea v-model="setupEngine.evaluationDraft.value.notes" auto-resize rows="3" class="input-dark" />
            </label>
            <PButton
              type="button"
              :label="setupEngine.evaluationDraft.value.id ? 'Update Grade' : 'Save Grade'"
              icon="pi pi-save"
              class="action-primary"
              @click="saveEvaluation"
            />
          </div>
        </aside>
      </div>

      <div v-else class="setup-empty">
        <strong>Select or create a setup first.</strong>
        <span>The grading form is generated from the setup criteria.</span>
      </div>

      <SectionCard
        title="Saved Grades"
        subtitle="Saved form-based grades for the selected setup."
        :padded="false"
      >
        <div class="pair-grade-list">
          <div v-for="entry in activeEvaluations" :key="entry.id" class="pair-grade-row">
            <div class="pair-grade-main">
              <strong>{{ entry.symbol || 'No pair' }}</strong>
              <span>{{ formatEvaluationDate(entry.graded_at) }}</span>
            </div>
            <div class="setup-evaluation-history-score">
              <strong>{{ Number(entry.raw_score).toFixed(1) }} / {{ Number(entry.max_score).toFixed(1) }}</strong>
              <span>{{ Number(entry.normalized_percentage).toFixed(1) }}% - {{ entry.grade_label || 'No grade' }}</span>
            </div>
            <PTag :value="entry.grade_label || '-'" :severity="gradeSeverity(entry.grade_label || '')" />
            <div class="pair-grade-actions">
              <PButton
                type="button"
                icon="pi pi-eye"
                class="action-neutral setup-icon-btn"
                :title="'View evaluation'"
                @click="openEvaluationPreview(entry.id)"
              />
              <PButton
                type="button"
                icon="pi pi-pencil"
                class="action-neutral setup-icon-btn"
                :title="'Edit grade'"
                @click="editSavedEvaluation(entry.id)"
              />
              <PButton
                type="button"
                icon="pi pi-trash"
                class="action-danger setup-icon-btn"
                :title="'Delete grade'"
                @click="deleteSavedEvaluation(entry.id)"
              />
            </div>
          </div>

          <div v-if="!activeEvaluations.length" class="setup-empty setup-empty--compact">
            <strong>No saved grades yet</strong>
            <span>Fill the form above and save the first grade.</span>
          </div>
        </div>
      </SectionCard>
    </section>

    <PDialog
      v-model:visible="isEvaluationPreviewOpen"
      modal
      header="Evaluation Preview"
      class="evaluation-preview-dialog"
      :style="{ width: 'min(860px, calc(100vw - 28px))' }"
    >
      <div v-if="previewEvaluation && previewEvaluationDetail" class="evaluation-preview">
        <div class="evaluation-preview-head">
          <div>
            <strong>{{ setupName(previewEvaluation.setup_id) }}</strong>
            <span>{{ formatEvaluationDate(previewEvaluation.graded_at) }} - {{ previewEvaluation.evaluation_type.replaceAll('_', ' ') }}</span>
          </div>
          <div class="evaluation-preview-score">
            <strong>{{ Number(previewEvaluation.raw_score).toFixed(1) }} / {{ Number(previewEvaluation.max_score).toFixed(1) }}</strong>
            <span>{{ Number(previewEvaluation.normalized_percentage).toFixed(1) }}% - {{ previewEvaluation.grade_label || 'No grade' }}</span>
          </div>
          <PTag :value="previewEvaluation.is_valid ? 'Valid' : 'Invalid'" :severity="previewEvaluation.is_valid ? 'success' : 'danger'" />
        </div>

        <div v-if="previewEvaluation.notes" class="evaluation-preview-notes">
          {{ previewEvaluation.notes }}
        </div>

        <div class="evaluation-preview-sections">
          <div v-for="section in previewEvaluationDetail.sections" :key="section.id" class="evaluation-preview-section">
            <strong>{{ section.name }}</strong>
            <div v-for="criterion in section.criteria" :key="criterion.id" class="evaluation-preview-answer">
              <div>
                <span>{{ criterion.name }}</span>
                <small>{{ answerValueLabel(criterion, answerForCriterion(criterion)) }}</small>
                <small v-if="answerForCriterion(criterion)?.comment">{{ answerForCriterion(criterion)?.comment }}</small>
              </div>
              <strong>{{ Number(answerForCriterion(criterion)?.awarded_points ?? 0).toFixed(1) }} / {{ criterion.maxPoints }}</strong>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="setup-empty setup-empty--compact">
        <strong>Evaluation details unavailable</strong>
        <span>The saved score is available, but its setup version could not be loaded.</span>
      </div>
    </PDialog>

  </div>
</template>
