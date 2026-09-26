import type { Session, User } from '@supabase/supabase-js'
import { requireSupabase } from '../supabase'

export type AuthResult<T> = { ok: true; data: T } | { ok: false; error: string }

function mapError(error: { message?: string } | null, fallback: string): string {
  return error?.message?.trim() || fallback
}

/** Verified identity via Auth API (not only local session cache). */
export async function getVerifiedUser(): Promise<AuthResult<User>> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return { ok: false, error: mapError(error, 'Sessão inválida ou expirada.') }
  }
  return { ok: true, data: data.user }
}

export async function getSession(): Promise<Session | null> {
  const supabase = requireSupabase()
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthResult<{ user: User; session: Session }>> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error || !data.user || !data.session) {
    return { ok: false, error: mapError(error, 'E-mail ou senha inválidos.') }
  }
  return { ok: true, data: { user: data.user, session: data.session } }
}

export async function signOut(): Promise<AuthResult<null>> {
  const supabase = requireSupabase()
  const { error } = await supabase.auth.signOut()
  if (error) return { ok: false, error: mapError(error, 'Falha ao encerrar sessão.') }
  return { ok: true, data: null }
}

export async function resetPasswordForEmail(
  email: string,
  redirectTo?: string,
): Promise<AuthResult<null>> {
  const supabase = requireSupabase()
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  })
  if (error) {
    return { ok: false, error: mapError(error, 'Não foi possível enviar o e-mail de recuperação.') }
  }
  return { ok: true, data: null }
}

export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void,
): () => void {
  const supabase = requireSupabase()
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })
  return () => data.subscription.unsubscribe()
}
