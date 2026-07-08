import type { Session, User } from '@supabase/supabase-js'

type AuthProfile = {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  timezone: string
  baseCurrency: string
  startingBalance: number
  currentBalance: number
}

const authFields = 'id, email, display_name, avatar_url, timezone, base_currency, starting_balance, current_balance'

function formatDisplayName(email?: string | null, displayName?: string | null) {
  return (
    displayName?.trim() ||
    email?.split('@')[0] ||
    'Trader'
  )
}

export function useAuth() {
  const supabase = useSupabase()

  const session = useState<Session | null>('pnl-ledger-auth-session', () => null)
  const user = useState<User | null>('pnl-ledger-auth-user', () => null)
  const profile = useState<AuthProfile | null>('pnl-ledger-auth-profile', () => null)
  const ready = useState<boolean>('pnl-ledger-auth-ready', () => false)
  const loading = useState<boolean>('pnl-ledger-auth-loading', () => false)
  const error = useState<string | null>('pnl-ledger-auth-error', () => null)
  const listenerReady = useState<boolean>('pnl-ledger-auth-listener-ready', () => false)

  const displayName = computed(() => formatDisplayName(user.value?.email, profile.value?.displayName))
  const startingBalance = computed(() => profile.value?.startingBalance ?? 0)
  const currentBalance = computed(() => profile.value?.currentBalance ?? 0)

  const initials = computed(() => {
    const source = displayName.value.trim() || 'TR'
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2)
      || 'TR'
  })

  async function loadProfile(userId: string, fallbackEmail?: string | null) {
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select(authFields)
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      throw profileError
    }

    if (!data) {
      const bootstrapProfile = {
        id: userId,
        email: fallbackEmail ?? user.value?.email ?? '',
        displayName: formatDisplayName(fallbackEmail ?? user.value?.email, null),
        avatarUrl: null,
        timezone: 'Europe/Warsaw',
        baseCurrency: 'USD',
        startingBalance: 0,
        currentBalance: 0,
      }

      const { data: insertedProfile, error: insertError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: bootstrapProfile.id,
            email: bootstrapProfile.email,
            display_name: bootstrapProfile.displayName,
            avatar_url: bootstrapProfile.avatarUrl,
            timezone: bootstrapProfile.timezone,
            base_currency: bootstrapProfile.baseCurrency,
            starting_balance: bootstrapProfile.startingBalance,
            current_balance: bootstrapProfile.currentBalance,
          },
          { onConflict: 'id' },
        )
        .select(authFields)
        .single()

      if (insertError) {
        throw insertError
      }

      profile.value = {
        id: insertedProfile.id,
        email: insertedProfile.email,
        displayName: formatDisplayName(insertedProfile.email, insertedProfile.display_name),
        avatarUrl: insertedProfile.avatar_url,
        timezone: insertedProfile.timezone,
        baseCurrency: insertedProfile.base_currency,
        startingBalance: Number(insertedProfile.starting_balance ?? 0),
        currentBalance: Number(insertedProfile.current_balance ?? 0),
      }
      return
    }

    profile.value = {
      id: data.id,
      email: data.email,
      displayName: formatDisplayName(data.email, data.display_name),
      avatarUrl: data.avatar_url,
      timezone: data.timezone,
      baseCurrency: data.base_currency,
      startingBalance: Number(data.starting_balance ?? 0),
      currentBalance: Number(data.current_balance ?? 0),
    }
  }

  async function syncAuth() {
    const { data, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      throw sessionError
    }

    session.value = data.session
    user.value = data.session?.user ?? null

    if (user.value) {
      await loadProfile(user.value.id, user.value.email)
    } else {
      profile.value = null
    }
  }

  function ensureAuthListener() {
    if (import.meta.server || listenerReady.value) {
      return
    }

    listenerReady.value = true
    supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      session.value = nextSession
      user.value = nextSession?.user ?? null

      if (user.value) {
        try {
          await loadProfile(user.value.id, user.value.email)
        } catch (caught) {
          error.value = caught instanceof Error ? caught.message : String(caught)
        }
      } else {
        profile.value = null
      }

      ready.value = true
    })
  }

  async function ensureAuthReady() {
    if (import.meta.server) {
      return
    }

    ensureAuthListener()

    if (loading.value) {
      return
    }

    if (ready.value && !loading.value) {
      return
    }

    loading.value = true
    error.value = null

    try {
      await syncAuth()
      ready.value = true
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : String(caught)
      session.value = null
      user.value = null
      profile.value = null
      ready.value = true
    } finally {
      loading.value = false
    }
  }

  async function refreshAuth() {
    ready.value = false
    await ensureAuthReady()
  }

  async function signIn(email: string, password: string) {
    error.value = null
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      error.value = signInError.message
      throw signInError
    }

    await refreshAuth()
  }

  async function signOut() {
    error.value = null
    await supabase.auth.signOut()
    session.value = null
    user.value = null
    profile.value = null
    ready.value = true
  }

  return {
    session,
    user,
    profile,
    ready,
    loading,
    error,
    displayName,
    startingBalance,
    currentBalance,
    initials,
    ensureAuthReady,
    refreshAuth,
    signIn,
    signOut,
  }
}
