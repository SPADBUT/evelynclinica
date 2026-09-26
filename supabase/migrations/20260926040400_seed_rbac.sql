-- A1: seed roles, permissions, role_permissions
-- Patients have no role. clinical.* prepared for future clinical tables (A1 has patients only).

insert into public.roles (code, name, description) values
  ('admin', 'Administrador', 'Acesso administrativo completo à organização'),
  ('clinician', 'Clínico', 'Acesso e escrita clínica'),
  ('assistant', 'Assistente', 'Acesso operacional; sem escrita de registros clínicos');

insert into public.permissions (code, name, description) values
  ('organizations.read', 'Ler organização', 'Ver dados da própria organização'),
  ('organizations.manage', 'Gerir organização', 'Atualizar dados da organização'),
  ('staff.read', 'Ler equipe', 'Listar staff da organização'),
  ('staff.manage', 'Gerir equipe', 'Atribuir roles e gerir staff_profiles'),
  ('patients.read', 'Ler pacientes', 'Ver cadastro de pacientes'),
  ('patients.write', 'Escrever pacientes', 'Criar/editar cadastro operacional de pacientes'),
  ('clinical.read', 'Ler clínico', 'Ler registros clínicos (tabelas futuras)'),
  ('clinical.write', 'Escrever clínico', 'Criar/editar registros clínicos (tabelas futuras)'),
  ('audit.read', 'Ler auditoria', 'Consultar audit_logs'),
  ('audit.write', 'Registrar auditoria', 'Inserir eventos em audit_logs');

-- admin: all permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'admin';

-- clinician: operational + clinical (no org/staff admin)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'organizations.read',
  'staff.read',
  'patients.read',
  'patients.write',
  'clinical.read',
  'clinical.write',
  'audit.read',
  'audit.write'
)
where r.code = 'clinician';

-- assistant: operational only — NO clinical.write / clinical.read write path
-- clinical.read denied too for least privilege on future clinical tables;
-- patients.* allowed as operational registry.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'organizations.read',
  'staff.read',
  'patients.read',
  'patients.write',
  'audit.write'
)
where r.code = 'assistant';
