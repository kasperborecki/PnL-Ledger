import type { SupabaseClient } from '@supabase/supabase-js'

export function useSupabase() {
  return useNuxtApp().$supabase as SupabaseClient
}
