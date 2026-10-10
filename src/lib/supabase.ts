import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SupabaseAuthError } from './supabaseAuthError'
import { readSupabaseBrowserConfig } from './supabaseEnv'

let browserClient: SupabaseClient | undefined

/**
 * Browser client using only the anon key.
 * Importing this module does not create a client and does not query the database.
 */
export function getSupabaseClient(): SupabaseClient {
  const config = readSupabaseBrowserConfig()
  if (!config.configured) {
    throw new SupabaseAuthError(
      config.reason,
      config.reason === 'disabled'
        ? 'Supabase Auth está desligado.'
        : 'Supabase Auth está ligado, mas a URL ou a chave anon não foi configurada.',
    )
  }

  if (!browserClient) {
    browserClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'evelyn-supabase-auth',
      },
    })
  }

  return browserClient
}

export function resetSupabaseClientForTests(): void {
  browserClient = undefined
}
