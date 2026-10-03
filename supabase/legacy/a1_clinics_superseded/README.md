# Legacy — A1 clinics schema (SUPERSEDED)

Estas migrations e o script `validate_a1_schema.sql` foram a entrega inicial da fundação V3 (PR #5), baseada em:

- `clinics` / `clinic_id`
- `profiles` / `clinic_memberships`
- enum `clinic_role` (`admin`, `assistant`, `professional`, `finance`, `manager`)
- schema clínico amplo (treatments, documents, products, secure_links, …)

**Não são aplicáveis como foundation do V3.**

O schema canônico atual está em `supabase/migrations/` e usa:

- `organizations` / `organization_id`
- `staff_profiles` → `staff_roles` → `roles`
- `permissions` / `role_permissions`
- `patients`, `audit_logs`

Mantido apenas como referência histórica. Não colocar estes arquivos de volta em `supabase/migrations/`.

A PR #6 (`cursor/a2-auth-rls-data-layer-ed23`) também se baseia neste modelo legado e está **superseded** pela Fase A canônica — não fazer merge.
