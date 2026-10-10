import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/20261007160000_cp16_clinical_record_access.sql', 'utf8')
const roleHelper = readFileSync('supabase/migrations/20261006030000_a2_security_rls.sql', 'utf8')

describe('CP16 clinical access migration', () => {
  it('keeps clinical access to active admin, manager and professional', () => {
    expect(sql).toContain("array['admin', 'manager', 'professional']::public.clinic_role[]")
    expect(sql).not.toMatch(/array\[[^\]]*assistant/)
    expect(sql).not.toMatch(/array\[[^\]]*finance/)
    expect(sql).toContain('public.has_clinic_role(')
    expect(roleHelper).toContain('and m.is_active = true')
  })

  it('makes versions insert-only and keeps audit metadata minimal', () => {
    expect(sql).toContain('clinical_record_versions are immutable')
    expect(sql).not.toMatch(/on public\.clinical_record_versions[\s\S]{0,120}for update/)
    expect(sql).not.toMatch(/for delete/)
    expect(sql.toLowerCase()).not.toContain('drop table')
    expect(sql).toContain("jsonb_build_object('version_number'")
    expect(sql).toContain("jsonb_build_object('status'")
    expect(sql).toContain('v_metadata')
    expect(sql).not.toContain('p_metadata,')
    expect(sql).toContain(
      'grant execute on function public.write_clinical_audit(uuid, text, text, uuid, jsonb) to authenticated;',
    )
    expect(sql).toContain(
      'revoke execute on function public.write_clinical_audit(uuid, text, text, uuid, jsonb) from public, anon, service_role;',
    )
    expect(sql).not.toContain(
      'grant execute on function public.write_clinical_audit(uuid, text, text, uuid, jsonb) to service_role',
    )
  })
})
