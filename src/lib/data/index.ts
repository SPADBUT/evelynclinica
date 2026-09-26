/**
 * Data Layer (A2 foundation)
 *
 * UI must call these modules instead of scattering supabase.from(...) in components.
 * Full ClinicContext replacement remains incremental (A3).
 *
 * Domains:
 *   auth | clinics/membership | patients | appointments | treatments |
 *   documents | quotes | products
 */

export * as authData from './auth'
export * as clinicsData from './clinics'
export * as patientsData from './patients'
export * as appointmentsData from './appointments'
export * as treatmentsData from './treatments'
export * as documentsData from './documents'
export * as quotesData from './quotes'
export * as productsData from './products'
