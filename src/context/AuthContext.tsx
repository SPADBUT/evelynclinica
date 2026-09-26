import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { verifyPassword } from '../lib/auth'
import {
  getSession,
  getVerifiedUser,
  onAuthStateChange,
  resetPasswordForEmail,
  signInWithPassword,
  signOut as supabaseSignOut,
} from '../lib/data/auth'
import { isSupabaseConfigured } from '../lib/supabase/config'
import { getSupabase } from '../lib/supabase'
import { loadClinicData } from '../lib/storage'
import type { SessionUser } from '../types'
import { SESSION_KEY } from '../types'

type AuthMode = 'supabase' | 'legacy'

interface AuthContextValue {
  /** Unified UI identity (staff via Supabase or legacy local session). */
  user: SessionUser | null
  /** Supabase Auth user when authMode === 'supabase'. */
  authUser: User | null
  session: Session | null
  loading: boolean
  authMode: AuthMode
  supabaseReady: boolean
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }>
  signOut: () => Promise<void>
  resetPassword: (
    email: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  /** @deprecated Prefer signIn — kept for V2 call sites. */
  login: AuthContextValue['signIn']
  /** @deprecated Prefer signOut */
  logout: () => void
  isStaff: boolean
  isPatient: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readLegacySession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

function writeLegacySession(user: SessionUser | null) {
  if (!user) {
    localStorage.removeItem(SESSION_KEY)
    return
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

function sessionUserFromAuth(user: User, fallbackName?: string): SessionUser {
  const metaName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : undefined
  return {
    id: user.id,
    name: metaName || fallbackName || user.email?.split('@')[0] || 'Usuário',
    email: user.email ?? '',
    // Role is authorization (membership) — ClinicContext owns the real role.
    role: 'admin',
  }
}

async function legacyLogin(
  email: string,
  password: string,
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const data = loadClinicData()
  const found = data.users.find(
    (u) => u.active && u.email.trim().toLowerCase() === email.trim().toLowerCase(),
  )
  if (!found) {
    return { ok: false, error: 'E-mail ou senha inválidos.' }
  }
  const valid = await verifyPassword(password, found.passwordSalt, found.passwordHash)
  if (!valid) {
    return { ok: false, error: 'E-mail ou senha inválidos.' }
  }
  const session: SessionUser = {
    id: found.id,
    name: found.name,
    email: found.email,
    role: found.role,
    patientId: found.patientId,
  }
  writeLegacySession(session)
  return { ok: true, user: session }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabaseReady = isSupabaseConfigured()
  const [loading, setLoading] = useState(true)
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [legacyUser, setLegacyUser] = useState<SessionUser | null>(() =>
    supabaseReady ? null : readLegacySession(),
  )

  useEffect(() => {
    let cancelled = false
    let unsubscribe = () => {}

    async function bootstrap() {
      if (!supabaseReady || !getSupabase()) {
        if (!cancelled) {
          setLegacyUser(readLegacySession())
          setLoading(false)
        }
        return
      }

      try {
        const current = await getSession()
        if (cancelled) return
        setSession(current)
        if (current?.user) {
          // Prefer verified identity when resolving trusted state
          const verified = await getVerifiedUser()
          if (!cancelled && verified.ok) {
            setAuthUser(verified.data)
          } else if (!cancelled) {
            setAuthUser(current.user)
          }
        } else {
          setAuthUser(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }

      unsubscribe = onAuthStateChange((_event, nextSession) => {
        setSession(nextSession)
        setAuthUser(nextSession?.user ?? null)
        if (nextSession) {
          writeLegacySession(null)
          setLegacyUser(null)
        }
        setLoading(false)
      })
    }

    void bootstrap()
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [supabaseReady])

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (supabaseReady) {
        const result = await signInWithPassword(email, password)
        if (result.ok) {
          writeLegacySession(null)
          setLegacyUser(null)
          setAuthUser(result.data.user)
          setSession(result.data.session)
          const su = sessionUserFromAuth(result.data.user)
          return { ok: true as const, user: su }
        }

        // Allow legacy patient portal login only (until Secure Links / A5)
        const legacy = await legacyLogin(email, password)
        if (legacy.ok && legacy.user.role === 'paciente') {
          await supabaseSignOut().catch(() => undefined)
          setAuthUser(null)
          setSession(null)
          setLegacyUser(legacy.user)
          return legacy
        }
        return { ok: false as const, error: result.error }
      }

      const legacy = await legacyLogin(email, password)
      if (legacy.ok) setLegacyUser(legacy.user)
      return legacy
    },
    [supabaseReady],
  )

  const signOut = useCallback(async () => {
    if (supabaseReady && getSupabase()) {
      await supabaseSignOut()
    }
    writeLegacySession(null)
    setLegacyUser(null)
    setAuthUser(null)
    setSession(null)
  }, [supabaseReady])

  const resetPassword = useCallback(
    async (email: string) => {
      if (!supabaseReady) {
        return {
          ok: false as const,
          error: 'Recuperação de senha requer Supabase Auth configurado.',
        }
      }
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}${import.meta.env.BASE_URL}login`
          : undefined
      const result = await resetPasswordForEmail(email, redirectTo)
      if (!result.ok) return { ok: false as const, error: result.error }
      return { ok: true as const }
    },
    [supabaseReady],
  )

  const user: SessionUser | null = useMemo(() => {
    if (authUser) return sessionUserFromAuth(authUser)
    return legacyUser
  }, [authUser, legacyUser])

  const authMode: AuthMode = authUser ? 'supabase' : 'legacy'

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      authUser,
      session,
      loading,
      authMode,
      supabaseReady,
      signIn,
      signOut,
      resetPassword,
      login: signIn,
      logout: () => {
        void signOut()
      },
      isStaff:
        authMode === 'supabase'
          ? Boolean(authUser)
          : user?.role === 'admin' || user?.role === 'assistente',
      isPatient: authMode === 'legacy' && user?.role === 'paciente',
    }),
    [
      user,
      authUser,
      session,
      loading,
      authMode,
      supabaseReady,
      signIn,
      signOut,
      resetPassword,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
