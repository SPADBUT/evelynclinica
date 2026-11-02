import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'
import {
  RECOVERY_PENDING_KEY,
  readRecoveryCallback,
  recoveryUrlWithoutSecrets,
  type RecoveryGate,
} from '../lib/staffRecovery'

/**
 * Session observed before a PKCE code is exchanged.
 * `known: false` means the read failed or the tokens cannot be restored.
 * `session: null` means the read succeeded and no local session existed.
 */
interface CapturedSession {
  accessToken: string
  refreshToken: string
  userId: string | null
}

type PriorSession = { known: false } | { known: true; session: CapturedSession | null }

type EffectiveSession =
  | { readable: false }
  | { readable: true; accessToken: string | null; userId: string | null }

let bootstrap: Promise<RecoveryGate> | null = null

export function resetRecoveryBootstrapForTests(): void {
  bootstrap = null
}

/**
 * Reads the callback once, removes it from the address bar, and exchanges a
 * PKCE code a single time. A later mount awaits the same attempt.
 */
export function bootstrapRecoverySession(client: SupabaseClient): Promise<RecoveryGate> {
  if (!bootstrap) {
    bootstrap = runRecoveryBootstrap(client)
  }
  return bootstrap
}

async function runRecoveryBootstrap(client: SupabaseClient): Promise<RecoveryGate> {
  const callback = readRecoveryCallback(window.location.href)
  const cleaned = recoveryUrlWithoutSecrets(window.location.href)
  const current = `${window.location.pathname}${window.location.search}`
  if (cleaned !== current || window.location.hash) {
    window.history.replaceState(window.history.state, '', cleaned)
  }

  if (callback.errorCode) {
    window.sessionStorage.removeItem(RECOVERY_PENDING_KEY)
    return { status: 'expired' }
  }

  if (callback.code) {
    const prior = await readPriorSession(client)
    let sawRecovery = false
    let emitted: Session | null = null
    let acceptExchangeEvents = true
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      if (!acceptExchangeEvents) return
      if (event === 'PASSWORD_RECOVERY') sawRecovery = true
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session?.access_token) {
        emitted = session
      }
    })
    try {
      const { data, error } = await client.auth.exchangeCodeForSession(
        callback.code,
        callback.flowId ? { flowId: callback.flowId } : undefined,
      )
      acceptExchangeEvents = false
      if (error || !data.session) {
        await settleInterruptedExchange(client, prior, emitted)
        return { status: 'expired' }
      }
      if (!sawRecovery) {
        await forgetUnrelatedCodeSession(client, prior, data.session)
        return { status: 'not_recovery' }
      }
      window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
      return { status: 'ready' }
    } catch {
      acceptExchangeEvents = false
      await settleInterruptedExchange(client, prior, emitted)
      return { status: 'expired' }
    } finally {
      subscription.unsubscribe()
    }
  }

  if (window.sessionStorage.getItem(RECOVERY_PENDING_KEY) === '1') {
    const { data, error } = await client.auth.getSession()
    if (error || !data.session) {
      window.sessionStorage.removeItem(RECOVERY_PENDING_KEY)
      return { status: 'missing' }
    }
    return { status: 'ready' }
  }

  return { status: 'missing' }
}

export function clearRecoveryPending(): void {
  window.sessionStorage.removeItem(RECOVERY_PENDING_KEY)
}

async function readPriorSession(client: SupabaseClient): Promise<PriorSession> {
  try {
    const { data, error } = await client.auth.getSession()
    if (error) return { known: false }
    const session = data.session
    if (!session) return { known: true, session: null }
    const accessToken = session.access_token
    const refreshToken = session.refresh_token
    if (!accessToken || !refreshToken) return { known: false }
    return {
      known: true,
      session: {
        accessToken,
        refreshToken,
        userId: session.user?.id ?? null,
      },
    }
  } catch {
    return { known: false }
  }
}

/**
 * Removes the browser session created by a code that is not a recovery.
 * A different prior session is restored only when setSession and a following
 * read agree. Any other non-recovery result ends the session now in storage
 * with a local sign-out. Global sign-out is never used.
 * A returned error or a session that remains is not treated as a clean ending.
 */
async function forgetUnrelatedCodeSession(
  client: SupabaseClient,
  prior: PriorSession,
  created: Session,
): Promise<void> {
  window.sessionStorage.removeItem(RECOVERY_PENDING_KEY)
  const codeToken = created.access_token

  if (prior.known && prior.session && codeToken === prior.session.accessToken) {
    const effective = await readEffectiveSession(client)
    if (!effective.readable || effective.accessToken === prior.session.accessToken) return
    await endActiveLocalSession(client)
    return
  }

  if (prior.known && prior.session) {
    const restored = await restorePriorSession(client, prior.session, codeToken)
    if (!restored) await endActiveLocalSession(client)
    return
  }

  await endActiveLocalSession(client)
}

async function restorePriorSession(
  client: SupabaseClient,
  prior: CapturedSession,
  codeToken: string,
): Promise<boolean> {
  try {
    const { data, error } = await client.auth.setSession({
      access_token: prior.accessToken,
      refresh_token: prior.refreshToken,
    })
    if (error || !data.session) return false
    const effective = await readEffectiveSession(client)
    if (!effective.readable || !effective.accessToken) return false
    if (data.session.access_token !== effective.accessToken) return false
    if (effective.accessToken === codeToken && codeToken !== prior.accessToken) return false
    if (effective.accessToken === prior.accessToken) return true
    return Boolean(prior.userId && effective.userId === prior.userId)
  } catch {
    return false
  }
}

/**
 * The exchange promise failed or rejected. auth-js 2.117.2 saves a session and
 * then notifies subscribers; a later throw, or an AuthError thrown after that
 * save, still rejects or returns `{ error }` while storage may already hold
 * the new session. Compare that storage with the session captured before the
 * call. Sign out locally only when the read proves a new session. An
 * unreadable confirmation, or a session whose origin cannot be tied to this
 * exchange, is left in place.
 */
async function settleInterruptedExchange(
  client: SupabaseClient,
  prior: PriorSession,
  emitted: Session | null,
): Promise<void> {
  window.sessionStorage.removeItem(RECOVERY_PENDING_KEY)
  const effective = await readEffectiveSession(client)
  if (!effective.readable) return

  if (!effective.accessToken) {
    if (!(prior.known && prior.session)) return
    const restored = await restorePriorSession(client, prior.session, emitted?.access_token ?? '')
    if (restored) return
    const after = await readEffectiveSession(client)
    if (after.readable && after.accessToken) await endActiveLocalSession(client)
    return
  }

  const captured = prior.known ? prior.session : null
  if (captured && effective.accessToken === captured.accessToken) return

  if (captured) {
    const restored = await restorePriorSession(client, captured, effective.accessToken)
    if (!restored) await endActiveLocalSession(client)
    return
  }

  if (prior.known) {
    await endActiveLocalSession(client)
    return
  }

  if (emitted?.access_token && emitted.access_token === effective.accessToken) {
    await endActiveLocalSession(client)
  }
}

async function runLocalSignOut(
  client: SupabaseClient,
): Promise<{ failed: boolean; sawSignedOut: boolean }> {
  let sawSignedOut = false
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((event: AuthChangeEvent) => {
    if (event === 'SIGNED_OUT') sawSignedOut = true
  })
  let failed = false
  try {
    const { error } = await client.auth.signOut({ scope: 'local' })
    failed = error != null
  } catch {
    failed = true
  } finally {
    subscription.unsubscribe()
  }
  return { failed, sawSignedOut }
}

async function endActiveLocalSession(client: SupabaseClient): Promise<void> {
  const first = await runLocalSignOut(client)
  const effective = await readEffectiveSession(client)
  const storageEmpty = effective.readable && effective.accessToken == null
  // A throw after `_removeSession` can leave storage empty without SIGNED_OUT.
  // A second local sign-out then has no access token, so auth-js does not call
  // /logout; it only notifies subscribers. Any other failure stops here.
  if (first.failed && storageEmpty && !first.sawSignedOut) {
    await runLocalSignOut(client)
  }
}

async function readEffectiveSession(client: SupabaseClient): Promise<EffectiveSession> {
  try {
    const { data, error } = await client.auth.getSession()
    if (error) return { readable: false }
    const accessToken = data.session?.access_token
    if (!accessToken) return { readable: true, accessToken: null, userId: null }
    return {
      readable: true,
      accessToken,
      userId: data.session?.user?.id ?? null,
    }
  } catch {
    return { readable: false }
  }
}
