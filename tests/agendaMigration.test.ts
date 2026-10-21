import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/20261010180000_cp17_agenda.sql', 'utf8')

const CREATE_SIGNATURE =
  'public.create_appointment(uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz, text)'
const UPDATE_SIGNATURE =
  'public.update_appointment(uuid, uuid, uuid, uuid, text, text, timestamptz, timestamptz, text)'
const TRANSITION_SIGNATURE = 'public.transition_appointment(uuid, uuid, text)'

describe('CP17 agenda migration', () => {
  it('adds professional and author columns without editing clinical writes', () => {
    expect(sql).toContain('btree_gist')
    expect(sql).toContain('add column professional_id uuid not null')
    expect(sql).toContain('add column created_by uuid not null')
    expect(sql).toContain('appointments_professional_overlap')
    expect(sql).toContain('appointments_patient_overlap')
    expect(sql).toContain("tstzrange(starts_at, ends_at, '[)')")
    expect(sql).toContain("status in ('scheduled', 'confirmed')")
    expect(sql).not.toContain('clinical_records')
    expect(sql).not.toContain('clinical_record_versions')
    expect(sql.toLowerCase()).not.toContain('drop table')
    expect(sql.toLowerCase()).not.toContain('for delete')
    expect(sql.toLowerCase()).not.toContain('delete from')
  })

  it('defines the three security definer writes with an empty search path', () => {
    expect(sql).toContain(`function ${CREATE_SIGNATURE}`)
    expect(sql).toContain(`function ${UPDATE_SIGNATURE}`)
    expect(sql).toContain(`function ${TRANSITION_SIGNATURE}`)
    expect(sql.match(/security definer/g)?.length).toBeGreaterThanOrEqual(7)
    expect(sql.match(/set search_path = ''/g)?.length).toBeGreaterThanOrEqual(9)
    expect(sql).toContain('public.current_user_id()')
    expect(sql).toContain('public.can_manage_agenda(')
    expect(sql).not.toContain('p_created_by')
    expect(sql).not.toContain('p_clinic_id uuid,\n  p_created_by')
    expect(sql.toLowerCase()).not.toContain('exception when')
  })

  it('grants execute only to authenticated and keeps audit off the client', () => {
    for (const signature of [CREATE_SIGNATURE, UPDATE_SIGNATURE, TRANSITION_SIGNATURE]) {
      expect(sql).toContain(`revoke all on function ${signature} from public;`)
      expect(sql).toContain(`revoke execute on function ${signature} from public, anon, authenticated, service_role;`)
      expect(sql).toContain(`grant execute on function ${signature} to authenticated;`)
    }
    expect(sql).toContain(
      'revoke execute on function public.write_appointment_audit(uuid, text, uuid, jsonb) from public, anon, authenticated, service_role;',
    )
    expect(sql).not.toContain('grant execute on function public.write_appointment_audit')
    expect(sql).not.toContain('grant execute on function public.list_bookable_professionals(uuid) to anon')
    expect(sql).not.toContain('grant execute on function public.list_active_procedures(uuid) to service_role')
    expect(sql).not.toContain('to service_role')
  })

  it('exposes a select policy only and strips notes from audit metadata', () => {
    expect(sql).toContain('create policy appointments_select_agenda')
    expect(sql).toContain('for select')
    expect(sql).not.toMatch(/create policy appointments_\w+\s+on public\.appointments\s+for insert/)
    expect(sql).not.toMatch(/create policy appointments_\w+\s+on public\.appointments\s+for update/)
    expect(sql).toContain("jsonb_build_object('status', 'scheduled')")
    expect(sql).toContain("jsonb_build_object('previous_status', v_record.status::text, 'status', v_status::text)")
    expect(sql).not.toMatch(/jsonb_build_object\([^)]*notes/)
    expect(sql).not.toMatch(/jsonb_build_object\([^)]*procedure_name/)
    expect(sql).not.toMatch(/jsonb_build_object\([^)]*title/)
    expect(sql).toContain("array['admin', 'assistant', 'professional', 'manager']")
    expect(sql).toContain("'admin'::public.clinic_role, 'professional'::public.clinic_role")
  })

  it('rechecks the professional while the appointment stays scheduled or confirmed', () => {
    expect(sql).toContain("v_recheck := new.status in ('scheduled', 'confirmed')")
    expect(sql).not.toContain('old.status not in')
  })
})
