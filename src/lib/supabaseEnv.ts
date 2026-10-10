function readEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

/** True only when the flag is the exact string "true". Absent or any other value keeps V2. */
export function isSupabaseAuthEnabled(): boolean {
  return readEnv('VITE_SUPABASE_AUTH_ENABLED') === 'true'
}

export function readSupabaseBrowserConfig():
  | { configured: true; url: string; anonKey: string }
  | { configured: false; reason: 'disabled' | 'missing_env' } {
  if (!isSupabaseAuthEnabled()) {
    return { configured: false, reason: 'disabled' }
  }

  const url = readEnv('VITE_SUPABASE_URL')
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY')
  if (!url || !anonKey) {
    return { configured: false, reason: 'missing_env' }
  }

  return { configured: true, url, anonKey }
}
