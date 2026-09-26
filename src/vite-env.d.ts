/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  /** Preferred publishable key name (Supabase dashboard). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Alias accepted for compatibility with older docs. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
