export const STAFF_RECOVERY_PATH = '/auth/recovery'
export const RECOVERY_PENDING_KEY = 'evelyn-v3-recovery-pending'

const FLOW_ID_PARAM = 'sb_flow_id'
const FLOW_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/
const SENSITIVE_PARAMS = [
  'code',
  FLOW_ID_PARAM,
  'error',
  'error_code',
  'error_description',
  'type',
  'access_token',
  'refresh_token',
  'token',
  'token_hash',
] as const

export type RecoveryGateStatus = 'ready' | 'missing' | 'expired' | 'not_recovery'

export interface RecoveryGate {
  status: RecoveryGateStatus
}

export interface RecoveryCallback {
  code: string | null
  flowId: string | null
  errorCode: string | null
}

export function recoveryRedirectTo(origin: string): string {
  return new URL(STAFF_RECOVERY_PATH, origin).toString()
}

export function readRecoveryCallback(href: string): RecoveryCallback {
  const url = new URL(href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const errorCode = firstText(
    url.searchParams.get('error_code'),
    hash.get('error_code'),
    url.searchParams.get('error'),
    hash.get('error'),
  )
  return {
    code: firstText(url.searchParams.get('code')),
    flowId: validFlowId(firstText(url.searchParams.get(FLOW_ID_PARAM))),
    errorCode,
  }
}

export function recoveryUrlWithoutSecrets(href: string): string {
  const url = new URL(href)
  for (const key of SENSITIVE_PARAMS) {
    url.searchParams.delete(key)
  }
  url.hash = ''
  return `${url.pathname}${url.search}`
}

function validFlowId(value: string | null): string | null {
  return value && FLOW_ID_PATTERN.test(value) ? value : null
}

function firstText(...values: Array<string | null>): string | null {
  for (const value of values) {
    const text = value?.trim()
    if (text) return text
  }
  return null
}
