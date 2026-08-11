import { computed, onMounted, ref } from 'vue'

export type CriterionType =
  | 'boolean'
  | 'single_select'
  | 'multi_select'
  | 'numeric_score'
  | 'slider'
  | 'number'
  | 'number_range'
  | 'percentage'
  | 'text'
  | 'checklist'
  | 'optional_bonus'
  | 'required_gate'

export type SetupEvaluationType = 'pre_trade' | 'post_trade_review'
export type TradePlanStatus = 'watching' | 'ready' | 'triggered' | 'invalidated' | 'archived'

export type CriterionConfig = {
  yesPoints?: number
  noPoints?: number
  min?: number
  max?: number
  step?: number
  unit?: string
  operator?: '>=' | '>' | '<=' | '<' | '='
  target?: number
}

export type BuilderOption = {
  uid: string
  id?: string
  label: string
  value: string
  points: number
  sortOrder: number
}

export type BuilderCriterion = {
  uid: string
  id?: string
  name: string
  description: string
  helpText: string
  criterionType: CriterionType
  maxPoints: number
  isRequired: boolean
  isBonus: boolean
  sortOrder: number
  config: CriterionConfig
  options: BuilderOption[]
}

export type BuilderSection = {
  uid: string
  id?: string
  name: string
  description: string
  sortOrder: number
  weight: number | null
  criteria: BuilderCriterion[]
}

export type GradeThreshold = {
  uid: string
  id?: string
  label: string
  minValue: number
  maxValue: number
  valueType: 'percentage' | 'score'
  description: string
  displayToken: string
  recommendation: string
  sortOrder: number
}

export type SetupBuilderDraft = {
  id?: string
  currentVersionId?: string
  versionNumber?: number
  name: string
  description: string
  category: string
  tagsText: string
  preferredSymbolsText: string
  preferredSession: string
  preferredTimeframe: string
  isActive: boolean
  sections: BuilderSection[]
  thresholds: GradeThreshold[]
}

export type SetupVersionDetail = {
  setup: SetupRecord
  version: SetupVersionRecord
  sections: BuilderSection[]
  thresholds: GradeThreshold[]
}

export type SetupSummary = {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  isActive: boolean
  isArchived: boolean
  isFavorite: boolean
  currentVersionId: string | null
  versionNumber: number
  sectionsCount: number
  criteriaCount: number
  maxScore: number
  topGradeLabel: string | null
  topGradeMin: number | null
  tradesGraded: number
  plannedTrades: number
  avgScore: number | null
  winRate: number | null
}

export type TradePlanRecord = {
  id: string
  user_id: string
  setup_id: string | null
  setup_evaluation_id: string | null
  symbol: string
  direction: 'Long' | 'Short'
  status: TradePlanStatus
  timeframe: string
  session: 'Asia' | 'London' | 'New York' | null
  planned_entry: number | string
  planned_stop_loss: number | string
  planned_take_profit: number | string
  size: number | string
  risk_percent: number | string
  thesis: string
  trigger_notes: string
  invalidation_notes: string
  chart_notes: string
  created_at: string
  updated_at: string
}

type SetupRecord = {
  id: string
  user_id: string
  name: string
  description: string
  category: string
  tags: string[] | null
  preferred_symbols: string[] | null
  preferred_session: string | null
  preferred_timeframe: string | null
  is_active: boolean
  is_archived: boolean
  is_favorite: boolean
  current_version_id: string | null
}

type SetupVersionRecord = {
  id: string
  setup_id: string
  version_number: number
  name: string
  description: string
  scoring_mode: 'sum_criteria' | 'manual_max'
  manual_max_score: number | string | null
  created_at: string
  created_by: string
}

type SectionRecord = {
  id: string
  setup_version_id: string
  name: string
  description: string
  sort_order: number
  weight: number | string | null
}

type CriterionRecord = {
  id: string
  setup_section_id: string
  name: string
  description: string
  help_text: string
  criterion_type: CriterionType
  max_points: number | string
  is_required: boolean
  is_bonus: boolean
  sort_order: number
  config: CriterionConfig | null
}

type OptionRecord = {
  id: string
  criterion_id: string
  label: string
  value: string
  points: number | string
  sort_order: number
}

type ThresholdRecord = {
  id: string
  setup_version_id: string
  label: string
  min_value: number | string
  max_value: number | string
  value_type: 'percentage' | 'score'
  description: string
  display_token: string
  recommendation: string
  sort_order: number
}

export type EvaluationRecord = {
  id: string
  user_id: string
  trade_id: string | null
  open_trade_id: string | null
  trade_plan_id: string | null
  setup_id: string
  setup_version_id: string
  evaluation_type: SetupEvaluationType
  raw_score: number | string
  max_score: number | string
  normalized_percentage: number | string
  grade_label: string | null
  is_valid: boolean
  invalid_reason: string | null
  notes: string
  graded_at: string
}

export type EvaluationAnswer = {
  booleanValue?: boolean | null
  numericValue?: number | null
  textValue?: string
  selectedOptionId?: string | null
  selectedOptionIds?: string[]
  comment?: string
}

export type EvaluationAnswerRecord = {
  id: string
  evaluation_id: string
  criterion_id: string
  boolean_value: boolean | null
  numeric_value: number | string | null
  text_value: string | null
  selected_option_id: string | null
  selected_options: string[] | null
  awarded_points: number | string
  comment: string
}

export type EvaluationDraft = {
  setupId: string
  setupVersionId: string
  tradeId: string
  openTradeId: string
  tradePlanId: string
  evaluationType: SetupEvaluationType
  notes: string
  answers: Record<string, EvaluationAnswer>
}

export type TradePlanDraft = {
  id?: string
  setupId: string
  setupEvaluationId?: string | null
  symbol: string
  direction: 'Long' | 'Short'
  status: TradePlanStatus
  timeframe: string
  session: '' | 'Asia' | 'London' | 'New York'
  plannedEntry: number
  plannedStopLoss: number
  plannedTakeProfit: number
  size: number
  riskPercent: number
  thesis: string
  triggerNotes: string
  invalidationNotes: string
  chartNotes: string
}

const criterionTypeOptions = [
  { label: 'Boolean', value: 'boolean' },
  { label: 'Single Select', value: 'single_select' },
  { label: 'Multi Select', value: 'multi_select' },
  { label: 'Numeric Score', value: 'numeric_score' },
  { label: 'Slider', value: 'slider' },
  { label: 'Number', value: 'number' },
  { label: 'Number Range', value: 'number_range' },
  { label: 'Percentage', value: 'percentage' },
  { label: 'Text / Notes', value: 'text' },
  { label: 'Checklist', value: 'checklist' },
  { label: 'Optional Bonus', value: 'optional_bonus' },
  { label: 'Required Gate', value: 'required_gate' },
] as const

function uid(prefix = 'id') {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0
}

function parseList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function labelToValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || uid('option')
}

function createOption(label = 'Option', points = 0, sortOrder = 0): BuilderOption {
  return {
    uid: uid('option'),
    label,
    value: labelToValue(label),
    points,
    sortOrder,
  }
}

function createCriterion(type: CriterionType = 'boolean', sortOrder = 0): BuilderCriterion {
  const maxPoints = type === 'text' ? 0 : type === 'required_gate' ? 0 : 10

  return {
    uid: uid('criterion'),
    name: 'New criterion',
    description: '',
    helpText: '',
    criterionType: type,
    maxPoints,
    isRequired: type === 'required_gate',
    isBonus: type === 'optional_bonus',
    sortOrder,
    config: type === 'boolean' || type === 'required_gate' || type === 'optional_bonus'
      ? { yesPoints: maxPoints, noPoints: 0 }
      : type === 'number' || type === 'number_range'
        ? { operator: '>=', target: 2, unit: '' }
        : { min: 0, max: maxPoints, step: 1 },
    options: type === 'single_select'
      ? [createOption('Strong', maxPoints, 0), createOption('Partial', Math.round(maxPoints / 2), 1), createOption('No edge', 0, 2)]
      : type === 'multi_select' || type === 'checklist'
        ? [createOption('Confluence', Math.round(maxPoints / 2), 0), createOption('Confirmation', Math.round(maxPoints / 2), 1)]
        : [],
  }
}

function createSection(name = 'New Section', sortOrder = 0): BuilderSection {
  return {
    uid: uid('section'),
    name,
    description: '',
    sortOrder,
    weight: null,
    criteria: [createCriterion('boolean', 0)],
  }
}

function createThreshold(label: string, minValue: number, maxValue: number, sortOrder: number): GradeThreshold {
  return {
    uid: uid('grade'),
    label,
    minValue,
    maxValue,
    valueType: 'percentage',
    description: '',
    displayToken: '',
    recommendation: '',
    sortOrder,
  }
}

function defaultThresholds() {
  return [
    createThreshold('A+', 90, 100, 0),
    createThreshold('A', 80, 89.99, 1),
    createThreshold('B', 70, 79.99, 2),
    createThreshold('C', 60, 69.99, 3),
  ]
}

function blankDraft(): SetupBuilderDraft {
  return {
    name: '',
    description: '',
    category: '',
    tagsText: '',
    preferredSymbolsText: '',
    preferredSession: '',
    preferredTimeframe: '',
    isActive: true,
    sections: [createSection('Context', 0)],
    thresholds: defaultThresholds(),
  }
}

function blankTradePlanDraft(setupId = ''): TradePlanDraft {
  return {
    setupId,
    symbol: 'EURUSD',
    direction: 'Long',
    status: 'watching',
    timeframe: '',
    session: '',
    plannedEntry: 0,
    plannedStopLoss: 0,
    plannedTakeProfit: 0,
    size: 0,
    riskPercent: 1,
    thesis: '',
    triggerNotes: '',
    invalidationNotes: '',
    chartNotes: '',
  }
}

function tradePlanDraftFromRecord(plan: TradePlanRecord): TradePlanDraft {
  return {
    id: plan.id,
    setupId: plan.setup_id ?? '',
    setupEvaluationId: plan.setup_evaluation_id,
    symbol: plan.symbol,
    direction: plan.direction,
    status: plan.status,
    timeframe: plan.timeframe,
    session: plan.session ?? '',
    plannedEntry: toNumber(plan.planned_entry),
    plannedStopLoss: toNumber(plan.planned_stop_loss),
    plannedTakeProfit: toNumber(plan.planned_take_profit),
    size: toNumber(plan.size),
    riskPercent: toNumber(plan.risk_percent),
    thesis: plan.thesis,
    triggerNotes: plan.trigger_notes,
    invalidationNotes: plan.invalidation_notes,
    chartNotes: plan.chart_notes,
  }
}

function criterionMaxPoints(criterion: BuilderCriterion) {
  if (criterion.criterionType === 'text' || criterion.criterionType === 'required_gate') {
    return 0
  }

  if (criterion.criterionType === 'single_select' || criterion.criterionType === 'multi_select' || criterion.criterionType === 'checklist') {
    return Math.max(toNumber(criterion.maxPoints), ...criterion.options.map((option) => toNumber(option.points)), 0)
  }

  return Math.max(0, toNumber(criterion.maxPoints))
}

function calculateMaxScore(sections: BuilderSection[]) {
  return sections.reduce(
    (sum, section) => sum + section.criteria.reduce((inner, criterion) => inner + criterionMaxPoints(criterion), 0),
    0,
  )
}

function findGrade(thresholds: GradeThreshold[], score: number, percentage: number) {
  const sorted = [...thresholds].sort((left, right) => left.sortOrder - right.sortOrder)
  return sorted.find((threshold) => {
    const value = threshold.valueType === 'score' ? score : percentage
    return value >= toNumber(threshold.minValue) && value <= toNumber(threshold.maxValue)
  }) ?? null
}

function evaluateCriterion(criterion: BuilderCriterion, answer: EvaluationAnswer | undefined) {
  if (!answer) {
    return {
      awardedPoints: 0,
      invalidReason: criterion.isRequired ? `${criterion.name} is required` : '',
    }
  }

  if (criterion.criterionType === 'boolean' || criterion.criterionType === 'required_gate' || criterion.criterionType === 'optional_bonus') {
    const value = answer.booleanValue === true
    const awardedPoints = value ? toNumber(criterion.config.yesPoints ?? criterion.maxPoints) : toNumber(criterion.config.noPoints ?? 0)
    return {
      awardedPoints,
      invalidReason: criterion.criterionType === 'required_gate' && !value ? criterion.name : '',
    }
  }

  if (criterion.criterionType === 'single_select') {
    const option = criterion.options.find((item) => item.id === answer.selectedOptionId || item.uid === answer.selectedOptionId)
    return { awardedPoints: toNumber(option?.points), invalidReason: criterion.isRequired && !option ? `${criterion.name} is required` : '' }
  }

  if (criterion.criterionType === 'multi_select' || criterion.criterionType === 'checklist') {
    const selected = new Set(answer.selectedOptionIds ?? [])
    const awardedPoints = criterion.options
      .filter((option) => selected.has(option.id ?? option.uid))
      .reduce((sum, option) => sum + toNumber(option.points), 0)
    return {
      awardedPoints: Math.min(criterionMaxPoints(criterion), awardedPoints),
      invalidReason: criterion.isRequired && selected.size === 0 ? `${criterion.name} is required` : '',
    }
  }

  if (criterion.criterionType === 'numeric_score' || criterion.criterionType === 'slider' || criterion.criterionType === 'percentage') {
    const value = Math.max(toNumber(criterion.config.min), Math.min(criterionMaxPoints(criterion), toNumber(answer.numericValue)))
    return { awardedPoints: value, invalidReason: criterion.isRequired && answer.numericValue == null ? `${criterion.name} is required` : '' }
  }

  if (criterion.criterionType === 'number' || criterion.criterionType === 'number_range') {
    const numeric = toNumber(answer.numericValue)
    const target = toNumber(criterion.config.target)
    const operator = criterion.config.operator ?? '>='
    const passes =
      operator === '>=' ? numeric >= target :
        operator === '>' ? numeric > target :
          operator === '<=' ? numeric <= target :
            operator === '<' ? numeric < target :
              numeric === target
    const invalidReason = criterion.isRequired && !passes ? `${criterion.name} gate failed` : ''
    return { awardedPoints: passes ? criterionMaxPoints(criterion) : 0, invalidReason }
  }

  return { awardedPoints: 0, invalidReason: criterion.isRequired && !answer.textValue?.trim() ? `${criterion.name} is required` : '' }
}

function draftFromDetail(detail: SetupVersionDetail): SetupBuilderDraft {
  return {
    id: detail.setup.id,
    currentVersionId: detail.version.id,
    versionNumber: detail.version.version_number,
    name: detail.setup.name,
    description: detail.setup.description,
    category: detail.setup.category,
    tagsText: (detail.setup.tags ?? []).join(', '),
    preferredSymbolsText: (detail.setup.preferred_symbols ?? []).join(', '),
    preferredSession: detail.setup.preferred_session ?? '',
    preferredTimeframe: detail.setup.preferred_timeframe ?? '',
    isActive: detail.setup.is_active,
    sections: detail.sections.map((section) => ({
      ...section,
      uid: uid('section'),
      criteria: section.criteria.map((criterion) => ({
        ...criterion,
        uid: uid('criterion'),
        options: criterion.options.map((option) => ({ ...option, uid: uid('option') })),
      })),
    })),
    thresholds: detail.thresholds.map((threshold) => ({ ...threshold, uid: uid('grade') })),
  }
}

function rowsToSections(sectionRows: SectionRecord[], criterionRows: CriterionRecord[], optionRows: OptionRecord[]) {
  const criteriaBySection = new Map<string, BuilderCriterion[]>()
  const optionsByCriterion = new Map<string, BuilderOption[]>()

  for (const option of optionRows) {
    const list = optionsByCriterion.get(option.criterion_id) ?? []
    list.push({
      uid: uid('option'),
      id: option.id,
      label: option.label,
      value: option.value,
      points: toNumber(option.points),
      sortOrder: option.sort_order,
    })
    optionsByCriterion.set(option.criterion_id, list)
  }

  for (const criterion of criterionRows) {
    const list = criteriaBySection.get(criterion.setup_section_id) ?? []
    list.push({
      uid: uid('criterion'),
      id: criterion.id,
      name: criterion.name,
      description: criterion.description,
      helpText: criterion.help_text,
      criterionType: criterion.criterion_type,
      maxPoints: toNumber(criterion.max_points),
      isRequired: criterion.is_required,
      isBonus: criterion.is_bonus,
      sortOrder: criterion.sort_order,
      config: criterion.config ?? {},
      options: [...(optionsByCriterion.get(criterion.id) ?? [])].sort((left, right) => left.sortOrder - right.sortOrder),
    })
    criteriaBySection.set(criterion.setup_section_id, list)
  }

  return sectionRows
    .map((section) => ({
      uid: uid('section'),
      id: section.id,
      name: section.name,
      description: section.description,
      sortOrder: section.sort_order,
      weight: section.weight == null ? null : toNumber(section.weight),
      criteria: [...(criteriaBySection.get(section.id) ?? [])].sort((left, right) => left.sortOrder - right.sortOrder),
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder)
}

function rowsToThresholds(rows: ThresholdRecord[]) {
  return rows
    .map((threshold) => ({
      uid: uid('grade'),
      id: threshold.id,
      label: threshold.label,
      minValue: toNumber(threshold.min_value),
      maxValue: toNumber(threshold.max_value),
      valueType: threshold.value_type,
      description: threshold.description,
      displayToken: threshold.display_token,
      recommendation: threshold.recommendation,
      sortOrder: threshold.sort_order,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder)
}

const templateDrafts: SetupBuilderDraft[] = [
  {
    ...blankDraft(),
    name: 'FXAlexG Pullback',
    description: 'Top-down continuation setup based on HTF context, AOI and lower-timeframe confirmation.',
    category: 'Price Action',
    tagsText: 'Top Down, Pullback, HTF',
    sections: [
      {
        ...createSection('Higher Timeframe Context', 0),
        criteria: [
          { ...createCriterion('single_select', 0), name: 'Weekly + Daily Alignment', maxPoints: 20, options: [createOption('Perfect alignment', 20, 0), createOption('Partial alignment', 10, 1), createOption('Conflict', 0, 2)] },
          { ...createCriterion('slider', 1), name: 'H4 Context', maxPoints: 15, config: { min: 0, max: 15, step: 1 } },
        ],
      },
      { ...createSection('Area of Interest', 1), criteria: [{ ...createCriterion('boolean', 0), name: 'Price inside HTF AOI?', maxPoints: 20, isRequired: true, config: { yesPoints: 20, noPoints: 0 } }] },
      { ...createSection('Entry Confirmation', 2), criteria: [{ ...createCriterion('boolean', 0), name: 'Structure shift confirmed?', maxPoints: 15, config: { yesPoints: 15, noPoints: 0 } }, { ...createCriterion('optional_bonus', 1), name: 'Engulfing candle present', maxPoints: 10, config: { yesPoints: 10, noPoints: 0 } }] },
      { ...createSection('Risk / Reward', 3), criteria: [{ ...createCriterion('required_gate', 0), name: 'RR >= 2', maxPoints: 0, isRequired: true, config: { operator: '>=', target: 2 } }, { ...createCriterion('numeric_score', 1), name: 'Execution quality', maxPoints: 20, config: { min: 0, max: 20, step: 1 } }] },
    ],
  },
  {
    ...blankDraft(),
    name: 'Head & Shoulders',
    description: 'Pattern reversal setup with prior trend, neckline quality, break, retest and execution.',
    category: 'Pattern',
    tagsText: 'Reversal, Pattern',
    thresholds: [createThreshold('Perfect', 85, 100, 0), createThreshold('Valid', 70, 84.99, 1), createThreshold('Weak', 50, 69.99, 2)],
    sections: [
      { ...createSection('Pattern Quality', 0), criteria: [{ ...createCriterion('required_gate', 0), name: 'Prior trend exists', isRequired: true }, { ...createCriterion('slider', 1), name: 'Shoulder symmetry', maxPoints: 20 }] },
      { ...createSection('Neckline', 1), criteria: [{ ...createCriterion('boolean', 0), name: 'Neckline is defined', maxPoints: 15 }, { ...createCriterion('boolean', 1), name: 'Neckline break confirmed', maxPoints: 20 }] },
      { ...createSection('Confirmation', 2), criteria: [{ ...createCriterion('boolean', 0), name: 'Retest held', maxPoints: 20 }, { ...createCriterion('numeric_score', 1), name: 'RR quality', maxPoints: 15 }] },
    ],
  },
  {
    ...blankDraft(),
    name: 'ICT Sweep',
    description: 'Liquidity sweep setup with session, displacement, MSS, FVG and entry-location scoring.',
    category: 'ICT',
    tagsText: 'Liquidity, Sweep, MSS',
    thresholds: [createThreshold('S', 90, 100, 0), createThreshold('A', 78, 89.99, 1), createThreshold('B', 65, 77.99, 2), createThreshold('Avoid', 0, 64.99, 3)],
    sections: [
      { ...createSection('Liquidity', 0), criteria: [{ ...createCriterion('single_select', 0), name: 'Liquidity level quality', maxPoints: 25, options: [createOption('Major level', 25, 0), createOption('Minor level', 12, 1), createOption('Unclear', 0, 2)] }, { ...createCriterion('required_gate', 1), name: 'Sweep occurred', isRequired: true }] },
      { ...createSection('Structure', 1), criteria: [{ ...createCriterion('boolean', 0), name: 'Displacement present', maxPoints: 25 }, { ...createCriterion('boolean', 1), name: 'MSS confirmed', maxPoints: 25 }] },
      { ...createSection('Entry', 2), criteria: [{ ...createCriterion('boolean', 0), name: 'FVG respected', maxPoints: 20 }, { ...createCriterion('numeric_score', 1), name: 'Entry location', maxPoints: 30 }, { ...createCriterion('number', 2), name: 'RR >= 2', maxPoints: 0, isRequired: true, config: { operator: '>=', target: 2 } }] },
    ],
  },
]

export function useTradingSetups() {
  const auth = useAuth()
  const setupSummaries = useState<SetupSummary[]>('pnl-ledger-trading-setup-summaries', () => [])
  const detailById = useState<Record<string, SetupVersionDetail>>('pnl-ledger-trading-setup-details', () => ({}))
  const evaluations = useState<EvaluationRecord[]>('pnl-ledger-trading-setup-evaluations', () => [])
  const evaluationAnswersById = useState<Record<string, EvaluationAnswerRecord[]>>('pnl-ledger-trading-setup-evaluation-answers', () => ({}))
  const tradePlans = useState<TradePlanRecord[]>('pnl-ledger-trade-plans', () => [])
  const selectedSetupId = useState<string>('pnl-ledger-selected-trading-setup', () => '')
  const builderDraft = useState<SetupBuilderDraft>('pnl-ledger-setup-builder-draft', () => blankDraft())
  const evaluationDraft = useState<EvaluationDraft>('pnl-ledger-setup-evaluation-draft', () => ({
    setupId: '',
    setupVersionId: '',
    tradeId: '',
    openTradeId: '',
    tradePlanId: '',
    evaluationType: 'pre_trade',
    notes: '',
    answers: {},
  }))
  const tradePlanDraft = useState<TradePlanDraft>('pnl-ledger-trade-plan-draft', () => blankTradePlanDraft())
  const isLoading = useState<boolean>('pnl-ledger-trading-setups-loading', () => false)
  const isSaving = useState<boolean>('pnl-ledger-trading-setups-saving', () => false)
  const loadError = useState<string | null>('pnl-ledger-trading-setups-error', () => null)
  const hasLoaded = useState<boolean>('pnl-ledger-trading-setups-loaded', () => false)
  const activeCriterionUid = ref('')

  const templates = computed(() => templateDrafts.map((template) => ({ label: template.name, value: template.name })))
  const activeDetail = computed(() => selectedSetupId.value ? detailById.value[selectedSetupId.value] ?? null : null)
  const activeBuilderCriterion = computed(() => {
    for (const section of builderDraft.value.sections) {
      const criterion = section.criteria.find((item) => item.uid === activeCriterionUid.value)
      if (criterion) return criterion
    }
    return null
  })
  const builderMaxScore = computed(() => calculateMaxScore(builderDraft.value.sections))
  const builderCriteriaCount = computed(() => builderDraft.value.sections.reduce((sum, section) => sum + section.criteria.length, 0))
  const evaluationResult = computed(() => calculateEvaluation(activeDetail.value, evaluationDraft.value.answers))

  function clear() {
    setupSummaries.value = []
    detailById.value = {}
    evaluations.value = []
    evaluationAnswersById.value = {}
    tradePlans.value = []
    selectedSetupId.value = ''
    hasLoaded.value = false
  }

  async function refreshSetups() {
    if (isLoading.value) return
    isLoading.value = true
    loadError.value = null

    try {
      await auth.ensureAuthReady()
      const currentUser = auth.user.value
      if (!currentUser) {
        clear()
        hasLoaded.value = true
        return
      }

      const supabase = useSupabase()
      const { data: setupsData, error: setupsError } = await supabase
        .from('trading_setups')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('is_favorite', { ascending: false })
        .order('updated_at', { ascending: false })

      if (setupsError) throw setupsError

      const setups = (setupsData ?? []) as SetupRecord[]
      const versionIds = setups.map((setup) => setup.current_version_id).filter((id): id is string => Boolean(id))
      const setupIds = setups.map((setup) => setup.id)

      const [versionsResult, sectionsResult, evaluationsResult, plansResult] = await Promise.all([
        versionIds.length
          ? supabase.from('trading_setup_versions').select('*').in('id', versionIds)
          : Promise.resolve({ data: [], error: null }),
        versionIds.length
          ? supabase.from('setup_sections').select('*').in('setup_version_id', versionIds).order('sort_order', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        setupIds.length
          ? supabase.from('trade_setup_evaluations').select('*').eq('user_id', currentUser.id).in('setup_id', setupIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('trade_plans').select('*').eq('user_id', currentUser.id).order('updated_at', { ascending: false }),
      ])

      if (versionsResult.error) throw versionsResult.error
      if (sectionsResult.error) throw sectionsResult.error
      if (evaluationsResult.error) throw evaluationsResult.error
      if (plansResult.error) throw plansResult.error

      const versions = (versionsResult.data ?? []) as SetupVersionRecord[]
      const sections = (sectionsResult.data ?? []) as SectionRecord[]
      const sectionIds = sections.map((section) => section.id)

      const [criteriaResult, thresholdsResult] = await Promise.all([
        sectionIds.length
          ? supabase.from('setup_criteria').select('*').in('setup_section_id', sectionIds).order('sort_order', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        versionIds.length
          ? supabase.from('setup_grade_thresholds').select('*').in('setup_version_id', versionIds).order('sort_order', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ])

      if (criteriaResult.error) throw criteriaResult.error
      if (thresholdsResult.error) throw thresholdsResult.error

      const criteria = (criteriaResult.data ?? []) as CriterionRecord[]
      const criterionIds = criteria.map((criterion) => criterion.id)
      const optionsResult = criterionIds.length
        ? await supabase.from('setup_criterion_options').select('*').in('criterion_id', criterionIds).order('sort_order', { ascending: true })
        : { data: [], error: null }

      if (optionsResult.error) throw optionsResult.error

      const options = (optionsResult.data ?? []) as OptionRecord[]
      const thresholds = (thresholdsResult.data ?? []) as ThresholdRecord[]
      evaluations.value = (evaluationsResult.data ?? []) as EvaluationRecord[]
      tradePlans.value = (plansResult.data ?? []) as TradePlanRecord[]
      const evaluationIds = evaluations.value.map((evaluation) => evaluation.id)
      const answersResult = evaluationIds.length
        ? await supabase.from('trade_setup_evaluation_answers').select('*').in('evaluation_id', evaluationIds)
        : { data: [], error: null }

      if (answersResult.error) throw answersResult.error

      const answersByEvaluation: Record<string, EvaluationAnswerRecord[]> = {}
      for (const answer of (answersResult.data ?? []) as EvaluationAnswerRecord[]) {
        const list = answersByEvaluation[answer.evaluation_id] ?? []
        list.push(answer)
        answersByEvaluation[answer.evaluation_id] = list
      }
      evaluationAnswersById.value = answersByEvaluation

      const details: Record<string, SetupVersionDetail> = {}
      const versionsById = new Map(versions.map((version) => [version.id, version]))
      const sectionsByVersion = new Map<string, SectionRecord[]>()
      const thresholdsByVersion = new Map<string, ThresholdRecord[]>()

      for (const section of sections) {
        const list = sectionsByVersion.get(section.setup_version_id) ?? []
        list.push(section)
        sectionsByVersion.set(section.setup_version_id, list)
      }

      for (const threshold of thresholds) {
        const list = thresholdsByVersion.get(threshold.setup_version_id) ?? []
        list.push(threshold)
        thresholdsByVersion.set(threshold.setup_version_id, list)
      }

      setupSummaries.value = setups.map((setup) => {
        const version = setup.current_version_id ? versionsById.get(setup.current_version_id) : null
        const versionSections = version ? rowsToSections(sectionsByVersion.get(version.id) ?? [], criteria, options) : []
        const versionThresholds = version ? rowsToThresholds(thresholdsByVersion.get(version.id) ?? []) : []
        const setupEvaluations = evaluations.value.filter((evaluation) => evaluation.setup_id === setup.id)
        const plannedTrades = setupEvaluations.filter(
          (evaluation) =>
            evaluation.evaluation_type === 'pre_trade'
            && !evaluation.trade_id
            && !evaluation.open_trade_id,
        ).length
        const avgScore = setupEvaluations.length
          ? setupEvaluations.reduce((sum, evaluation) => sum + toNumber(evaluation.normalized_percentage), 0) / setupEvaluations.length
          : null

        if (version) {
          details[setup.id] = {
            setup,
            version,
            sections: versionSections,
            thresholds: versionThresholds,
          }
        }

        const topGrade = [...versionThresholds].sort((left, right) => right.minValue - left.minValue)[0] ?? null
        return {
          id: setup.id,
          name: setup.name,
          description: setup.description,
          category: setup.category,
          tags: setup.tags ?? [],
          isActive: setup.is_active,
          isArchived: setup.is_archived,
          isFavorite: setup.is_favorite,
          currentVersionId: setup.current_version_id,
          versionNumber: version?.version_number ?? 0,
          sectionsCount: versionSections.length,
          criteriaCount: versionSections.reduce((sum, section) => sum + section.criteria.length, 0),
          maxScore: versionSections.length ? calculateMaxScore(versionSections) : 0,
          topGradeLabel: topGrade?.label ?? null,
          topGradeMin: topGrade?.minValue ?? null,
          tradesGraded: setupEvaluations.length,
          plannedTrades,
          avgScore,
          winRate: null,
        }
      })

      detailById.value = details
      if (!selectedSetupId.value && setupSummaries.value[0]) {
        selectedSetupId.value = setupSummaries.value[0].id
      }
      hasLoaded.value = true
    } catch (caught) {
      loadError.value = caught instanceof Error ? caught.message : String(caught)
    } finally {
      isLoading.value = false
    }
  }

  async function loadSetupDetail(setupId: string) {
    selectedSetupId.value = setupId
    if (detailById.value[setupId]) return detailById.value[setupId]
    await refreshSetups()
    return detailById.value[setupId] ?? null
  }

  function newDraft() {
    builderDraft.value = blankDraft()
    activeCriterionUid.value = builderDraft.value.sections[0]?.criteria[0]?.uid ?? ''
  }

  function draftFromTemplate(templateName: string) {
    const template = templateDrafts.find((item) => item.name === templateName)
    builderDraft.value = template ? structuredClone(template) : blankDraft()
    delete builderDraft.value.id
    delete builderDraft.value.currentVersionId
    activeCriterionUid.value = builderDraft.value.sections[0]?.criteria[0]?.uid ?? ''
  }

  async function editDraft(setupId: string) {
    const detail = await loadSetupDetail(setupId)
    if (!detail) return
    builderDraft.value = draftFromDetail(detail)
    activeCriterionUid.value = builderDraft.value.sections[0]?.criteria[0]?.uid ?? ''
  }

  async function duplicateDraft(setupId: string) {
    const detail = await loadSetupDetail(setupId)
    if (!detail) return
    builderDraft.value = draftFromDetail(detail)
    delete builderDraft.value.id
    delete builderDraft.value.currentVersionId
    builderDraft.value.name = `${builderDraft.value.name} Copy`
    activeCriterionUid.value = builderDraft.value.sections[0]?.criteria[0]?.uid ?? ''
  }

  function addSection() {
    const section = createSection('New Section', builderDraft.value.sections.length)
    builderDraft.value.sections.push(section)
    activeCriterionUid.value = section.criteria[0]?.uid ?? ''
  }

  function removeSection(sectionUid: string) {
    if (builderDraft.value.sections.length <= 1) return
    builderDraft.value.sections = builderDraft.value.sections
      .filter((section) => section.uid !== sectionUid)
      .map((section, index) => ({ ...section, sortOrder: index }))
    if (!builderDraft.value.sections.some((section) => section.criteria.some((criterion) => criterion.uid === activeCriterionUid.value))) {
      activeCriterionUid.value = builderDraft.value.sections[0]?.criteria[0]?.uid ?? ''
    }
  }

  function addCriterion(sectionUid: string, type: CriterionType = 'boolean') {
    const section = builderDraft.value.sections.find((item) => item.uid === sectionUid)
    if (!section) return
    const criterion = createCriterion(type, section.criteria.length)
    section.criteria.push(criterion)
    activeCriterionUid.value = criterion.uid
  }

  function removeCriterion(sectionUid: string, criterionUid: string) {
    const section = builderDraft.value.sections.find((item) => item.uid === sectionUid)
    if (!section || section.criteria.length <= 1) return
    section.criteria = section.criteria
      .filter((criterion) => criterion.uid !== criterionUid)
      .map((criterion, index) => ({ ...criterion, sortOrder: index }))
    if (activeCriterionUid.value === criterionUid) {
      activeCriterionUid.value = section.criteria[0]?.uid ?? ''
    }
  }

  function moveSection(fromUid: string, toUid: string) {
    const from = builderDraft.value.sections.findIndex((section) => section.uid === fromUid)
    const to = builderDraft.value.sections.findIndex((section) => section.uid === toUid)
    if (from < 0 || to < 0 || from === to) return
    const [item] = builderDraft.value.sections.splice(from, 1)
    builderDraft.value.sections.splice(to, 0, item)
    builderDraft.value.sections.forEach((section, index) => { section.sortOrder = index })
  }

  function moveCriterion(sectionUid: string, fromUid: string, toUid: string) {
    const section = builderDraft.value.sections.find((item) => item.uid === sectionUid)
    if (!section) return
    const from = section.criteria.findIndex((criterion) => criterion.uid === fromUid)
    const to = section.criteria.findIndex((criterion) => criterion.uid === toUid)
    if (from < 0 || to < 0 || from === to) return
    const [item] = section.criteria.splice(from, 1)
    section.criteria.splice(to, 0, item)
    section.criteria.forEach((criterion, index) => { criterion.sortOrder = index })
  }

  function addCriterionOption(criterion: BuilderCriterion) {
    criterion.options.push(createOption('Option', 0, criterion.options.length))
  }

  function removeCriterionOption(criterion: BuilderCriterion, optionUid: string) {
    criterion.options = criterion.options
      .filter((option) => option.uid !== optionUid)
      .map((option, index) => ({ ...option, sortOrder: index }))
  }

  function addThreshold() {
    builderDraft.value.thresholds.push(createThreshold('Grade', 0, 100, builderDraft.value.thresholds.length))
  }

  function removeThreshold(uidToRemove: string) {
    builderDraft.value.thresholds = builderDraft.value.thresholds
      .filter((threshold) => threshold.uid !== uidToRemove)
      .map((threshold, index) => ({ ...threshold, sortOrder: index }))
  }

  async function saveDraft() {
    await auth.ensureAuthReady()
    const currentUser = auth.user.value
    if (!currentUser) throw new Error('You need to be logged in to save setups.')
    if (!builderDraft.value.name.trim()) throw new Error('Setup name is required.')

    isSaving.value = true
    loadError.value = null

    try {
      const supabase = useSupabase()
      let setupId = builderDraft.value.id
      const setupPayload = {
        user_id: currentUser.id,
        name: builderDraft.value.name.trim(),
        description: builderDraft.value.description.trim(),
        category: builderDraft.value.category.trim(),
        tags: parseList(builderDraft.value.tagsText),
        preferred_symbols: parseList(builderDraft.value.preferredSymbolsText),
        preferred_session: builderDraft.value.preferredSession.trim() || null,
        preferred_timeframe: builderDraft.value.preferredTimeframe.trim() || null,
        is_active: builderDraft.value.isActive,
      }

      if (setupId) {
        const { error } = await supabase.from('trading_setups').update(setupPayload).eq('id', setupId).eq('user_id', currentUser.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('trading_setups').insert(setupPayload).select('*').single()
        if (error) throw error
        setupId = (data as SetupRecord).id
      }

      const { data: existingVersions, error: versionCountError } = await supabase
        .from('trading_setup_versions')
        .select('version_number')
        .eq('setup_id', setupId)
        .order('version_number', { ascending: false })
        .limit(1)

      if (versionCountError) throw versionCountError
      const nextVersionNumber = ((existingVersions?.[0]?.version_number as number | undefined) ?? 0) + 1
      const maxScore = calculateMaxScore(builderDraft.value.sections)

      const { data: versionData, error: versionError } = await supabase
        .from('trading_setup_versions')
        .insert({
          setup_id: setupId,
          version_number: nextVersionNumber,
          name: setupPayload.name,
          description: setupPayload.description,
          scoring_mode: 'sum_criteria',
          manual_max_score: maxScore,
          created_by: currentUser.id,
        })
        .select('*')
        .single()

      if (versionError) throw versionError
      const version = versionData as SetupVersionRecord

      for (const [sectionIndex, section] of builderDraft.value.sections.entries()) {
        const { data: sectionData, error: sectionError } = await supabase
          .from('setup_sections')
          .insert({
            setup_version_id: version.id,
            name: section.name.trim() || `Section ${sectionIndex + 1}`,
            description: section.description.trim(),
            sort_order: sectionIndex,
            weight: section.weight,
          })
          .select('*')
          .single()

        if (sectionError) throw sectionError
        const insertedSection = sectionData as SectionRecord

        for (const [criterionIndex, criterion] of section.criteria.entries()) {
          const { data: criterionData, error: criterionError } = await supabase
            .from('setup_criteria')
            .insert({
              setup_section_id: insertedSection.id,
              name: criterion.name.trim() || `Criterion ${criterionIndex + 1}`,
              description: criterion.description.trim(),
              help_text: criterion.helpText.trim(),
              criterion_type: criterion.criterionType,
              max_points: criterionMaxPoints(criterion),
              is_required: criterion.isRequired || criterion.criterionType === 'required_gate',
              is_bonus: criterion.isBonus || criterion.criterionType === 'optional_bonus',
              sort_order: criterionIndex,
              config: criterion.config,
            })
            .select('*')
            .single()

          if (criterionError) throw criterionError
          const insertedCriterion = criterionData as CriterionRecord

          const optionRows = criterion.options.map((option, optionIndex) => ({
            criterion_id: insertedCriterion.id,
            label: option.label.trim() || `Option ${optionIndex + 1}`,
            value: option.value.trim() || labelToValue(option.label),
            points: toNumber(option.points),
            sort_order: optionIndex,
          }))

          if (optionRows.length) {
            const { error: optionError } = await supabase.from('setup_criterion_options').insert(optionRows)
            if (optionError) throw optionError
          }
        }
      }

      const thresholdRows = builderDraft.value.thresholds.map((threshold, index) => ({
        setup_version_id: version.id,
        label: threshold.label.trim() || `Grade ${index + 1}`,
        min_value: toNumber(threshold.minValue),
        max_value: toNumber(threshold.maxValue),
        value_type: threshold.valueType,
        description: threshold.description.trim(),
        display_token: threshold.displayToken.trim(),
        recommendation: threshold.recommendation.trim(),
        sort_order: index,
      }))

      if (thresholdRows.length) {
        const { error: thresholdError } = await supabase.from('setup_grade_thresholds').insert(thresholdRows)
        if (thresholdError) throw thresholdError
      }

      const { error: currentVersionError } = await supabase
        .from('trading_setups')
        .update({ current_version_id: version.id })
        .eq('id', setupId)
        .eq('user_id', currentUser.id)

      if (currentVersionError) throw currentVersionError
      await refreshSetups()
      selectedSetupId.value = setupId
      await editDraft(setupId)
    } catch (caught) {
      loadError.value = caught instanceof Error ? caught.message : String(caught)
      throw caught
    } finally {
      isSaving.value = false
    }
  }

  async function updateSetupState(setupId: string, patch: Partial<Pick<SetupRecord, 'is_active' | 'is_archived' | 'is_favorite'>>) {
    await auth.ensureAuthReady()
    const currentUser = auth.user.value
    if (!currentUser) throw new Error('You need to be logged in to update setups.')
    const { error } = await useSupabase().from('trading_setups').update(patch).eq('id', setupId).eq('user_id', currentUser.id)
    if (error) throw error
    await refreshSetups()
  }

  async function deleteSetup(setupId: string) {
    await auth.ensureAuthReady()
    const currentUser = auth.user.value
    if (!currentUser) throw new Error('You need to be logged in to delete setups.')
    const { error } = await useSupabase().from('trading_setups').delete().eq('id', setupId).eq('user_id', currentUser.id)
    if (error) throw error
    if (selectedSetupId.value === setupId) selectedSetupId.value = ''
    await refreshSetups()
  }

  function startEvaluation(setupId: string) {
    const detail = detailById.value[setupId]
    if (!detail) return
    selectedSetupId.value = setupId
    evaluationDraft.value = {
      setupId,
      setupVersionId: detail.version.id,
      tradeId: '',
      openTradeId: '',
      tradePlanId: '',
      evaluationType: 'pre_trade',
      notes: '',
      answers: {},
    }
    tradePlanDraft.value = blankTradePlanDraft(setupId)
  }

  function calculateEvaluation(detail: SetupVersionDetail | null, answers: Record<string, EvaluationAnswer>) {
    if (!detail) {
      return { rawScore: 0, maxScore: 0, normalizedPercentage: 0, gradeLabel: null as string | null, isValid: true, invalidReason: '' }
    }

    let rawScore = 0
    const failed: string[] = []

    for (const section of detail.sections) {
      for (const criterion of section.criteria) {
        const result = evaluateCriterion(criterion, answers[criterion.id ?? criterion.uid])
        rawScore += result.awardedPoints
        if (result.invalidReason) failed.push(result.invalidReason)
      }
    }

    const maxScore = calculateMaxScore(detail.sections)
    const normalizedPercentage = maxScore > 0 ? Math.min(100, (rawScore / maxScore) * 100) : 0
    const grade = findGrade(detail.thresholds, rawScore, normalizedPercentage)

    return {
      rawScore,
      maxScore,
      normalizedPercentage,
      gradeLabel: grade?.label ?? null,
      isValid: failed.length === 0,
      invalidReason: failed[0] ?? '',
    }
  }

  async function saveEvaluation() {
    await auth.ensureAuthReady()
    const currentUser = auth.user.value
    const detail = activeDetail.value
    if (!currentUser) throw new Error('You need to be logged in to save evaluations.')
    if (!detail) throw new Error('Select a setup before saving an evaluation.')

    const linkedTradeId = evaluationDraft.value.tradeId
    const linkedOpenTradeId = evaluationDraft.value.openTradeId
    const result = calculateEvaluation(detail, evaluationDraft.value.answers)
    const evaluationType =
      evaluationDraft.value.evaluationType === 'post_trade_review'
        ? 'post_trade_review'
        : 'pre_trade'

    if (evaluationType === 'post_trade_review' && !linkedTradeId && !linkedOpenTradeId) {
      throw new Error('Post-trade reviews must be linked to an active or closed trade.')
    }

    const supabase = useSupabase()
    const linkedTradePlanId = !linkedTradeId && !linkedOpenTradeId && evaluationType === 'pre_trade'
      ? await saveTradePlanDraft()
      : evaluationDraft.value.tradePlanId || null
    const { data: evaluationData, error: evaluationError } = await supabase
      .from('trade_setup_evaluations')
      .insert({
        user_id: currentUser.id,
        trade_id: evaluationDraft.value.tradeId || null,
        open_trade_id: evaluationDraft.value.openTradeId || null,
        trade_plan_id: linkedTradePlanId,
        setup_id: detail.setup.id,
        setup_version_id: detail.version.id,
        evaluation_type: evaluationType,
        raw_score: result.rawScore,
        max_score: result.maxScore,
        normalized_percentage: result.normalizedPercentage,
        grade_label: result.gradeLabel,
        is_valid: result.isValid,
        invalid_reason: result.invalidReason || null,
        notes: evaluationDraft.value.notes.trim(),
      })
      .select('*')
      .single()

    if (evaluationError) throw evaluationError
    const evaluation = evaluationData as EvaluationRecord
    const answerRows = detail.sections.flatMap((section) =>
      section.criteria.map((criterion) => {
        const key = criterion.id ?? criterion.uid
        const answer = evaluationDraft.value.answers[key] ?? {}
        const calculated = evaluateCriterion(criterion, answer)
        return {
          evaluation_id: evaluation.id,
          criterion_id: criterion.id,
          boolean_value: answer.booleanValue ?? null,
          numeric_value: answer.numericValue ?? null,
          text_value: answer.textValue ?? null,
          selected_option_id: answer.selectedOptionId ?? null,
          selected_options: answer.selectedOptionIds ?? [],
          awarded_points: calculated.awardedPoints,
          comment: answer.comment ?? '',
        }
      }).filter((row) => Boolean(row.criterion_id)),
    )

    if (answerRows.length) {
      const { error: answersError } = await supabase.from('trade_setup_evaluation_answers').insert(answerRows)
      if (answersError) throw answersError
    }

    if (linkedTradePlanId) {
      const { error: planEvaluationError } = await supabase
        .from('trade_plans')
        .update({ setup_evaluation_id: evaluation.id })
        .eq('id', linkedTradePlanId)
        .eq('user_id', currentUser.id)

      if (planEvaluationError) throw planEvaluationError
    }

    await refreshSetups()
    startEvaluation(detail.setup.id)
    evaluationDraft.value.tradeId = linkedTradeId
    evaluationDraft.value.openTradeId = linkedOpenTradeId
    evaluationDraft.value.evaluationType = evaluationType
  }

  async function saveTradePlanDraft() {
    await auth.ensureAuthReady()
    const currentUser = auth.user.value
    const detail = activeDetail.value
    if (!currentUser) throw new Error('You need to be logged in to save trade plans.')
    if (!detail && !tradePlanDraft.value.setupId) throw new Error('Select a setup before saving a trade plan.')
    if (!tradePlanDraft.value.symbol.trim()) throw new Error('Symbol is required for trade plans.')

    const setupId = tradePlanDraft.value.setupId || detail?.setup.id || null
    const payload = {
      user_id: currentUser.id,
      setup_id: setupId,
      setup_evaluation_id: tradePlanDraft.value.setupEvaluationId ?? null,
      symbol: tradePlanDraft.value.symbol.trim().toUpperCase(),
      direction: tradePlanDraft.value.direction,
      status: tradePlanDraft.value.status,
      timeframe: tradePlanDraft.value.timeframe.trim(),
      session: tradePlanDraft.value.session || null,
      planned_entry: toNumber(tradePlanDraft.value.plannedEntry),
      planned_stop_loss: toNumber(tradePlanDraft.value.plannedStopLoss),
      planned_take_profit: toNumber(tradePlanDraft.value.plannedTakeProfit),
      size: toNumber(tradePlanDraft.value.size),
      risk_percent: toNumber(tradePlanDraft.value.riskPercent),
      thesis: tradePlanDraft.value.thesis.trim(),
      trigger_notes: tradePlanDraft.value.triggerNotes.trim(),
      invalidation_notes: tradePlanDraft.value.invalidationNotes.trim(),
      chart_notes: tradePlanDraft.value.chartNotes.trim(),
    }

    if (tradePlanDraft.value.id) {
      const { data, error } = await useSupabase()
        .from('trade_plans')
        .update(payload)
        .eq('id', tradePlanDraft.value.id)
        .eq('user_id', currentUser.id)
        .select('*')
        .single()

      if (error) throw error
      tradePlanDraft.value = tradePlanDraftFromRecord(data as TradePlanRecord)
      await refreshSetups()
      return tradePlanDraft.value.id
    }

    const { data, error } = await useSupabase()
      .from('trade_plans')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw error
    tradePlanDraft.value = tradePlanDraftFromRecord(data as TradePlanRecord)
    await refreshSetups()
    return tradePlanDraft.value.id
  }

  function newTradePlanDraft(setupId = selectedSetupId.value) {
    tradePlanDraft.value = blankTradePlanDraft(setupId)
    evaluationDraft.value.tradePlanId = ''
  }

  function editTradePlanDraft(planId: string) {
    const plan = tradePlans.value.find((item) => item.id === planId)
    if (!plan) return
    tradePlanDraft.value = tradePlanDraftFromRecord(plan)
    if (plan.setup_id) {
      selectedSetupId.value = plan.setup_id
    }
    evaluationDraft.value.tradePlanId = plan.id
  }

  async function linkEvaluationToTrade(evaluationId: string, link: { tradeId?: string; openTradeId?: string }) {
    await auth.ensureAuthReady()
    const currentUser = auth.user.value
    if (!currentUser) throw new Error('You need to be logged in to link evaluations.')
    if (!link.tradeId && !link.openTradeId) throw new Error('Choose an active or closed trade first.')
    if (link.tradeId && link.openTradeId) throw new Error('Evaluation can only be linked to one trade.')

    const { error } = await useSupabase()
      .from('trade_setup_evaluations')
      .update({
        trade_id: link.tradeId || null,
        open_trade_id: link.openTradeId || null,
      })
      .eq('id', evaluationId)
      .eq('user_id', currentUser.id)

    if (error) throw error
    const evaluation = evaluations.value.find((item) => item.id === evaluationId)
    if (evaluation?.trade_plan_id) {
      await useSupabase()
        .from('trade_plans')
        .update({ status: 'triggered' })
        .eq('id', evaluation.trade_plan_id)
        .eq('user_id', currentUser.id)
    }
    await refreshSetups()
  }

  onMounted(() => {
    if (!hasLoaded.value && !isLoading.value) {
      void refreshSetups()
    }
  })

  return {
    criterionTypeOptions,
    templates,
    setupSummaries,
    detailById,
    evaluations,
    evaluationAnswersById,
    tradePlans,
    selectedSetupId,
    activeDetail,
    builderDraft,
    activeCriterionUid,
    activeBuilderCriterion,
    builderMaxScore,
    builderCriteriaCount,
    evaluationDraft,
    tradePlanDraft,
    evaluationResult,
    isLoading,
    isSaving,
    loadError,
    hasLoaded,
    refreshSetups,
    loadSetupDetail,
    newDraft,
    draftFromTemplate,
    editDraft,
    duplicateDraft,
    addSection,
    removeSection,
    addCriterion,
    removeCriterion,
    moveSection,
    moveCriterion,
    addCriterionOption,
    removeCriterionOption,
    addThreshold,
    removeThreshold,
    saveDraft,
    updateSetupState,
    deleteSetup,
    startEvaluation,
    calculateEvaluation,
    saveEvaluation,
    saveTradePlanDraft,
    newTradePlanDraft,
    editTradePlanDraft,
    linkEvaluationToTrade,
    calculateMaxScore,
  }
}
