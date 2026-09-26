/**
 * Supabase environment configuration (browser / Vite).
 * Never put service_role keys here.
 */

export function getSupabaseUrl(): string | undefined {
  const value = import.meta.env.VITE_SUPABASE_URL
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function getSupabasePublishableKey(): string | undefined {
  const value =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** True when URL + publishable/anon key are present (staff Auth via Supabase). */
export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey())
}
