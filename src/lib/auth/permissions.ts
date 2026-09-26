/**
 * Frontend authorization helpers (UX only).
 * Real security is enforced by Postgres RLS via has_clinic_permission().
 *
 * Source of truth for role → capability: clinic_memberships.role (A1 enum clinic_role).
 * Keep this matrix aligned with public.has_clinic_permission in A2 migrations.
 */

import type { ClinicRole } from '../../types/database.types'

export type Permission =
  | 'clinics.read'
  | 'clinics.write'
  | 'memberships.read'
  | 'memberships.write'
  | 'patients.read'
  | 'patients.write'
  | 'patient_tags.read'
  | 'patient_tags.write'
  | 'crm_leads.read'
  | 'crm_leads.write'
  | 'appointments.read'
  | 'appointments.write'
  | 'treatments.read'
  | 'treatments.write'
  | 'treatment_sessions.read'
  | 'treatment_sessions.write'
  | 'clinical_records.read'
  | 'clinical_records.write'
  | 'documents.read'
  | 'documents.write'
  | 'quotes.read'
  | 'quotes.write'
  | 'products.read'
  | 'products.write'
  | 'product_batches.read'
  | 'product_batches.write'
  | 'treatment_product_usages.read'
  | 'treatment_product_usages.write'
  | 'photos.read'
  | 'photos.write'
  | 'interactions.read'
  | 'interactions.write'
  | 'alerts.read'
  | 'alerts.write'
  | 'tasks.read'
  | 'tasks.write'
  | 'procedures.read'
  | 'procedures.write'
  | 'procedure_templates.read'
  | 'procedure_templates.write'
  | 'secure_links.read'
  | 'secure_links.write'
  | 'audit_logs.read'
  | 'audit_logs.write'

const ASSISTANT_PERMISSIONS = new Set<Permission>([
  'clinics.read',
  'memberships.read',
  'patients.read',
  'patients.write',
  'patient_tags.read',
  'patient_tags.write',
  'crm_leads.read',
  'crm_leads.write',
  'appointments.read',
  'appointments.write',
  'treatments.read',
  'treatments.write',
  'treatment_sessions.read',
  'treatment_sessions.write',
  'clinical_records.read',
  'clinical_records.write',
  'documents.read',
  'documents.write',
  'quotes.read',
  'quotes.write',
  'products.read',
  'products.write',
  'product_batches.read',
  'product_batches.write',
  'treatment_product_usages.read',
  'treatment_product_usages.write',
  'photos.read',
  'photos.write',
  'interactions.read',
  'interactions.write',
  'alerts.read',
  'alerts.write',
  'tasks.read',
  'tasks.write',
  'procedures.read',
  'procedures.write',
  'procedure_templates.read',
  'procedure_templates.write',
  'secure_links.read',
  'secure_links.write',
])

const PROFESSIONAL_PERMISSIONS = new Set<Permission>([
  'clinics.read',
  'memberships.read',
  'patients.read',
  'patients.write',
  'patient_tags.read',
  'patient_tags.write',
  'appointments.read',
  'appointments.write',
  'treatments.read',
  'treatments.write',
  'treatment_sessions.read',
  'treatment_sessions.write',
  'clinical_records.read',
  'clinical_records.write',
  'documents.read',
  'documents.write',
  'photos.read',
  'photos.write',
  'products.read',
  'product_batches.read',
  'treatment_product_usages.read',
  'treatment_product_usages.write',
  'procedures.read',
  'procedure_templates.read',
  'alerts.read',
  'alerts.write',
  'tasks.read',
  'tasks.write',
  'secure_links.read',
])

const FINANCE_PERMISSIONS = new Set<Permission>([
  'clinics.read',
  'memberships.read',
  'patients.read',
  'crm_leads.read',
  'quotes.read',
  'quotes.write',
  'products.read',
  'products.write',
  'product_batches.read',
  'product_batches.write',
  'documents.read',
  'interactions.read',
])

/** UX check — always pair with RLS; never use as sole authorization. */
export function can(role: ClinicRole | null | undefined, permission: Permission): boolean {
  if (!role) return false
  if (role === 'admin') return true
  if (role === 'manager') {
    return permission !== 'memberships.write' && permission !== 'clinics.write'
  }
  if (role === 'assistant') return ASSISTANT_PERMISSIONS.has(permission)
  if (role === 'professional') return PROFESSIONAL_PERMISSIONS.has(permission)
  if (role === 'finance') return FINANCE_PERMISSIONS.has(permission)
  return false
}

/** Map V2 local role labels to V3 clinic_role when useful for UI. */
export function mapLegacyStaffRole(role: string): ClinicRole | null {
  if (role === 'admin') return 'admin'
  if (role === 'assistente' || role === 'assistant') return 'assistant'
  return null
}
