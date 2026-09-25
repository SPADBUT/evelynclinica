import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { verifyPassword } from '../lib/auth'
import { loadClinicData } from '../lib/storage'
import type { SessionUser } from '../types'
import { SESSION_KEY } from '../types'

interface AuthContextValue {
  user: SessionUser | null
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }>
  logout: () => void
  isStaff: boolean
  isPatient: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

function writeSession(user: SessionUser | null) {
  if (!user) {
    localStorage.removeItem(SESSION_KEY)
    return
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => readSession())

  const login = useCallback(async (email: string, password: string) => {
    const data = loadClinicData()
    const found = data.users.find(
      (u) => u.active && u.email.trim().toLowerCase() === email.trim().toLowerCase(),
    )
    if (!found) {
      return { ok: false as const, error: 'E-mail ou senha inválidos.' }
    }
    const valid = await verifyPassword(password, found.passwordSalt, found.passwordHash)
    if (!valid) {
      return { ok: false as const, error: 'E-mail ou senha inválidos.' }
    }
    const session: SessionUser = {
      id: found.id,
      name: found.name,
      email: found.email,
      role: found.role,
      patientId: found.patientId,
    }
    writeSession(session)
    setUser(session)
    return { ok: true as const, user: session }
  }, [])

  const logout = useCallback(() => {
    writeSession(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login,
      logout,
      isStaff: user?.role === 'admin' || user?.role === 'assistente',
      isPatient: user?.role === 'paciente',
    }),
    [user, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
