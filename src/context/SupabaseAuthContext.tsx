import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseAuthEnabled, readSupabaseBrowserConfig } from '../lib/supabaseEnv'
import { getSupabaseClient } from '../lib/supabase'
import { SupabaseAuthError } from '../lib/supabaseAuthError'
import {
  signInWithPassword as requestSignIn,
  signOut as requestSignOut,
} from '../services/supabaseAuthService'
import type { SupabaseAuthState } from '../types/supabaseAuth'

export interface SupabaseAuthContextValue extends SupabaseAuthState {
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ ok: true; userId: string } | { ok: false; error: SupabaseAuthError }>
  signOut: () => Promise<{ ok: true } | { ok: false; error: SupabaseAuthError }>
}

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(null)

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const enabled = isSupabaseAuthEnabled()
  const configured = readSupabaseBrowserConfig().configured
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [sessionReady, setSessionReady] = useState(!configured)
  const [authError, setAuthError] = useState<SupabaseAuthError | null>(() =>
    enabled && !configured
      ? new SupabaseAuthError(
          'missing_env',
          'Supabase Auth está ligado, mas a URL ou a chave anon não foi configurada.',
        )
      : null,
  )
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!configured) return
    let cancelled = false
    const client = getSupabaseClient()

    const publishSession = (next: Session | null) => {
      if (cancelled) return
      const nextUser = next?.user ?? null
      const nextId = nextUser?.id ?? null
      setSession(next)
      if (userIdRef.current !== nextId) {
        userIdRef.current = nextId
        setUser(nextUser)
      }
      setAuthError(null)
      setSessionReady(true)
    }

    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setAuthError(new SupabaseAuthError('auth_failed', 'Não foi possível ler a sessão.'))
          setSession(null)
          setUser(null)
          userIdRef.current = null
          setSessionReady(true)
          return
        }
        publishSession(data.session)
      })
      .catch(() => {
        if (cancelled) return
        setAuthError(new SupabaseAuthError('auth_failed', 'Não foi possível ler a sessão.'))
        setSessionReady(true)
      })

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      publishSession(nextSession)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [configured])

  const signInWithPassword = useCallback(
    (email: string, password: string) => requestSignIn(email, password),
    [],
  )

  const signOut = useCallback(() => requestSignOut(), [])

  const value = useMemo<SupabaseAuthContextValue>(
    () => ({
      enabled,
      configured,
      loading: configured && !sessionReady,
      session,
      user,
      error: authError,
      signInWithPassword,
      signOut,
    }),
    [enabled, configured, sessionReady, session, user, authError, signInWithPassword, signOut],
  )

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>
}

export function useSupabaseAuth(): SupabaseAuthContextValue {
  const context = useContext(SupabaseAuthContext)
  if (!context) {
    throw new Error('useSupabaseAuth deve ser usado dentro de SupabaseAuthProvider')
  }
  return context
}
