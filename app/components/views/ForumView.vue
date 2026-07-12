<script setup lang="ts">
import SectionCard from '~/components/ui/SectionCard.vue'
import { validateImageFile } from '~/utils/validation'

type ForumTradeRow = {
  id: string
  user_id: string
  symbol: string
  trade_date: string
  trade_time: string
  direction: 'Long' | 'Short'
  setup: string
  session: string
  emotion: string
  result: 'Win' | 'Loss' | 'BE'
  net_pnl: number | string
  gross_pnl: number | string
  commission: number | string
  rr: number | string
  hold_minutes: number
  entry: number | string
  exit: number | string
  stop_loss: number | string
  take_profit: number | string
  size: number | string
  risk_percent: number | string
  why_entered: string
  what_went_well: string
  what_to_improve: string
  notes: string
  tags: string[]
  created_at: string
}

type ForumScreenshotRow = {
  trade_id: string
  slot: number
  label: string
  storage_path: string | null
  public_url: string | null
}

type ForumCommentRow = {
  id: string
  trade_id: string
  user_id: string
  body: string
  image_storage_path: string | null
  image_public_url: string | null
  created_at: string
}

type ForumProfileRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

type TraderStats = {
  userId: string
  totalTrades: number
  wins: number
  losses: number
  breakeven: number
  netPnl: number
  winRate: number
  avgRR: number
  avgHoldMinutes: number
  bestTrade: ForumTradeRow | null
  worstTrade: ForumTradeRow | null
  symbols: string[]
  recentTrades: ForumTradeRow[]
}

const screenshotBucket = 'trade-screenshots'
const commentImageBucket = 'forum-comment-images'

const supabase = useSupabase()
const auth = useAuth()
const ledger = useLedger()

const isLoading = ref(false)
const isSubmitting = ref(false)
const forumError = ref<string | null>(null)
const searchQuery = ref('')
const selectedTradeId = ref('')
const trades = ref<ForumTradeRow[]>([])
const screenshotsByTrade = ref<Record<string, ForumScreenshotRow[]>>({})
const commentsByTrade = ref<Record<string, ForumCommentRow[]>>({})
const profilesById = ref<Record<string, ForumProfileRow>>({})
const commentDraft = ref('')
const commentImage = ref<File | null>(null)
const commentFileInput = ref<HTMLInputElement | null>(null)
const selectedTraderId = ref('')
const isTraderDialogOpen = ref(false)

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0
}

function fixed(value: number | string | null | undefined, digits = 1) {
  return toNumber(value).toFixed(digits)
}

function formatTradeDate(date: string, time?: string) {
  const day = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))

  return time ? `${day} - ${time.slice(0, 5)}` : day
}

function formatCommentDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function profileName(userId: string) {
  return profilesById.value[userId]?.display_name?.trim() || 'Trader'
}

function profileAvatar(userId: string) {
  return profilesById.value[userId]?.avatar_url || null
}

function initials(userId: string) {
  return profileName(userId)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || 'TR'
}

function resultSeverity(result: ForumTradeRow['result']) {
  if (result === 'Win') return 'success'
  if (result === 'Loss') return 'danger'
  return 'warning'
}

function directionSeverity(direction: ForumTradeRow['direction']) {
  return direction === 'Long' ? 'success' : 'danger'
}

function openTraderProfile(userId: string) {
  selectedTraderId.value = userId
  isTraderDialogOpen.value = true
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildCommentImagePath(userId: string, commentId: string, fileName: string) {
  const name = fileName.replace(/\.[^.]+$/, '')
  const extension = fileName.match(/(\.[^.]+)$/)?.[1] ?? ''
  const uniqueId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`
  return `${userId}/${commentId}/${uniqueId}-${slugify(name) || 'comment-image'}${extension}`
}

function resolveScreenshotUrl(row: ForumScreenshotRow) {
  return row.public_url || (row.storage_path ? supabase.storage.from(screenshotBucket).getPublicUrl(row.storage_path).data.publicUrl : null)
}

function resolveCommentImageUrl(row: ForumCommentRow) {
  return row.image_public_url ||
    (row.image_storage_path ? supabase.storage.from(commentImageBucket).getPublicUrl(row.image_storage_path).data.publicUrl : null)
}

async function fetchForum() {
  if (isLoading.value) {
    return
  }

  isLoading.value = true
  forumError.value = null

  try {
    await auth.ensureAuthReady()
    if (!auth.user.value) {
      trades.value = []
      return
    }

    const { data: tradeRows, error: tradeError } = await supabase
      .from('trades')
      .select('*')
      .order('trade_date', { ascending: false })
      .order('trade_time', { ascending: false })

    if (tradeError) {
      throw tradeError
    }

    const nextTrades = (tradeRows ?? []) as ForumTradeRow[]
    const tradeIds = nextTrades.map((trade) => trade.id)
    const profileIds = new Set(nextTrades.map((trade) => trade.user_id))
    const nextScreenshots: Record<string, ForumScreenshotRow[]> = {}
    const nextComments: Record<string, ForumCommentRow[]> = {}

    if (tradeIds.length) {
      const [
        { data: screenshotRows, error: screenshotError },
        { data: commentRows, error: commentError },
      ] = await Promise.all([
        supabase
          .from('trade_screenshots')
          .select('trade_id, slot, label, storage_path, public_url')
          .in('trade_id', tradeIds)
          .order('slot', { ascending: true }),
        supabase
          .from('trade_forum_comments')
          .select('*')
          .in('trade_id', tradeIds)
          .order('created_at', { ascending: true }),
      ])

      if (screenshotError) {
        throw screenshotError
      }
      if (commentError) {
        throw commentError
      }

      for (const row of (screenshotRows ?? []) as ForumScreenshotRow[]) {
        nextScreenshots[row.trade_id] = [...(nextScreenshots[row.trade_id] ?? []), row]
      }

      for (const row of (commentRows ?? []) as ForumCommentRow[]) {
        nextComments[row.trade_id] = [...(nextComments[row.trade_id] ?? []), row]
        profileIds.add(row.user_id)
      }
    }

    const ids = [...profileIds]
    const nextProfiles: Record<string, ForumProfileRow> = {}
    if (ids.length) {
      const { data: profileRows, error: profileError } = await supabase
        .from('trade_forum_profiles')
        .select('id, display_name, avatar_url')
        .in('id', ids)

      if (profileError) {
        throw profileError
      }

      for (const profile of (profileRows ?? []) as ForumProfileRow[]) {
        nextProfiles[profile.id] = profile
      }
    }

    trades.value = nextTrades
    screenshotsByTrade.value = nextScreenshots
    commentsByTrade.value = nextComments
    profilesById.value = nextProfiles

    if (!selectedTradeId.value || !nextTrades.some((trade) => trade.id === selectedTradeId.value)) {
      selectedTradeId.value = nextTrades[0]?.id ?? ''
    }
  } catch (caught) {
    forumError.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    isLoading.value = false
  }
}

async function submitComment() {
  const trade = selectedTrade.value
  if (!trade || isSubmitting.value) {
    return
  }

  await auth.ensureAuthReady()
  const currentUser = auth.user.value
  if (!currentUser) {
    forumError.value = 'You need to be logged in to comment.'
    return
  }

  isSubmitting.value = true
  forumError.value = null

  try {
    const body = commentDraft.value.trim()
    const image = validateImageFile(commentImage.value, 'Comment image', {
      allowEmpty: true,
      maxBytes: 10 * 1024 * 1024,
    })

    if (!body && !image) {
      throw new Error('Add a comment or attach an image first.')
    }

    const { data: insertedComment, error: insertError } = await supabase
      .from('trade_forum_comments')
      .insert({
        trade_id: trade.id,
        user_id: currentUser.id,
        body,
      })
      .select('*')
      .single()

    if (insertError) {
      throw insertError
    }

    let savedComment = insertedComment as ForumCommentRow

    if (image) {
      const storagePath = buildCommentImagePath(currentUser.id, savedComment.id, image.name)
      const { error: uploadError } = await supabase.storage
        .from(commentImageBucket)
        .upload(storagePath, image, {
          contentType: image.type || 'application/octet-stream',
          upsert: true,
        })

      if (uploadError) {
        throw uploadError
      }

      const { data: publicData } = supabase.storage.from(commentImageBucket).getPublicUrl(storagePath)
      const { data: updatedComment, error: updateError } = await supabase
        .from('trade_forum_comments')
        .update({
          image_storage_path: storagePath,
          image_public_url: publicData.publicUrl,
        })
        .eq('id', savedComment.id)
        .eq('user_id', currentUser.id)
        .select('*')
        .single()

      if (updateError) {
        throw updateError
      }

      savedComment = updatedComment as ForumCommentRow
    }

    commentsByTrade.value = {
      ...commentsByTrade.value,
      [trade.id]: [...(commentsByTrade.value[trade.id] ?? []), savedComment],
    }
    profilesById.value = {
      ...profilesById.value,
      [currentUser.id]: {
        id: currentUser.id,
        display_name: auth.displayName.value,
        avatar_url: auth.profile.value?.avatarUrl ?? null,
      },
    }
    commentDraft.value = ''
    commentImage.value = null
    if (commentFileInput.value) {
      commentFileInput.value.value = ''
    }
  } catch (caught) {
    forumError.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    isSubmitting.value = false
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  commentImage.value = input.files?.[0] ?? null
}

const filteredTrades = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return trades.value
  }

  return trades.value.filter((trade) =>
    [
      trade.symbol,
      trade.setup,
      trade.direction,
      trade.session,
      trade.emotion,
      trade.result,
      trade.notes,
      profileName(trade.user_id),
    ]
      .join(' ')
      .toLowerCase()
      .includes(query),
  )
})

const selectedTrade = computed(() =>
  trades.value.find((trade) => trade.id === selectedTradeId.value) ?? filteredTrades.value[0] ?? null,
)
const selectedScreenshots = computed(() => selectedTrade.value ? screenshotsByTrade.value[selectedTrade.value.id] ?? [] : [])
const selectedComments = computed(() => selectedTrade.value ? commentsByTrade.value[selectedTrade.value.id] ?? [] : [])
const selectedTradeCountLabel = computed(() => `${filteredTrades.value.length} of ${trades.value.length} trades`)
const commentImageName = computed(() => commentImage.value?.name ?? 'Attach image')
const traderStatsById = computed(() => {
  const grouped = new Map<string, ForumTradeRow[]>()

  for (const trade of trades.value) {
    grouped.set(trade.user_id, [...(grouped.get(trade.user_id) ?? []), trade])
  }

  const stats: Record<string, TraderStats> = {}
  for (const [userId, items] of grouped.entries()) {
    const wins = items.filter((trade) => trade.result === 'Win').length
    const losses = items.filter((trade) => trade.result === 'Loss').length
    const breakeven = items.filter((trade) => trade.result === 'BE').length
    const netPnl = items.reduce((sum, trade) => sum + toNumber(trade.net_pnl), 0)
    const sortedByPnl = [...items].sort((left, right) => toNumber(right.net_pnl) - toNumber(left.net_pnl))
    const recentTrades = [...items]
      .sort((left, right) => `${right.trade_date}T${right.trade_time}`.localeCompare(`${left.trade_date}T${left.trade_time}`))
      .slice(0, 8)

    stats[userId] = {
      userId,
      totalTrades: items.length,
      wins,
      losses,
      breakeven,
      netPnl,
      winRate: items.length ? (wins / items.length) * 100 : 0,
      avgRR: items.length ? items.reduce((sum, trade) => sum + toNumber(trade.rr), 0) / items.length : 0,
      avgHoldMinutes: items.length ? Math.round(items.reduce((sum, trade) => sum + Number(trade.hold_minutes ?? 0), 0) / items.length) : 0,
      bestTrade: sortedByPnl[0] ?? null,
      worstTrade: sortedByPnl[sortedByPnl.length - 1] ?? null,
      symbols: [...new Set(items.map((trade) => trade.symbol))].sort(),
      recentTrades,
    }
  }

  return stats
})
const selectedTraderStats = computed(() => traderStatsById.value[selectedTraderId.value] ?? null)

onMounted(() => {
  void fetchForum()
})
</script>

<template>
  <div class="page-stack">
    <div v-if="forumError" class="sync-banner">
      Forum error: {{ forumError }}
    </div>

    <div class="forum-layout">
      <SectionCard title="Trade Forum" :subtitle="selectedTradeCountLabel">
        <div class="stack">
          <div class="two-up">
            <PInputText
              v-model="searchQuery"
              placeholder="Search trader, symbol, setup..."
              class="input-dark"
            />
            <div class="forum-toolbar-actions">
              <PButton
                type="button"
                icon="pi pi-refresh"
                label="Refresh"
                class="input-dark action-neutral"
                :loading="isLoading"
                @click="fetchForum"
              />
            </div>
          </div>

          <div v-if="isLoading && !trades.length" class="forum-empty">
            Loading forum trades...
          </div>

          <div v-else-if="!filteredTrades.length" class="forum-empty">
            No public trades found.
          </div>

          <div v-else class="forum-feed">
            <div
              v-for="trade in filteredTrades"
              :key="trade.id"
              role="button"
              tabindex="0"
              class="forum-trade-card"
              :class="{ 'is-active': selectedTrade?.id === trade.id }"
              @click="selectedTradeId = trade.id"
              @keydown.enter="selectedTradeId = trade.id"
              @keydown.space.prevent="selectedTradeId = trade.id"
            >
              <div class="forum-trade-main">
                <v-avatar color="success" size="42">
                  <img
                    v-if="profileAvatar(trade.user_id)"
                    :src="profileAvatar(trade.user_id) ?? undefined"
                    :alt="profileName(trade.user_id)"
                    class="account-avatar-image"
                  >
                  <span v-else class="text-body-2 font-weight-bold">{{ initials(trade.user_id) }}</span>
                </v-avatar>
                <div class="forum-trade-copy">
                  <div class="forum-trade-title">
                    {{ trade.symbol }} {{ trade.direction }} - {{ trade.setup }}
                  </div>
                  <div class="forum-trade-meta">
                    <span class="forum-nick">Nick: {{ profileName(trade.user_id) }}</span>
                    <span>{{ formatTradeDate(trade.trade_date, trade.trade_time) }}</span>
                  </div>
                </div>
              </div>

              <div class="forum-trade-stats">
                <PTag :value="trade.direction" :severity="directionSeverity(trade.direction)" />
                <PTag :value="trade.result" :severity="resultSeverity(trade.result)" />
                <span :class="toNumber(trade.net_pnl) >= 0 ? 'positive' : 'negative'">
                  {{ ledger.formatSignedMoney(toNumber(trade.net_pnl)) }}
                </span>
              </div>

              <div class="forum-trader-summary">
                <span>{{ traderStatsById[trade.user_id]?.totalTrades ?? 0 }} trades</span>
                <span>{{ ledger.formatNumber(traderStatsById[trade.user_id]?.winRate ?? 0) }}% WR</span>
                <span :class="(traderStatsById[trade.user_id]?.netPnl ?? 0) >= 0 ? 'positive' : 'negative'">
                  {{ ledger.formatSignedMoney(traderStatsById[trade.user_id]?.netPnl ?? 0) }}
                </span>
                <button
                  type="button"
                  class="forum-user-link"
                  @click.stop="openTraderProfile(trade.user_id)"
                >
                  View trader
                </button>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <v-card class="glass-card detail-panel">
        <div v-if="selectedTrade" class="panel">
          <div class="journal-header">
            <div>
              <h2>{{ selectedTrade.symbol }} {{ selectedTrade.direction }}</h2>
              <p class="muted">
                {{ selectedTrade.setup }} - {{ selectedTrade.session }} - by
                <button type="button" class="forum-inline-user" @click="openTraderProfile(selectedTrade.user_id)">
                  {{ profileName(selectedTrade.user_id) }}
                </button>
              </p>
            </div>
            <v-avatar
              color="success"
              size="44"
              class="forum-avatar-button"
              @click="openTraderProfile(selectedTrade.user_id)"
            >
              <img
                v-if="profileAvatar(selectedTrade.user_id)"
                :src="profileAvatar(selectedTrade.user_id) ?? undefined"
                :alt="profileName(selectedTrade.user_id)"
                class="account-avatar-image"
              >
              <span v-else class="text-body-2 font-weight-bold">{{ initials(selectedTrade.user_id) }}</span>
            </v-avatar>
          </div>

          <div class="detail-hero">
            <div>
              <div class="muted text-uppercase text-caption font-weight-bold">Result</div>
              <div class="text-h6 font-weight-bold">{{ selectedTrade.result }}</div>
            </div>
            <div class="text-h4 font-weight-black" :class="toNumber(selectedTrade.net_pnl) >= 0 ? 'positive' : 'negative'">
              {{ ledger.formatSignedMoney(toNumber(selectedTrade.net_pnl)) }}
            </div>
          </div>

          <div class="drawer-stack mt-4">
            <div class="detail-grid">
              <div class="detail-item">
                <div class="detail-label">Date</div>
                <div class="detail-value">{{ formatTradeDate(selectedTrade.trade_date, selectedTrade.trade_time) }}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Trader</div>
                <div class="detail-value">
                  <button type="button" class="forum-inline-user" @click="openTraderProfile(selectedTrade.user_id)">
                    {{ profileName(selectedTrade.user_id) }}
                  </button>
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Entry</div>
                <div class="detail-value">{{ ledger.formatNumber(toNumber(selectedTrade.entry)) }}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Exit</div>
                <div class="detail-value">{{ ledger.formatNumber(toNumber(selectedTrade.exit)) }}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Stop Loss</div>
                <div class="detail-value">{{ ledger.formatNumber(toNumber(selectedTrade.stop_loss)) }}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Take Profit</div>
                <div class="detail-value">{{ ledger.formatNumber(toNumber(selectedTrade.take_profit)) }}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">R:R</div>
                <div class="detail-value">1 : {{ fixed(selectedTrade.rr) }}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Risk</div>
                <div class="detail-value">{{ fixed(selectedTrade.risk_percent) }}%</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Hold</div>
                <div class="detail-value">{{ selectedTrade.hold_minutes }}m</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Emotion</div>
                <div class="detail-value">{{ selectedTrade.emotion }}</div>
              </div>
            </div>

            <div>
              <div class="section-title forum-section-title">
                <div>
                  <h2>Screenshots</h2>
                  <p>{{ selectedScreenshots.length }} images attached to this trade.</p>
                </div>
              </div>
              <div v-if="selectedScreenshots.length" class="screenshot-grid">
                <a
                  v-for="shot in selectedScreenshots"
                  :key="`${shot.trade_id}-${shot.slot}`"
                  :href="resolveScreenshotUrl(shot) ?? undefined"
                  target="_blank"
                  rel="noreferrer"
                  class="shot-card"
                >
                  <img
                    v-if="resolveScreenshotUrl(shot)"
                    :src="resolveScreenshotUrl(shot) ?? undefined"
                    :alt="shot.label"
                    class="shot-image"
                  >
                  <div class="shot-card-caption">
                    <v-icon size="26" class="mb-2">mdi-chart-box-outline</v-icon>
                    <div class="font-weight-bold">{{ shot.label }}</div>
                  </div>
                </a>
              </div>
              <div v-else class="forum-empty forum-empty--compact">
                No screenshots for this trade.
              </div>
            </div>

            <div class="detail-item">
              <div class="detail-label">Why entered</div>
              <div class="detail-value font-weight-regular">{{ selectedTrade.why_entered || '-' }}</div>
            </div>

            <div class="detail-item">
              <div class="detail-label">What went well</div>
              <div class="detail-value font-weight-regular">{{ selectedTrade.what_went_well || '-' }}</div>
            </div>

            <div class="detail-item">
              <div class="detail-label">What to improve</div>
              <div class="detail-value font-weight-regular">{{ selectedTrade.what_to_improve || '-' }}</div>
            </div>

            <div class="detail-item">
              <div class="detail-label">Notes</div>
              <div class="detail-value font-weight-regular">{{ selectedTrade.notes || '-' }}</div>
            </div>

            <div class="forum-comments">
              <div class="section-title forum-section-title">
                <div>
                  <h2>Comments</h2>
                  <p>{{ selectedComments.length }} comments on this trade.</p>
                </div>
              </div>

              <div class="forum-comment-form">
                <PTextarea
                  v-model="commentDraft"
                  rows="3"
                  auto-resize
                  placeholder="Write a comment..."
                  class="input-dark"
                />
                <div class="forum-comment-actions">
                  <label class="forum-file-button">
                    <v-icon size="18">mdi-image-plus-outline</v-icon>
                    <span>{{ commentImageName }}</span>
                    <input
                      ref="commentFileInput"
                      type="file"
                      accept="image/*"
                      @change="handleFileChange"
                    >
                  </label>
                  <PButton
                    type="button"
                    icon="pi pi-send"
                    label="Post"
                    severity="success"
                    class="action-primary"
                    :loading="isSubmitting"
                    @click="submitComment"
                  />
                </div>
              </div>

              <div v-if="selectedComments.length" class="forum-comment-list">
                <div v-for="comment in selectedComments" :key="comment.id" class="forum-comment">
                  <v-avatar color="success" size="34">
                    <img
                      v-if="profileAvatar(comment.user_id)"
                      :src="profileAvatar(comment.user_id) ?? undefined"
                      :alt="profileName(comment.user_id)"
                      class="account-avatar-image"
                    >
                    <span v-else class="text-caption font-weight-bold">{{ initials(comment.user_id) }}</span>
                  </v-avatar>
                  <div class="forum-comment-body">
                    <div class="forum-comment-head">
                      <strong>{{ profileName(comment.user_id) }}</strong>
                      <span>{{ formatCommentDate(comment.created_at) }}</span>
                    </div>
                    <p v-if="comment.body">{{ comment.body }}</p>
                    <a
                      v-if="resolveCommentImageUrl(comment)"
                      :href="resolveCommentImageUrl(comment) ?? undefined"
                      target="_blank"
                      rel="noreferrer"
                      class="forum-comment-image"
                    >
                      <img :src="resolveCommentImageUrl(comment) ?? undefined" alt="Comment attachment">
                    </a>
                  </div>
                </div>
              </div>
              <div v-else class="forum-empty forum-empty--compact">
                Be first to comment on this trade.
              </div>
            </div>
          </div>
        </div>

        <div v-else class="panel">
          <h2>No trade selected</h2>
          <p class="muted">Forum trades will appear here after the database migration is applied.</p>
        </div>
      </v-card>
    </div>

    <PDialog
      v-model:visible="isTraderDialogOpen"
      modal
      class="trade-dialog"
      :style="{ width: 'min(760px, calc(100vw - 28px))' }"
    >
      <template #header>
        <div class="trade-dialog-header">
          <div>
            <div class="trade-dialog-eyebrow">Trader profile</div>
            <h2>Performance summary</h2>
            <p>Public stats from forum trades.</p>
          </div>
        </div>
      </template>

      <div v-if="selectedTraderStats" class="forum-profile-dialog">
        <div class="forum-profile-hero">
          <v-avatar color="success" size="64">
            <img
              v-if="profileAvatar(selectedTraderId)"
              :src="profileAvatar(selectedTraderId) ?? undefined"
              :alt="profileName(selectedTraderId)"
              class="account-avatar-image"
            >
            <span v-else class="text-h6 font-weight-bold">{{ initials(selectedTraderId) }}</span>
          </v-avatar>
          <div class="forum-profile-hero-copy">
            <div class="detail-label">Nick</div>
            <h3>{{ profileName(selectedTraderId) }}</h3>
            <p>
              {{ selectedTraderStats.totalTrades }} trades -
              {{ ledger.formatNumber(selectedTraderStats.winRate) }}% win rate -
              avg R:R 1 : {{ selectedTraderStats.avgRR.toFixed(1) }}
            </p>
          </div>
          <div class="forum-profile-hero-pnl" :class="selectedTraderStats.netPnl >= 0 ? 'positive' : 'negative'">
            {{ ledger.formatSignedMoney(selectedTraderStats.netPnl) }}
          </div>
        </div>

        <div class="forum-profile-stats">
          <div class="setup-metric">
            <div class="label">Trades</div>
            <div class="value">{{ selectedTraderStats.totalTrades }}</div>
          </div>
          <div class="setup-metric">
            <div class="label">Net P&L</div>
            <div class="value" :class="selectedTraderStats.netPnl >= 0 ? 'positive' : 'negative'">
              {{ ledger.formatSignedMoney(selectedTraderStats.netPnl) }}
            </div>
          </div>
          <div class="setup-metric">
            <div class="label">Win Rate</div>
            <div class="value">{{ ledger.formatNumber(selectedTraderStats.winRate) }}%</div>
          </div>
          <div class="setup-metric">
            <div class="label">Avg R:R</div>
            <div class="value">1 : {{ selectedTraderStats.avgRR.toFixed(1) }}</div>
          </div>
          <div class="setup-metric">
            <div class="label">W/L/BE</div>
            <div class="value">{{ selectedTraderStats.wins }}/{{ selectedTraderStats.losses }}/{{ selectedTraderStats.breakeven }}</div>
          </div>
          <div class="setup-metric">
            <div class="label">Avg Hold</div>
            <div class="value">{{ selectedTraderStats.avgHoldMinutes }}m</div>
          </div>
          <div class="setup-metric">
            <div class="label">Best Trade</div>
            <div class="value positive">
              {{ selectedTraderStats.bestTrade ? ledger.formatSignedMoney(toNumber(selectedTraderStats.bestTrade.net_pnl)) : '-' }}
            </div>
          </div>
          <div class="setup-metric">
            <div class="label">Worst Trade</div>
            <div class="value negative">
              {{ selectedTraderStats.worstTrade ? ledger.formatSignedMoney(toNumber(selectedTraderStats.worstTrade.net_pnl)) : '-' }}
            </div>
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-label">Symbols</div>
          <div class="forum-symbol-list">
            <PTag
              v-for="symbol in selectedTraderStats.symbols"
              :key="symbol"
              :value="symbol"
              severity="secondary"
            />
          </div>
        </div>

        <div class="forum-profile-recent">
          <div class="detail-label">Recent trades</div>
          <button
            v-for="trade in selectedTraderStats.recentTrades"
            :key="trade.id"
            type="button"
            class="forum-profile-trade"
            @click="selectedTradeId = trade.id; isTraderDialogOpen = false"
          >
            <span>{{ trade.symbol }} {{ trade.direction }} - {{ trade.setup }}</span>
            <span>{{ formatTradeDate(trade.trade_date, trade.trade_time) }}</span>
            <strong :class="toNumber(trade.net_pnl) >= 0 ? 'positive' : 'negative'">
              {{ ledger.formatSignedMoney(toNumber(trade.net_pnl)) }}
            </strong>
          </button>
        </div>
      </div>
    </PDialog>
  </div>
</template>
