# PR #6 superseded

A pull request draft **#6** (`cursor/a2-auth-rls-data-layer-ed23`) implementava Auth/RLS sobre o modelo legado:

- `clinics` / `clinic_id`
- `profiles` / `clinic_memberships`
- enum `clinic_role` com roles extras

A **Fase A canônica** (branch `cursor/v3-fase-a-foundation`) substitui essa base por:

- `organizations` / `organization_id`
- `staff_profiles` → `staff_roles` → `roles`
- `permissions` / `role_permissions`

**Não fazer merge da PR #6.**  
O trabalho útil de A2 (Auth runtime, cliente Supabase, guards) deve ser refeito sobre o schema canônico após aprovação do Checkpoint A1.
