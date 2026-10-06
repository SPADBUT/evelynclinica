import { createClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseAuthError } from '../src/lib/supabaseAuthError'
import { getSupabaseClient, resetSupabaseClientForTests } from '../src/lib/supabase'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ auth: {}, from: vi.fn(), rpc: vi.fn() })),
}))

describe('supabase client', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    resetSupabaseClientForTests()
    vi.mocked(createClient).mockClear()
  })

  it('does not create a client when the module is imported', async () => {
    vi.resetModules()
    await import('../src/lib/supabase')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('stays disabled when the feature flag is absent', () => {
    expect(() => getSupabaseClient()).toThrow(SupabaseAuthError)
    try {
      getSupabaseClient()
    } catch (error) {
      expect(error).toBeInstanceOf(SupabaseAuthError)
      expect((error as SupabaseAuthError).code).toBe('disabled')
    }
    expect(createClient).not.toHaveBeenCalled()
  })

  it('stays disabled when the feature flag is false', () => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'false')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    expect(() => getSupabaseClient()).toThrow(SupabaseAuthError)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('reports missing env when the flag is on and credentials are absent', () => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    try {
      getSupabaseClient()
      throw new Error('expected missing env')
    } catch (error) {
      expect(error).toBeInstanceOf(SupabaseAuthError)
      expect((error as SupabaseAuthError).code).toBe('missing_env')
      expect((error as SupabaseAuthError).message).not.toMatch(/service/i)
    }
    expect(createClient).not.toHaveBeenCalled()
  })

  it('creates one browser client when url and anon key are configured', () => {
    vi.stubEnv('VITE_SUPABASE_AUTH_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    const first = getSupabaseClient()
    const second = getSupabaseClient()

    expect(first).toBe(second)
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({ storageKey: 'evelyn-supabase-auth' }),
      }),
    )
    const options = vi.mocked(createClient).mock.calls[0][2] as { auth?: object }
    expect(JSON.stringify(options)).not.toMatch(/service_role/i)
  })
})
