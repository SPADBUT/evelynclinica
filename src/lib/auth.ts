/** Hash de senha com SHA-256 + salt (Web Crypto). Adequado para V2 local; em produção usar Argon2/bcrypt no servidor. */

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function createSalt(prefix = 'salt'): string {
  const random = crypto.getRandomValues(new Uint8Array(8))
  return `${prefix}-${toHex(random.buffer)}`
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(digest)
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const actual = await hashPassword(password, salt)
  return actual === expectedHash
}
