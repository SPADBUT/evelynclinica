import type { AuthChangeEvent, SupabaseClient } from '@supabase/supabase-js'
import {
  RECOVERY_PENDING_KEY,
  readRecoveryCallback,
  recoveryUrlWithoutSecrets,
  type RecoveryGate,
} from '../lib/staffRecovery'

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
    let sawRecovery = false
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'PASSWORD_RECOVERY') sawRecovery = true
    })
    try {
      const { data, error } = await client.auth.exchangeCodeForSession(
        callback.code,
        callback.flowId ? { flowId: callback.flowId } : undefined,
      )
      if (error || !data.session) return { status: 'expired' }
      if (!sawRecovery) return { status: 'not_recovery' }
      window.sessionStorage.setItem(RECOVERY_PENDING_KEY, '1')
      return { status: 'ready' }
    } catch {
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
