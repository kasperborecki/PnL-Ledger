<script setup lang="ts">
import type { Ref } from 'vue'
import SectionCard from '~/components/ui/SectionCard.vue'
import {
  requireChoice,
  requireNumber,
  requireText,
  requireTimezone,
  validateImageFile,
} from '~/utils/validation'

type AssetClass = 'forex' | 'index' | 'commodity' | 'crypto' | 'stock'
type TransactionType = 'deposit' | 'withdrawal' | 'adjustment' | 'fee' | 'transfer_in' | 'transfer_out'

type InstrumentRow = {
  symbol: string
  display_name: string
  asset_class: AssetClass
  price_precision: number | string
  tick_size: number | string
  contract_size: number | string
  lot_step: number | string
  currency: string
  sort_order: number | string
  notes: string
  is_active: boolean
}

type TransactionRow = {
  id: string
  transaction_type: TransactionType
  amount: number | string
  currency: string
  happened_at: string
  notes: string
  trade_id: string | null
}

type LookupRow = {
  name: string
  description: string
  sort_order: number | string
  is_active: boolean
}

type InstrumentForm = {
  symbol: string
  displayName: string
  assetClass: AssetClass
  pricePrecision: number
  tickSize: number
  contractSize: number
  lotStep: number
  currency: string
  sortOrder: number
  notes: string
  isActive: boolean
}

type TransactionForm = {
  transactionType: TransactionType
  amount: number
  currency: string
  happenedAt: string
  notes: string
}

type LookupForm = {
  name: string
  description: string
  sortOrder: number
  isActive: boolean
}

type ProfileForm = {
  displayName: string
  timezone: string
}

const BASE_CURRENCY = 'USD' as const

const ledger = useLedger()
const auth = useAuth()
const supabase = useSupabase()

const loading = ref(false)
const error = ref<string | null>(null)
const savingProfile = ref(false)
const savingInstrument = ref(false)
const savingStrategy = ref(false)
const savingEmotion = ref(false)
const savingTransaction = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)

const instruments = ref<InstrumentRow[]>([])
const strategyRows = ref<LookupRow[]>([])
const emotionRows = ref<LookupRow[]>([])
const transactions = ref<TransactionRow[]>([])
const editingSymbol = ref<string | null>(null)
const editingStrategyName = ref<string | null>(null)
const editingEmotionName = ref<string | null>(null)
const avatarFile = ref<File | null>(null)
const avatarPreviewUrl = ref<string | null>(null)
const avatarRemoved = ref(false)
const instrumentSearch = ref('')
const strategySearch = ref('')
const emotionSearch = ref('')

const profileForm = reactive<ProfileForm>({
  displayName: '',
  timezone: 'Europe/Warsaw',
})

const transactionTypeOptions: Array<{ label: string; value: TransactionType }> = [
  { label: 'Deposit', value: 'deposit' },
  { label: 'Withdrawal', value: 'withdrawal' },
  { label: 'Adjustment', value: 'adjustment' },
  { label: 'Fee', value: 'fee' },
  { label: 'Transfer In', value: 'transfer_in' },
  { label: 'Transfer Out', value: 'transfer_out' },
]

const assetClassOptions: Array<{ label: string; value: AssetClass }> = [
  { label: 'Index', value: 'index' },
  { label: 'Forex', value: 'forex' },
  { label: 'Commodity', value: 'commodity' },
  { label: 'Crypto', value: 'crypto' },
  { label: 'Stock', value: 'stock' },
]

const instrumentForm = reactive<InstrumentForm>({
  symbol: '',
  displayName: '',
  assetClass: 'index',
  pricePrecision: 1,
  tickSize: 0.1,
  contractSize: 1,
  lotStep: 0.01,
  currency: BASE_CURRENCY,
  sortOrder: 0,
  notes: '',
  isActive: true,
})

const strategyForm = reactive<LookupForm>({
  name: '',
  description: '',
  sortOrder: 0,
  isActive: true,
})

const emotionForm = reactive<LookupForm>({
  name: '',
  description: '',
  sortOrder: 0,
  isActive: true,
})

const transactionForm = reactive<TransactionForm>({
  transactionType: 'deposit',
  amount: 0,
  currency: BASE_CURRENCY,
  happenedAt: new Date().toISOString().slice(0, 16),
  notes: '',
})

const startingBalanceDraft = ref(0)

function nowLocalValue() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 16)
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0
}

function syncProfileForm() {
  const profile = auth.profile.value
  profileForm.displayName = profile?.displayName ?? ''
  profileForm.timezone = profile?.timezone ?? 'Europe/Warsaw'
  avatarFile.value = null
  avatarRemoved.value = false
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value)
    avatarPreviewUrl.value = null
  }
  if (avatarInput.value) {
    avatarInput.value.value = ''
  }
}

function resetInstrumentForm() {
  editingSymbol.value = null
  Object.assign(instrumentForm, {
    symbol: '',
    displayName: '',
    assetClass: 'index',
    pricePrecision: 1,
    tickSize: 0.1,
    contractSize: 1,
    lotStep: 0.01,
    currency: BASE_CURRENCY,
    sortOrder: 0,
    notes: '',
    isActive: true,
  } satisfies InstrumentForm)
}

function resetStrategyForm() {
  editingStrategyName.value = null
  Object.assign(strategyForm, {
    name: '',
    description: '',
    sortOrder: 0,
    isActive: true,
  } satisfies LookupForm)
}

function resetEmotionForm() {
  editingEmotionName.value = null
  Object.assign(emotionForm, {
    name: '',
    description: '',
    sortOrder: 0,
    isActive: true,
  } satisfies LookupForm)
}

function resetTransactionForm() {
  Object.assign(transactionForm, {
    transactionType: 'deposit',
    amount: 0,
    currency: BASE_CURRENCY,
    happenedAt: nowLocalValue(),
    notes: '',
  } satisfies TransactionForm)
}

function syncStartingBalanceDraft() {
  startingBalanceDraft.value = auth.startingBalance.value
}

function hydrateLookupForm(row: LookupRow, form: LookupForm, editingKey: Ref<string | null>) {
  editingKey.value = row.name
  Object.assign(form, {
    name: row.name,
    description: row.description ?? '',
    sortOrder: toNumber(row.sort_order),
    isActive: row.is_active,
  } satisfies LookupForm)
}

function getAvatarStoragePath(avatarUrl: string | null | undefined) {
  if (!avatarUrl) {
    return null
  }

  const marker = '/storage/v1/object/public/profile-avatars/'
  const markerIndex = avatarUrl.indexOf(marker)
  if (markerIndex === -1) {
    return null
  }

  return decodeURIComponent(avatarUrl.slice(markerIndex + marker.length))
}

async function deleteAvatarFromStorage(avatarUrl: string | null | undefined) {
  const storagePath = getAvatarStoragePath(avatarUrl)
  if (!storagePath) {
    return
  }

  const { error: deleteError } = await supabase.storage
    .from('profile-avatars')
    .remove([storagePath])

  if (deleteError) {
    console.warn('Failed to remove previous avatar', deleteError)
  }
}

function handleAvatarSelected(event: Event) {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0] ?? null

  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value)
    avatarPreviewUrl.value = null
  }

  avatarFile.value = file
  avatarRemoved.value = false

  if (file) {
    avatarPreviewUrl.value = URL.createObjectURL(file)
  }
}

function formatProfileSaveError(caught: unknown) {
  const message = caught instanceof Error ? caught.message : String(caught)
  if (message.toLowerCase().includes('bucket not found')) {
    return 'Missing Supabase bucket "profile-avatars". Run supabase/profile_avatars_bucket.sql first.'
  }

  return message
}

function removeAvatarSelection() {
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value)
    avatarPreviewUrl.value = null
  }

  avatarFile.value = null
  avatarRemoved.value = true

  if (avatarInput.value) {
    avatarInput.value.value = ''
  }
}

function hydrateInstrumentForm(row: InstrumentRow) {
  editingSymbol.value = row.symbol
  Object.assign(instrumentForm, {
    symbol: row.symbol,
    displayName: row.display_name,
    assetClass: row.asset_class,
    pricePrecision: toNumber(row.price_precision),
    tickSize: toNumber(row.tick_size),
    contractSize: toNumber(row.contract_size),
    lotStep: toNumber(row.lot_step),
    currency: row.currency || BASE_CURRENCY,
    sortOrder: toNumber(row.sort_order),
    notes: row.notes ?? '',
    isActive: row.is_active,
  } satisfies InstrumentForm)
}

async function loadManagementData() {
  await auth.ensureAuthReady()
  const currentUser = auth.user.value
  if (!currentUser) {
    instruments.value = []
    transactions.value = []
    startingBalanceDraft.value = 0
    return
  }

  loading.value = true
  error.value = null

  try {
    const [
      { data: instrumentRows, error: instrumentError },
      { data: strategyRowsData, error: strategyError },
      { data: emotionRowsData, error: emotionError },
      { data: transactionRows, error: transactionError },
    ] = await Promise.all([
      supabase
        .from('instruments')
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('display_name', { ascending: true }),
      supabase
        .from('trade_setups')
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true }),
      supabase
        .from('trade_emotions')
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true }),
      supabase
        .from('account_transactions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('happened_at', { ascending: false }),
    ])

    if (instrumentError) throw instrumentError
    if (strategyError) throw strategyError
    if (emotionError) throw emotionError
    if (transactionError) throw transactionError

    instruments.value = (instrumentRows ?? []) as InstrumentRow[]
    strategyRows.value = (strategyRowsData ?? []) as LookupRow[]
    emotionRows.value = (emotionRowsData ?? []) as LookupRow[]
    transactions.value = (transactionRows ?? []) as TransactionRow[]

    if (!editingSymbol.value) {
      resetInstrumentForm()
    }

    if (!editingStrategyName.value) {
      resetStrategyForm()
    }

    if (!editingEmotionName.value) {
      resetEmotionForm()
    }

    resetTransactionForm()
    syncStartingBalanceDraft()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    loading.value = false
  }
}

async function refreshEverything() {
  await Promise.all([
    ledger.refreshLedger(),
    auth.refreshAuth(),
  ])
  await loadManagementData()
}

async function saveProfile() {
  await auth.ensureAuthReady()
  const currentUser = auth.user.value
  if (!currentUser) {
    return
  }

  savingProfile.value = true
  error.value = null

  const currentProfile = auth.profile.value
  let avatarUrl = currentProfile?.avatarUrl ?? null
  const previousAvatarUrl = currentProfile?.avatarUrl ?? null

  try {
    const displayName = requireText(profileForm.displayName, 'Display name', { allowEmpty: true, maxLength: 60 })
      || currentUser.email?.split('@')[0]
      || 'Trader'
    const timezone = requireTimezone(profileForm.timezone || 'Europe/Warsaw')
    const safeAvatarFile = validateImageFile(avatarFile.value, 'Avatar image', {
      allowEmpty: true,
      maxBytes: 5 * 1024 * 1024,
    })

    if (safeAvatarFile) {
      const fileExtension = avatarFile.value.name.includes('.')
        ? `.${avatarFile.value.name.split('.').pop()?.toLowerCase() ?? 'png'}`
        : '.png'
      const filePath = `${currentUser.id}/${crypto.randomUUID()}${fileExtension}`
      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(filePath, safeAvatarFile, {
          upsert: true,
          contentType: safeAvatarFile.type || 'image/png',
        })

      if (uploadError) {
        throw uploadError
      }

      const { data: publicData } = supabase.storage
        .from('profile-avatars')
        .getPublicUrl(filePath)

      avatarUrl = publicData.publicUrl
    } else if (avatarRemoved.value) {
      avatarUrl = null
    }

    const profilePayload: Record<string, string | null> = {
      display_name: displayName,
      timezone,
      base_currency: BASE_CURRENCY,
    }

    if (avatarFile.value || avatarRemoved.value) {
      profilePayload.avatar_url = avatarUrl
    }

    const { error: saveError } = await supabase
      .from('profiles')
      .update(profilePayload)
      .eq('id', currentUser.id)

    if (saveError) {
      throw saveError
    }

    if (previousAvatarUrl && previousAvatarUrl !== avatarUrl) {
      await deleteAvatarFromStorage(previousAvatarUrl)
    }

    if (avatarPreviewUrl.value) {
      URL.revokeObjectURL(avatarPreviewUrl.value)
      avatarPreviewUrl.value = null
    }
    avatarFile.value = null
    avatarRemoved.value = false
    if (avatarInput.value) {
      avatarInput.value.value = ''
    }

    await refreshEverything()
  } catch (caught) {
    error.value = formatProfileSaveError(caught)
  } finally {
    savingProfile.value = false
  }
}

async function saveInstrument() {
  await auth.ensureAuthReady()
  const currentUser = auth.user.value
  if (!currentUser) {
    return
  }

  savingInstrument.value = true
  error.value = null

  try {
    const symbol = requireText(instrumentForm.symbol, 'Symbol', {
      maxLength: 20,
      pattern: /^[A-Z0-9/_-]+$/,
    }).toUpperCase()
    const displayName = requireText(instrumentForm.displayName, 'Display name', {
      maxLength: 80,
    })
    const payload = {
      symbol,
      display_name: displayName,
      asset_class: instrumentForm.assetClass,
      price_precision: requireNumber(instrumentForm.pricePrecision, 'Price precision', { min: 0, max: 8, integer: true }),
      tick_size: requireNumber(instrumentForm.tickSize, 'Tick size', { min: 0.00000001, max: 1_000_000_000 }),
      contract_size: requireNumber(instrumentForm.contractSize, 'Contract size', { min: 0.0001, max: 1_000_000_000 }),
      lot_step: requireNumber(instrumentForm.lotStep, 'Lot step', { min: 0.0001, max: 1_000_000_000 }),
      currency: BASE_CURRENCY,
      sort_order: requireNumber(instrumentForm.sortOrder, 'Sort order', { integer: true, min: -100000, max: 100000 }),
      notes: requireText(instrumentForm.notes, 'Notes', { allowEmpty: true, maxLength: 500 }),
      is_active: instrumentForm.isActive,
    }

    const { error: saveError } = await supabase
      .from('instruments')
      .upsert(payload, { onConflict: 'symbol' })

    if (saveError) throw saveError

    resetInstrumentForm()
    await refreshEverything()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    savingInstrument.value = false
  }
}

async function toggleInstrumentActive(symbol: string, nextState: boolean) {
  error.value = null
  const { error: updateError } = await supabase
    .from('instruments')
    .update({ is_active: nextState })
    .eq('symbol', symbol)

  if (updateError) {
    error.value = updateError.message
    return
  }

  await refreshEverything()
}

async function saveLookupRow(
  table: 'trade_setups' | 'trade_emotions',
  form: LookupForm,
  editingKey: Ref<string | null>,
) {
  await auth.ensureAuthReady()
  if (!auth.user.value) {
    return
  }

  const normalizedName = requireText(form.name, 'Name', { maxLength: 60 })
  const normalizedDescription = requireText(form.description, 'Description', { allowEmpty: true, maxLength: 500 })

  const payload = {
    name: normalizedName,
    description: normalizedDescription,
    sort_order: requireNumber(form.sortOrder, 'Sort order', { integer: true, min: -100000, max: 100000 }),
    is_active: form.isActive,
  }

  const originalName = editingKey.value
  const collectionField = table === 'trade_setups' ? 'setup' : 'emotion'

  if (originalName) {
    const { error: updateError } = await supabase
      .from(table)
      .update(payload)
      .eq('name', originalName)

    if (updateError) {
      throw updateError
    }

    if (originalName !== normalizedName) {
      const { error: renameError } = await supabase
        .from('trades')
        .update({ [collectionField]: normalizedName })
        .eq(collectionField, originalName)

      if (renameError) {
        throw renameError
      }
    }
  } else {
    const { error: insertError } = await supabase.from(table).insert(payload)
    if (insertError) {
      throw insertError
    }
  }

  editingKey.value = null
  Object.assign(form, {
    name: '',
    description: '',
    sortOrder: 0,
    isActive: true,
  } satisfies LookupForm)
}

async function saveStrategy() {
  savingStrategy.value = true
  error.value = null

  try {
    await saveLookupRow('trade_setups', strategyForm, editingStrategyName)
    await refreshEverything()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    savingStrategy.value = false
  }
}

async function saveEmotion() {
  savingEmotion.value = true
  error.value = null

  try {
    await saveLookupRow('trade_emotions', emotionForm, editingEmotionName)
    await refreshEverything()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    savingEmotion.value = false
  }
}

async function toggleLookupActive(
  table: 'trade_setups' | 'trade_emotions',
  name: string,
  nextState: boolean,
) {
  error.value = null
  const { error: updateError } = await supabase
    .from(table)
    .update({ is_active: nextState })
    .eq('name', name)

  if (updateError) {
    error.value = updateError.message
    return
  }

  await refreshEverything()
}

function editStrategy(row: LookupRow) {
  hydrateLookupForm(row, strategyForm, editingStrategyName)
}

function editEmotion(row: LookupRow) {
  hydrateLookupForm(row, emotionForm, editingEmotionName)
}

async function saveTransaction() {
  await auth.ensureAuthReady()
  const currentUser = auth.user.value
  if (!currentUser) {
    return
  }

  savingTransaction.value = true
  error.value = null

  try {
    const rawAmount = requireNumber(transactionForm.amount, 'Amount', { min: 0.01, max: 1_000_000_000 })
    const transactionType = requireChoice(
      transactionForm.transactionType,
      'Transaction type',
      transactionTypeOptions.map((option) => option.value),
    ) as TransactionType
    const happenedAt = new Date(transactionForm.happenedAt)
    if (Number.isNaN(happenedAt.getTime())) {
      throw new Error('Transaction date and time must be valid.')
    }

    const amount = transactionType === 'withdrawal' || transactionType === 'fee' || transactionType === 'transfer_out'
      ? -rawAmount
      : rawAmount

    if (amount === 0) {
      throw new Error('Transaction amount cannot be zero.')
    }

    const { error: saveError } = await supabase.from('account_transactions').insert({
      user_id: currentUser.id,
      transaction_type: transactionType,
      amount,
      currency: BASE_CURRENCY,
      happened_at: happenedAt.toISOString(),
      notes: requireText(transactionForm.notes, 'Notes', { allowEmpty: true, maxLength: 500 }),
    })

    if (saveError) throw saveError

    resetTransactionForm()
    await refreshEverything()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    savingTransaction.value = false
  }
}

async function deleteTransaction(id: string) {
  if (!window.confirm('Delete this account transaction?')) {
    return
  }

  const { error: deleteError } = await supabase.from('account_transactions').delete().eq('id', id)
  if (deleteError) {
    error.value = deleteError.message
    return
  }

  await refreshEverything()
}

async function saveStartingBalance() {
  await auth.ensureAuthReady()
  const currentUser = auth.user.value
  if (!currentUser) {
    return
  }

  error.value = null

  const { error: saveError } = await supabase
    .from('profiles')
    .update({ starting_balance: requireNumber(startingBalanceDraft.value, 'Starting balance', { min: 0, max: 1_000_000_000 }) })
    .eq('id', currentUser.id)

  if (saveError) {
    error.value = saveError.message
    return
  }

  await refreshEverything()
}

function transactionLabel(type: TransactionType) {
  return transactionTypeOptions.find((option) => option.value === type)?.label ?? type
}

const currentBalance = computed(() => auth.currentBalance.value)
const startingBalance = computed(() => auth.startingBalance.value)
const transactionNet = computed(() => transactions.value.reduce((sum, row) => sum + toNumber(row.amount), 0))
const activeInstruments = computed(() => instruments.value.filter((instrument) => instrument.is_active))
const filteredInstruments = computed(() => {
  const query = instrumentSearch.value.trim().toLowerCase()
  if (!query) {
    return instruments.value
  }

  return instruments.value.filter((instrument) =>
    [instrument.symbol, instrument.display_name, instrument.asset_class, instrument.notes]
      .join(' ')
      .toLowerCase()
      .includes(query),
  )
})

const filteredStrategies = computed(() => {
  const query = strategySearch.value.trim().toLowerCase()
  if (!query) {
    return strategyRows.value
  }

  return strategyRows.value.filter((row) =>
    [row.name, row.description]
      .join(' ')
      .toLowerCase()
      .includes(query),
  )
})

const filteredEmotions = computed(() => {
  const query = emotionSearch.value.trim().toLowerCase()
  if (!query) {
    return emotionRows.value
  }

  return emotionRows.value.filter((row) =>
    [row.name, row.description]
      .join(' ')
      .toLowerCase()
      .includes(query),
  )
})

const totalInstrumentCount = computed(() => instruments.value.length)
const activeInstrumentCount = computed(() => activeInstruments.value.length)
const activeStrategyCount = computed(() => strategyRows.value.filter((row) => row.is_active).length)
const activeEmotionCount = computed(() => emotionRows.value.filter((row) => row.is_active).length)
const profileAvatarSrc = computed(() => {
  if (avatarPreviewUrl.value) {
    return avatarPreviewUrl.value
  }

  if (avatarRemoved.value) {
    return null
  }

  return auth.profile.value?.avatarUrl ?? null
})

watch(
  () => auth.profile.value,
  () => {
    syncProfileForm()
  },
  { immediate: true },
)

onMounted(() => {
  void refreshEverything()
})

onBeforeUnmount(() => {
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value)
  }
})
</script>

<template>
  <div class="page-stack management-stack">
    <div v-if="error" class="sync-banner">
      {{ error }}
    </div>

    <SectionCard
      title="Profile"
      subtitle="Manage your public identity, avatar and base preferences."
    >
      <div class="profile-layout">
        <div class="profile-avatar-pane glass-card glass-card--soft">
          <div class="profile-avatar-preview">
            <img
              v-if="profileAvatarSrc"
              :src="profileAvatarSrc"
              :alt="profileForm.displayName || 'Profile avatar'"
              class="profile-avatar-image"
            />
            <span v-else class="profile-avatar-initials">{{ auth.initials.value }}</span>
          </div>

          <div class="profile-avatar-copy">
            <div class="profile-avatar-title">Avatar</div>
            <div class="muted">
              PNG, JPG or WEBP. Best if it is square and under 5 MB.
            </div>
          </div>

          <label class="upload-dropzone profile-upload">
            <div class="upload-dropzone-copy">
              <strong>Choose new photo</strong>
              <span>Click to upload from your device.</span>
            </div>
            <v-icon size="18">mdi-cloud-upload</v-icon>
            <input
              ref="avatarInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              class="upload-input"
              @change="handleAvatarSelected"
            >
          </label>

          <div class="profile-avatar-actions">
            <PButton
              label="Remove avatar"
              severity="secondary"
              text
              class="input-dark"
              :disabled="!profileAvatarSrc && !avatarFile"
              @click="removeAvatarSelection"
            />
          </div>
        </div>

        <div class="profile-form-pane">
          <div class="management-form management-form--grid">
            <label class="field">
              <span>Display name</span>
              <PInputText
                v-model="profileForm.displayName"
                class="input-dark"
                placeholder="Your display name"
              />
            </label>

            <label class="field">
              <span>Email</span>
              <input
                :value="auth.user.value?.email ?? ''"
                type="text"
                class="form-input"
                disabled
              >
            </label>

            <label class="field">
              <span>Timezone</span>
              <PInputText
                v-model="profileForm.timezone"
                class="input-dark"
                placeholder="Europe/Warsaw"
              />
            </label>

            <label class="field">
              <span>Base currency</span>
              <div class="field-static">USD</div>
            </label>
          </div>

          <div class="management-action-row profile-action-row">
            <div class="muted">
              Avatar is stored in Supabase Storage and will appear in the sidebar after save.
            </div>
            <PButton
              label="Save profile"
              icon="pi pi-save"
              severity="success"
              class="input-dark action-primary"
              :loading="savingProfile"
              @click="saveProfile"
            />
          </div>
        </div>
      </div>
    </SectionCard>

    <div class="management-summary">
      <div class="management-stat glass-card">
        <div class="detail-label">Starting Balance</div>
        <div class="detail-value">{{ ledger.formatMoney(startingBalance) }}</div>
        <div class="muted">Defined manually in profile</div>
      </div>
      <div class="management-stat glass-card">
        <div class="detail-label">Current Balance</div>
        <div class="detail-value" :class="currentBalance >= 0 ? 'positive' : 'negative'">
          {{ ledger.formatMoney(currentBalance) }}
        </div>
        <div class="muted">Starting balance + trades + transactions</div>
      </div>
      <div class="management-stat glass-card">
        <div class="detail-label">Transactions</div>
        <div class="detail-value">{{ ledger.formatNumber(transactions.length) }}</div>
        <div class="muted" :class="transactionNet >= 0 ? 'positive' : 'negative'">
          {{ ledger.formatMoney(transactionNet) }} net flow
        </div>
      </div>
      <div class="management-stat glass-card">
        <div class="detail-label">Instruments</div>
        <div class="detail-value">{{ activeInstrumentCount }}/{{ totalInstrumentCount }}</div>
        <div class="muted">Active symbols in the dictionary</div>
      </div>
      <div class="management-stat glass-card">
        <div class="detail-label">Strategies</div>
        <div class="detail-value">{{ activeStrategyCount }}/{{ strategyRows.length }}</div>
        <div class="muted">Setups available in the trade composer</div>
      </div>
    </div>

    <SectionCard
      title="Account Balance"
      subtitle="Set the base balance and keep the equity figure in sync."
    >
      <div class="management-inline">
        <label class="field">
          <span>Starting balance</span>
          <input
            v-model.number="startingBalanceDraft"
            type="number"
            step="0.01"
            min="0"
            class="form-input form-input--number"
          >
        </label>

        <label class="field">
          <span>Base currency</span>
          <div class="field-static">USD</div>
        </label>

        <div class="management-action-box">
          <div class="muted">The current balance updates automatically from trades and cash movements.</div>
          <PButton
            label="Save starting balance"
            icon="pi pi-save"
            severity="success"
            class="input-dark action-primary"
            :loading="loading"
            @click="saveStartingBalance"
          />
        </div>
      </div>
    </SectionCard>

    <PositionCalculator :default-starting-balance="startingBalance" />

    <div class="two-col management-grid">
      <SectionCard
        title="Account Transactions"
        subtitle="Add deposits, withdrawals and corrections."
      >
        <div class="stack">
          <div class="management-form management-form--grid">
            <label class="field">
              <span>Type</span>
              <PDropdown
                v-model="transactionForm.transactionType"
                :options="transactionTypeOptions"
                option-label="label"
                option-value="value"
                class="input-dark"
              />
            </label>

            <label class="field">
              <span>Amount</span>
              <input
                v-model.number="transactionForm.amount"
                type="number"
                step="0.01"
                class="form-input form-input--number"
              >
            </label>

            <label class="field">
              <span>Date & time</span>
              <input v-model="transactionForm.happenedAt" type="datetime-local" class="form-input" />
            </label>

            <label class="field field--full">
              <span>Notes</span>
              <PTextarea
                v-model="transactionForm.notes"
                auto-resize
                rows="3"
                class="input-dark"
                placeholder="Optional note..."
              />
            </label>
          </div>

          <div class="management-action-row">
            <div class="muted">
              Signed amount is handled automatically for withdrawals, fees and transfers out.
            </div>
            <PButton
              label="Add transaction"
              icon="pi pi-plus"
              severity="success"
              class="input-dark action-primary"
              :loading="savingTransaction"
              @click="saveTransaction"
            />
          </div>

          <div class="management-list management-list--scroll">
            <div
              v-for="row in transactions"
              :key="row.id"
              class="management-row"
            >
              <div>
                <div class="management-row-title">{{ transactionLabel(row.transaction_type) }}</div>
                <div class="management-row-meta">{{ new Date(row.happened_at).toLocaleString() }} | {{ row.currency }}</div>
                <div class="management-row-note">
                  {{ row.notes || 'No notes' }}
                </div>
              </div>

              <div class="management-row-value" :class="Number(row.amount) >= 0 ? 'positive' : 'negative'">
                {{ ledger.formatSignedMoney(toNumber(row.amount)) }}
              </div>

              <PButton
                icon="pi pi-trash"
                severity="danger"
                text
                class="input-dark action-danger"
                @click="deleteTransaction(row.id)"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Symbol Dictionary"
        subtitle="Add, edit and deactivate symbols from the app."
      >
        <div class="stack">
          <label class="field">
            <span>Search symbols</span>
            <PInputText
              v-model="instrumentSearch"
              class="input-dark"
              placeholder="NAS100, forex, notes..."
            />
          </label>

          <div class="management-form management-form--grid">
            <label class="field">
              <span>Symbol</span>
              <PInputText
                v-model="instrumentForm.symbol"
                class="input-dark"
                :disabled="!!editingSymbol"
                placeholder="NAS100"
              />
            </label>

            <label class="field">
              <span>Display name</span>
              <PInputText
                v-model="instrumentForm.displayName"
                class="input-dark"
                placeholder="Nasdaq 100"
              />
            </label>

            <label class="field">
              <span>Asset class</span>
              <PDropdown
                v-model="instrumentForm.assetClass"
                :options="assetClassOptions"
                option-label="label"
                option-value="value"
                class="input-dark"
              />
            </label>

            <label class="field">
              <span>Precision</span>
              <input
                v-model.number="instrumentForm.pricePrecision"
                type="number"
                step="1"
                min="0"
                max="8"
                class="form-input form-input--number"
              >
            </label>

            <label class="field">
              <span>Sort order</span>
              <input
                v-model.number="instrumentForm.sortOrder"
                type="number"
                step="1"
                class="form-input form-input--number"
              >
            </label>

            <label class="field">
              <span>Tick size</span>
              <input
                v-model.number="instrumentForm.tickSize"
                type="number"
                step="0.00000001"
                class="form-input form-input--number"
              >
            </label>

            <label class="field">
              <span>Contract size</span>
              <input
                v-model.number="instrumentForm.contractSize"
                type="number"
                step="0.0001"
                class="form-input form-input--number"
              >
            </label>

            <label class="field">
              <span>Lot step</span>
              <input
                v-model.number="instrumentForm.lotStep"
                type="number"
                step="0.0001"
                class="form-input form-input--number"
              >
            </label>

            <label class="field field--full">
              <span>Notes</span>
              <PTextarea
                v-model="instrumentForm.notes"
                auto-resize
                rows="3"
                class="input-dark"
                placeholder="Broker-specific notes, contract details..."
              />
            </label>

            <label class="field field--full">
              <span>Status</span>
              <PSelectButton
                v-model="instrumentForm.isActive"
                class="input-dark"
                :options="[
                  { label: 'Active', value: true },
                  { label: 'Hidden', value: false },
                ]"
                option-label="label"
                option-value="value"
              />
            </label>
          </div>

          <div class="management-action-row">
            <div class="muted">
              {{ editingSymbol ? `Editing ${editingSymbol}` : 'Create a new symbol and it will appear in trade creation.' }}
            </div>
            <div class="d-flex ga-2 flex-wrap">
              <PButton
                v-if="editingSymbol"
                label="Cancel edit"
                severity="secondary"
                text
                class="input-dark action-cancel"
                @click="resetInstrumentForm"
              />
              <PButton
                :label="editingSymbol ? 'Update symbol' : 'Add symbol'"
                icon="pi pi-save"
                severity="success"
                class="input-dark action-primary"
                :loading="savingInstrument"
                @click="saveInstrument"
              />
            </div>
          </div>

          <div class="management-list management-list--scroll">
            <div
              v-for="instrument in filteredInstruments"
              :key="instrument.symbol"
              class="management-row management-row--instrument"
            >
              <div>
                <div class="management-row-title">{{ instrument.symbol }}</div>
                <div class="management-row-meta">{{ instrument.display_name }} | {{ instrument.asset_class }} | sort {{ instrument.sort_order }} | precision {{ instrument.price_precision }}</div>
                <div class="management-row-note">tick {{ instrument.tick_size }} | contract {{ instrument.contract_size }} | lot {{ instrument.lot_step }}</div>
              </div>

              <PTag :value="instrument.is_active ? 'Active' : 'Hidden'" :severity="instrument.is_active ? 'success' : 'secondary'" />

              <div class="d-flex ga-2 flex-wrap justify-end">
                <PButton
                  icon="pi pi-pencil"
                  severity="warning"
                  text
                  class="input-dark action-edit"
                  @click="hydrateInstrumentForm(instrument)"
                />
                <PButton
                  :label="instrument.is_active ? 'Hide' : 'Restore'"
                  :severity="instrument.is_active ? 'danger' : 'secondary'"
                  text
                  :class="instrument.is_active ? 'input-dark action-danger' : 'input-dark action-neutral'"
                  @click="toggleInstrumentActive(instrument.symbol, !instrument.is_active)"
                />
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>

    <div class="two-col management-grid">
      <SectionCard
        title="Strategy Dictionary"
        subtitle="Add new setups for trade entry and analytics."
      >
        <div class="stack">
          <label class="field">
            <span>Search strategies</span>
            <PInputText
              v-model="strategySearch"
              class="input-dark"
              placeholder="Breakout, pullback, notes..."
            />
          </label>

          <div class="management-form management-form--grid">
            <label class="field">
              <span>Name</span>
              <PInputText
                v-model="strategyForm.name"
                class="input-dark"
                placeholder="Opening Range Breakout"
              />
            </label>

            <label class="field">
              <span>Sort order</span>
              <input
                v-model.number="strategyForm.sortOrder"
                type="number"
                step="1"
                class="form-input form-input--number"
              >
            </label>

            <label class="field field--full">
              <span>Description</span>
              <PTextarea
                v-model="strategyForm.description"
                auto-resize
                rows="3"
                class="input-dark"
                placeholder="What makes this setup valid?"
              />
            </label>

            <label class="field field--full">
              <span>Status</span>
              <PSelectButton
                v-model="strategyForm.isActive"
                class="input-dark"
                :options="[
                  { label: 'Active', value: true },
                  { label: 'Hidden', value: false },
                ]"
                option-label="label"
                option-value="value"
              />
            </label>
          </div>

          <div class="management-action-row">
            <div class="muted">
              {{ editingStrategyName ? `Editing ${editingStrategyName}` : 'Add a setup and it will appear in the trade composer dropdown.' }}
            </div>
            <div class="d-flex ga-2 flex-wrap">
              <PButton
                v-if="editingStrategyName"
                label="Cancel edit"
                severity="secondary"
                text
                class="input-dark action-cancel"
                @click="resetStrategyForm"
              />
              <PButton
                :label="editingStrategyName ? 'Update strategy' : 'Add strategy'"
                icon="pi pi-save"
                severity="success"
                class="input-dark action-primary"
                :loading="savingStrategy"
                @click="saveStrategy"
              />
            </div>
          </div>

          <div class="management-list management-list--scroll">
            <div
              v-for="row in filteredStrategies"
              :key="row.name"
              class="management-row management-row--instrument"
            >
              <div>
                <div class="management-row-title">{{ row.name }}</div>
                <div class="management-row-meta">order {{ row.sort_order }}</div>
                <div class="management-row-note">{{ row.description || 'No description' }}</div>
              </div>

              <PTag :value="row.is_active ? 'Active' : 'Hidden'" :severity="row.is_active ? 'success' : 'secondary'" />

              <div class="d-flex ga-2 flex-wrap justify-end">
                <PButton
                  icon="pi pi-pencil"
                  severity="warning"
                  text
                  class="input-dark action-edit"
                  @click="editStrategy(row)"
                />
                <PButton
                  :label="row.is_active ? 'Hide' : 'Restore'"
                  :severity="row.is_active ? 'danger' : 'secondary'"
                  text
                  :class="row.is_active ? 'input-dark action-danger' : 'input-dark action-neutral'"
                  @click="toggleLookupActive('trade_setups', row.name, !row.is_active)"
                />
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

    </div>
  </div>
</template>
