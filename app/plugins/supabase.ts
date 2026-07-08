import { createClient } from '@supabase/supabase-js'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl
  const anonKey = config.public.supabaseAnonKey

  if (!url || !anonKey) {
    // The app can still bootstrap, but auth/data calls will fail until env vars are set.
    console.warn('Supabase env vars are missing. Set NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_ANON_KEY.')
  }

  const supabase = createClient(url || 'https://example.supabase.co', anonKey || 'public-anon-key', {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
      flowType: 'pkce',
    },
  })

  return {
    provide: {
      supabase,
    },
  }
})
