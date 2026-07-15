<script setup lang="ts">
import SectionCard from '~/components/ui/SectionCard.vue'
import { requireText } from '~/utils/validation'

type TradingViewPluginRow = {
  id: string
  user_id: string
  name: string
  description: string
  code: string
  screenshot_url: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
}

type TradingViewPluginForm = {
  name: string
  description: string
  code: string
  screenshotUrl: string
  tags: string
}

const supabase = useSupabase()
const auth = useAuth()

const isLoading = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const editingPluginId = ref<string | null>(null)
const copiedPluginId = ref<string | null>(null)
const sharedPluginId = ref<string | null>(null)
const plugins = ref<TradingViewPluginRow[]>([])
const editorAnchor = ref<HTMLElement | null>(null)

const pluginForm = reactive<TradingViewPluginForm>({
  name: '',
  description: '',
  code: '',
  screenshotUrl: '',
  tags: '',
})

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0
}

function resetForm() {
  editingPluginId.value = null
  Object.assign(pluginForm, {
    name: '',
    description: '',
    code: '',
    screenshotUrl: '',
    tags: '',
  } satisfies TradingViewPluginForm)
}

function hydrateForm(row: TradingViewPluginRow) {
  editingPluginId.value = row.id
  Object.assign(pluginForm, {
    name: row.name,
    description: row.description ?? '',
    code: row.code,
    screenshotUrl: row.screenshot_url ?? '',
    tags: (row.tags ?? []).join(', '),
  } satisfies TradingViewPluginForm)
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function normalizeScreenshotUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  try {
    return new URL(trimmed).toString()
  } catch {
    throw new Error('Screenshot URL must be a valid URL.')
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function scrollToEditor() {
  editorAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function pluginExportPayload(row: TradingViewPluginRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    code: row.code,
    screenshot_url: row.screenshot_url,
    tags: row.tags ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

async function loadPlugins() {
  await auth.ensureAuthReady()
  const currentUser = auth.user.value
  if (!currentUser) {
    plugins.value = []
    return
  }

  isLoading.value = true
  error.value = null

  try {
    const { data, error: loadError } = await supabase
      .from('tradingview_plugins')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })

    if (loadError) {
      throw loadError
    }

    plugins.value = (data ?? []) as TradingViewPluginRow[]
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
    const screenshotUrl = normalizeScreenshotUrl(pluginForm.screenshotUrl)
    const tags = parseTags(pluginForm.tags)

    const payload = {
      user_id: currentUser.id,
      name,
      description,
      code,
      screenshot_url: screenshotUrl,
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

    resetForm()
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

async function sharePlugin(row: TradingViewPluginRow) {
  const payload = pluginExportPayload(row)
  const shareText = `${row.name}\n\n${row.description}\n\n${row.code}`.trim()

  try {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      await navigator.share({
        title: row.name,
        text: shareText,
        url: window.location.origin + '/plugins',
      })
      sharedPluginId.value = row.id
      window.setTimeout(() => {
        if (sharedPluginId.value === row.id) {
          sharedPluginId.value = null
        }
      }, 1400)
      return
    }

    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    sharedPluginId.value = row.id
    window.setTimeout(() => {
      if (sharedPluginId.value === row.id) {
        sharedPluginId.value = null
      }
    }, 1400)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  }
}

function exportPluginJson(row: TradingViewPluginRow) {
  const filename = `tradingview-plugin-${slugify(row.name) || row.id}.json`
  downloadTextFile(filename, JSON.stringify(pluginExportPayload(row), null, 2), 'application/json')
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
      resetForm()
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
    [row.name, row.description, row.code, ...(row.tags ?? [])]
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
      title="TradingView Plugins"
      subtitle="Store Pine Script snippets, screenshots and exportable JSON in Supabase."
    ><div class="muted">
        Create reusable TradingView components, keep a screenshot for context and copy the code when you need it in another chart.
      </div>

      <div class="management-action-row plugins-hero-cta">
        <div class="muted">
          Add a new TradingView plugin, edit existing snippets and store everything in Supabase.
        </div>
        <PButton
          type="button"
          label="Dodaj wtyczkę"
          icon="pi pi-plus"
          severity="success"
          class="input-dark action-primary"
          @click="scrollToEditor"
        />
      </div>
    </SectionCard>

    <div ref="editorAnchor">
      <SectionCard
        title="Add or edit plugin"
        subtitle="Use this form to save a Pine Script plugin to your personal library."
      >
        <template #action>
          <PButton
            type="button"
            label="Reset"
            severity="secondary"
            text
            class="input-dark action-neutral"
            @click="resetForm"
          />
        </template>

        <div class="management-form plugin-form">
          <div class="management-form management-form--grid">
            <label class="field">
              <span>Name</span>
              <PInputText
                v-model="pluginForm.name"
                class="input-dark"
                placeholder="Liquidity Sweep Overlay"
              />
            </label>

            <label class="field">
              <span>Screenshot URL</span>
              <PInputText
                v-model="pluginForm.screenshotUrl"
                class="input-dark"
                placeholder="https://example.com/screenshot.png"
              />
            </label>

            <label class="field field--full">
              <span>Description</span>
              <PTextarea
                v-model="pluginForm.description"
                auto-resize
                rows="3"
                class="input-dark"
                placeholder="What does this plugin do and when should you use it?"
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
              {{ editingPluginId ? 'Editing an existing plugin.' : 'New entries are saved under your Supabase user.' }}
            </div>
            <div class="d-flex ga-2 flex-wrap">
              <PButton
                v-if="editingPluginId"
                label="Cancel edit"
                severity="secondary"
                text
                class="input-dark action-cancel"
                @click="resetForm"
              />
              <PButton
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
      </SectionCard>
    </div>

    <SectionCard
      title="Library"
      :subtitle="pluginCountLabel"
    ><div class="stack">
        <label class="field">
          <span>Search plugins</span>
          <PInputText
            v-model="searchQuery"
            class="input-dark"
            placeholder="description, code, tags..."
          />
        </label>

        <div v-if="isLoading && !plugins.length" class="upload-empty">
          Loading your TradingView plugins...
        </div>

        <div v-else-if="!filteredPlugins.length" class="upload-empty">
          <div>No TradingView plugins yet. Add one above to start building your library.</div></div>

        <div v-else class="plugin-grid">
          <article
            v-for="row in filteredPlugins"
            :key="row.id"
            class="plugin-card glass-card"
          >
            <div class="plugin-preview">
              <img
                v-if="row.screenshot_url"
                :src="row.screenshot_url"
                :alt="row.name"
                class="plugin-preview-image"
              >
              <div v-else class="plugin-preview-empty">
                <v-icon size="30">mdi-chart-timeline-variant</v-icon>
                <span>No screenshot</span>
              </div>
            </div>

            <div class="plugin-card-body">
              <div class="plugin-card-heading">
                <div>
                  <div class="plugin-card-title">{{ row.name }}</div>
                  <div class="plugin-card-meta">
                    {{ row.description || 'No description' }}
                  </div>
                </div>
                <PTag value="TradingView" severity="success" />
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
                label="Kopiuj kod"
                icon="pi pi-copy"
                severity="success"
                class="input-dark action-primary"
                @click="copyCode(row)"
              />
              <PButton
                type="button"
                :label="sharedPluginId === row.id ? 'Udostępniono' : 'Udostępnij'"
                icon="pi pi-share-alt"
                severity="secondary"
                text
                class="input-dark action-neutral"
                @click="sharePlugin(row)"
              />
              <PButton
                type="button"
                label="Eksport JSON"
                icon="pi pi-download"
                severity="secondary"
                text
                class="input-dark action-neutral"
                @click="exportPluginJson(row)"
              />
              <PButton
                type="button"
                label="Edytuj"
                icon="pi pi-pencil"
                severity="warning"
                text
                class="input-dark action-edit"
                @click="hydrateForm(row)"
              />
              <PButton
                type="button"
                :label="isDeleting ? 'Deleting...' : 'Usuń'"
                icon="pi pi-trash"
                severity="danger"
                text
                class="input-dark action-danger"
                :disabled="isDeleting"
                @click="deletePlugin(row)"
              />
            </div>

            <div class="plugin-card-footer">
              <span>Created {{ new Date(row.created_at).toLocaleDateString() }}</span>
              <span v-if="copiedPluginId === row.id" class="positive">Code copied</span>
            </div>
          </article>
        </div>
      </div>
    </SectionCard>
  </div>
</template>


