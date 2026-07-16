<script setup lang="ts">
import SectionCard from '~/components/ui/SectionCard.vue'
import { requireText } from '~/utils/validation'

type TradingViewPluginRow = {
  id: string
  user_id: string
  name: string
  description: string
  code: string
  tags: string[] | null
  created_at: string
  updated_at: string
}

type TradingViewPluginForm = {
  name: string
  description: string
  code: string
  tags: string
}

type LibraryProfileRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

const supabase = useSupabase()
const auth = useAuth()

const isLoading = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const isEditorOpen = ref(false)
const editingPluginId = ref<string | null>(null)
const copiedPluginId = ref<string | null>(null)
const plugins = ref<TradingViewPluginRow[]>([])
const profilesById = ref<Record<string, LibraryProfileRow>>({})

const pluginForm = reactive<TradingViewPluginForm>({
  name: '',
  description: '',
  code: '',
  tags: '',
})

const currentUserId = computed(() => auth.user.value?.id ?? '')

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function profileName(userId: string) {
  return profilesById.value[userId]?.display_name?.trim() || 'Trader'
}

function isOwner(row: TradingViewPluginRow) {
  return row.user_id === currentUserId.value
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function resetForm() {
  editingPluginId.value = null
  Object.assign(pluginForm, {
    name: '',
    description: '',
    code: '',
    tags: '',
  } satisfies TradingViewPluginForm)
}

function hydrateForm(row: TradingViewPluginRow) {
  editingPluginId.value = row.id
  Object.assign(pluginForm, {
    name: row.name,
    description: row.description ?? '',
    code: row.code,
    tags: (row.tags ?? []).join(', '),
  } satisfies TradingViewPluginForm)
}

function openCreateModal() {
  resetForm()
  isEditorOpen.value = true
}

function openEditModal(row: TradingViewPluginRow) {
  hydrateForm(row)
  isEditorOpen.value = true
}

function closeEditorModal() {
  isEditorOpen.value = false
  resetForm()
}

async function loadPlugins() {
  await auth.ensureAuthReady()
  const currentUser = auth.user.value
  if (!currentUser) {
    plugins.value = []
    profilesById.value = {}
    return
  }

  isLoading.value = true
  error.value = null

  try {
    const { data, error: loadError } = await supabase
      .from('tradingview_plugins')
      .select('id, user_id, name, description, code, tags, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (loadError) {
      throw loadError
    }

    const nextPlugins = (data ?? []) as TradingViewPluginRow[]
    plugins.value = nextPlugins

    const profileIds = [...new Set(nextPlugins.map((row) => row.user_id))]
    if (profileIds.length) {
      const { data: profileRows, error: profileError } = await supabase
        .from('trade_forum_profiles')
        .select('id, display_name, avatar_url')
        .in('id', profileIds)

      if (profileError) {
        throw profileError
      }

      const nextProfiles: Record<string, LibraryProfileRow> = {}
      for (const row of (profileRows ?? []) as LibraryProfileRow[]) {
        nextProfiles[row.id] = row
      }
      profilesById.value = nextProfiles
    } else {
      profilesById.value = {}
    }

    if (!editingPluginId.value) {
      resetForm()
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    isLoading.value = false
  }
}

async function savePlugin() {
  await auth.ensureAuthReady()
  const currentUser = auth.user.value
  if (!currentUser) {
    return
  }

  isSaving.value = true
  error.value = null

  try {
    const name = requireText(pluginForm.name, 'Name', { maxLength: 120 })
    const description = requireText(pluginForm.description, 'Description', { allowEmpty: true, maxLength: 4000 })
    const code = requireText(pluginForm.code, 'Code', { maxLength: 20000 })
    const tags = parseTags(pluginForm.tags)

    const payload = {
      user_id: currentUser.id,
      name,
      description,
      code,
      tags,
    }

    if (editingPluginId.value) {
      const { error: updateError } = await supabase
        .from('tradingview_plugins')
        .update(payload)
        .eq('id', editingPluginId.value)
        .eq('user_id', currentUser.id)

      if (updateError) {
        throw updateError
      }
    } else {
      const { error: insertError } = await supabase
        .from('tradingview_plugins')
        .insert(payload)

      if (insertError) {
        throw insertError
      }
    }

    closeEditorModal()
    await loadPlugins()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    isSaving.value = false
  }
}

async function copyCode(row: TradingViewPluginRow) {
  try {
    await navigator.clipboard.writeText(row.code)
    copiedPluginId.value = row.id
    window.setTimeout(() => {
      if (copiedPluginId.value === row.id) {
        copiedPluginId.value = null
      }
    }, 1400)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  }
}

async function deletePlugin(row: TradingViewPluginRow) {
  if (!window.confirm(`Delete TradingView plugin "${row.name}"?`)) {
    return
  }

  isDeleting.value = true
  error.value = null

  try {
    const { error: deleteError } = await supabase
      .from('tradingview_plugins')
      .delete()
      .eq('id', row.id)
      .eq('user_id', row.user_id)

    if (deleteError) {
      throw deleteError
    }

    if (editingPluginId.value === row.id) {
      closeEditorModal()
    }

    await loadPlugins()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    isDeleting.value = false
  }
}

const filteredPlugins = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return plugins.value
  }

  return plugins.value.filter((row) =>
    [
      row.name,
      row.description,
      row.code,
      profileName(row.user_id),
      ...(row.tags ?? []),
    ]
      .join(' ')
      .toLowerCase()
      .includes(query),
  )
})

const pluginCountLabel = computed(() => `${filteredPlugins.value.length} of ${plugins.value.length} plugins`)

watch(
  () => auth.user.value?.id,
  () => {
    void loadPlugins()
  },
  { immediate: true },
)
</script>

<template>
  <div class="page-stack">
    <div v-if="error" class="sync-banner">
      {{ error }}
    </div>

    <SectionCard
      title="TradingView Library"
      subtitle="Browse reusable Pine Script indicators, copy the code and keep only your own entries editable."
    >
      <div class="management-action-row plugins-hero-cta">
        <div class="muted">
          This is a shared library for authenticated users. Use the search box to find an indicator, then copy it straight from the card.
        </div>
        <PButton
          type="button"
          label="Add plugin"
          icon="pi pi-plus"
          severity="success"
          class="input-dark action-primary"
          @click="openCreateModal"
        />
      </div>

      <div class="stack">
        <label class="field">
          <span>Search library</span>
          <PInputText
            v-model="searchQuery"
            class="input-dark"
            placeholder="name, description, code, tags, author..."
          />
        </label>
      </div>
    </SectionCard>

    <SectionCard
      title="Library"
      :subtitle="pluginCountLabel"
    >
      <div v-if="isLoading && !plugins.length" class="upload-empty">
        Loading the TradingView library...
      </div>

      <div v-else-if="!filteredPlugins.length" class="upload-empty">
        <div>No TradingView plugins yet. Add the first one with the button above.</div>
      </div>

      <div v-else class="plugin-grid">
        <article
          v-for="row in filteredPlugins"
          :key="row.id"
          class="plugin-card glass-card"
        >
          <div class="plugin-card-body">
            <div class="plugin-card-heading">
              <div>
                <div class="plugin-card-title">{{ row.name }}</div>
                <div class="plugin-card-meta">
                  {{ row.description || 'No description' }}
                </div>
              </div>

              <div class="plugin-card-badges">
                <PTag
                  :value="profileName(row.user_id)"
                  severity="secondary"
                />
                <PTag
                  v-if="isOwner(row)"
                  value="Your plugin"
                  severity="success"
                />
              </div>
            </div>

            <div v-if="(row.tags ?? []).length" class="plugin-tags">
              <PTag
                v-for="tag in row.tags ?? []"
                :key="`${row.id}-${tag}`"
                :value="tag"
                severity="secondary"
              />
            </div>

            <pre class="plugin-code-preview">{{ row.code }}</pre>
          </div>

          <div class="plugin-card-actions">
            <PButton
              type="button"
              :label="copiedPluginId === row.id ? 'Copied' : 'Copy code'"
              icon="pi pi-copy"
              severity="success"
              class="input-dark action-primary"
              @click="copyCode(row)"
            />
            <PButton
              v-if="isOwner(row)"
              type="button"
              label="Edit"
              icon="pi pi-pencil"
              severity="warning"
              text
              class="input-dark action-edit"
              @click="openEditModal(row)"
            />
            <PButton
              v-if="isOwner(row)"
              type="button"
              :label="isDeleting ? 'Deleting...' : 'Delete'"
              icon="pi pi-trash"
              severity="danger"
              text
              class="input-dark action-danger"
              :disabled="isDeleting"
              @click="deletePlugin(row)"
            />
          </div>

          <div class="plugin-card-footer">
            <span>By {{ profileName(row.user_id) }}</span>
            <span>Updated {{ formatDate(row.updated_at) }}</span>
          </div>
        </article>
      </div>
    </SectionCard>

    <PDialog
      v-model:visible="isEditorOpen"
      modal
      class="plugin-dialog"
      :style="{ width: 'min(920px, calc(100vw - 28px))' }"
    >
      <template #header>
        <div class="trade-dialog-header">
          <div>
            <div class="trade-dialog-eyebrow">{{ editingPluginId ? 'Edit plugin' : 'New plugin' }}</div>
            <h2>{{ editingPluginId ? 'Update library entry' : 'Add indicator to the library' }}</h2>
            <p>Save a reusable Pine Script snippet for the shared TradingView library.</p>
          </div>
        </div>
      </template>

      <div class="plugin-modal-form">
        <div class="management-form management-form--grid">
          <label class="field">
            <span>Name</span>
            <PInputText
              v-model="pluginForm.name"
              class="input-dark"
              placeholder="Liquidity Sweep Overlay"
            />
          </label>

          <label class="field field--full">
            <span>Description</span>
            <PTextarea
              v-model="pluginForm.description"
              auto-resize
              rows="3"
              class="input-dark"
              placeholder="What does this indicator do and when should you use it?"
            />
          </label>

          <label class="field field--full">
            <span>Pine Script code</span>
            <PTextarea
              v-model="pluginForm.code"
              auto-resize
              rows="12"
              class="input-dark plugin-code-input"
              placeholder="//@version=5&#10;indicator('My plugin', overlay=true)"
              spellcheck="false"
            />
          </label>

          <label class="field field--full">
            <span>Tags</span>
            <PInputText
              v-model="pluginForm.tags"
              class="input-dark"
              placeholder="breakout, liquidity, session, alerts"
            />
          </label>
        </div>

        <div class="management-action-row">
          <div class="muted">
            {{ editingPluginId ? 'You are editing an existing plugin.' : 'New entries are saved under your Supabase user.' }}
          </div>
          <div class="d-flex ga-2 flex-wrap">
            <PButton
              type="button"
              label="Cancel"
              severity="secondary"
              text
              class="input-dark action-cancel"
              @click="closeEditorModal"
            />
            <PButton
              type="button"
              :label="editingPluginId ? 'Update plugin' : 'Save plugin'"
              icon="pi pi-save"
              severity="success"
              class="input-dark action-primary"
              :loading="isSaving"
              @click="savePlugin"
            />
          </div>
        </div>
      </div>
    </PDialog>
  </div>
</template>
