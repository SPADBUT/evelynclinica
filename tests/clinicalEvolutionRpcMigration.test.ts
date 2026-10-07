import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/20261007220000_cp16_clinical_evolution_rpc.sql', 'utf8')
const previous = readFileSync('supabase/migrations/20261007160000_cp16_clinical_record_access.sql', 'utf8')

const CREATE_SIGNATURE =
  'public.create_clinical_evolution(uuid, uuid, uuid, uuid, uuid, text, timestamptz, text, text, text, text, text)'
const APPEND_SIGNATURE =
  'public.append_clinical_evolution(uuid, uuid, text, timestamptz, text, text, text, text, text)'
const TRANSITION_SIGNATURE = 'public.transition_clinical_evolution(uuid, uuid, text)'

describe('CP16.1 transactional clinical evolution migration', () => {
  it('defines the three security definer functions with an empty search path', () => {
    expect(sql).toContain(`function ${CREATE_SIGNATURE}`)
    expect(sql).toContain(`function ${APPEND_SIGNATURE}`)
    expect(sql).toContain(`function ${TRANSITION_SIGNATURE}`)
    expect(sql.match(/security definer/g)).toHaveLength(3)
    expect(sql.match(/set search_path = ''/g)).toHaveLength(3)
    expect(sql.match(/\nvolatile\n/g)).toHaveLength(3)
    expect(sql).toContain('public.current_user_id()')
    expect(sql).toContain('public.can_access_clinical_records(')
    expect(sql).not.toContain('professional_name')
    expect(sql).not.toContain('p_created_by')
    expect(sql).not.toContain('p_version_number')
    expect(sql).not.toContain('p_current_version_id')
    expect(sql.toLowerCase()).not.toContain('commit')
    expect(sql.toLowerCase()).not.toContain('rollback')
    expect(sql.toLowerCase()).not.toContain('exception when')
  })

  it('locks the header before numbering an append and before a transition', () => {
    const append = sql.slice(sql.indexOf('function public.append_clinical_evolution'), sql.indexOf('function public.transition_clinical_evolution'))
    const transition = sql.slice(sql.indexOf('function public.transition_clinical_evolution'))
    expect(append).toContain('for update')
    expect(append.indexOf('for update')).toBeLessThan(append.indexOf('max(v.version_number)'))
    expect(transition).toContain('for update')
    expect(transition).not.toContain('insert into public.clinical_record_versions')
  })

  it('grants execute only to authenticated and closes direct audit writes', () => {
    for (const signature of [CREATE_SIGNATURE, APPEND_SIGNATURE, TRANSITION_SIGNATURE]) {
      expect(sql).toContain(`revoke all on function ${signature} from public;`)
      expect(sql).toContain(`revoke execute on function ${signature} from public, anon, authenticated, service_role;`)
      expect(sql).toContain(`grant execute on function ${signature} to authenticated;`)
    }
    expect(sql).toContain(
      'revoke execute on function public.write_clinical_audit(uuid, text, text, uuid, jsonb) from authenticated;',
    )
    expect(sql).not.toContain('grant execute on function public.write_clinical_audit')
    expect(sql).not.toContain('to service_role')
    expect(previous).toContain(
      'grant execute on function public.write_clinical_audit(uuid, text, text, uuid, jsonb) to authenticated;',
    )
  })

  it('drops only the client write policies and keeps audit metadata minimal', () => {
    expect(sql).toContain('drop policy clinical_records_insert_clinical on public.clinical_records;')
    expect(sql).toContain('drop policy clinical_records_update_clinical on public.clinical_records;')
    expect(sql).toContain('drop policy clinical_record_versions_insert_clinical on public.clinical_record_versions;')
    expect(sql).not.toContain('drop policy clinical_records_select_clinical')
    expect(sql).not.toContain('drop policy clinical_record_versions_select_clinical')
    expect(sql).not.toContain('drop policy procedures_select_clinical')
    expect(sql).not.toContain('drop policy treatments_select_clinical')
    expect(sql).not.toContain('drop policy treatment_sessions_select_clinical')
    expect(sql.toLowerCase()).not.toContain('for delete')
    expect(sql.toLowerCase()).not.toContain('drop table')
    expect(sql).toContain("jsonb_build_object('version_number', 1, 'status', 'draft')")
    expect(sql).toContain("jsonb_build_object('version_number', v_next, 'status', v_status::text)")
    expect(sql).toContain("jsonb_build_object('version_number', v_number, 'status', v_status::text)")
    expect(sql).not.toMatch(/jsonb_build_object\([^)]*anamnesis/)
    expect(sql).not.toMatch(/jsonb_build_object\([^)]*evolution/)
    expect(sql).not.toMatch(/jsonb_build_object\([^)]*products_used_summary/)
    expect(sql).not.toMatch(/jsonb_build_object\([^)]*next_steps/)
    expect(sql).not.toMatch(/jsonb_build_object\([^)]*change_reason/)
  })
})
