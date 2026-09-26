import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from './config'

export type AppSupabaseClient = SupabaseClient<Database>

let client: AppSupabaseClient | null = null

/**
 * Browser singleton Supabase client (anon/publishable key only).
 * Returns null when env is not configured (legacy V2 local mode).
 */
export function getSupabase(): AppSupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  if (client) return client

  const url = getSupabaseUrl()!
  const key = getSupabasePublishableKey()!

  client = createClient<Database>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  })

  return client
}

/** Throws if Supabase env is missing — use in data-layer paths that require Auth. */
export function requireSupabase(): AppSupabaseClient {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error(
      'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.',
    )
  }
  return supabase
}
