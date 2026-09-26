# Mapping V2 → V3 (dados) — referência histórica

> **Nota:** o destino de colunas abaixo ainda cita nomes do schema legado (`clinics`, `clinic_id`, `profiles`, `clinic_memberships`) da primeira A1.  
> O **schema canônico** atual usa `organizations` / `organization_id` / `staff_profiles` / `staff_roles`.  
> Ver `docs/SCHEMA_FOUNDATION_A1.md`. A migração de dados (ETL) será refeita nas fases posteriores alinhada ao canônico.

Documento de mapeamento para a migração futura.  
**A1 canônico não executa migração de dados.**

Senhas de pacientes V2 **não** são migradas. Pacientes V3 não terão login/senha.

---

## Visão geral

| V2 (`ClinicData` / tipos) | V3 (PostgreSQL) | Notas |
|---|---|---|
| _(implícito: 1 clínica)_ | `clinics` | Criar clínica seed no import |
| `AuthUser` (admin/assistente) | `auth.users` + `profiles` + `clinic_memberships` | Roles: `admin`, `assistant` |
| `AuthUser` (role `paciente`) | — | **Não migrar** conta; usar Secure Links depois |
| `Patient` | `patients` | Tags → `patient_tags` |
| `Patient.tags[]` | `patient_tags` | Uma linha por tag |
| `Lead` | `crm_leads` | `patient_id` nullable |
| `Appointment` | `appointments` | Status mapeados (ver abaixo) |
| `MedicalRecordEntry` | `clinical_records` + `clinical_record_versions` | 1 record + 1 versão inicial |
| — | `treatments` / `treatment_sessions` / `procedures` | Inferir ou criar stubs no ETL se necessário |
| `ConsentForm` | `documents` + `document_versions` (+ `document_signatures` se assinado) | `type = consent` |
| `Contract` | `documents` + `document_versions` (+ signatures) | `type = contract` |
| `Budget` / `BudgetItem` | `quotes` / `quote_items` | |
| `Interaction` | `interactions` | |
| `Reminder` | `alerts` (e/ou `tasks` se operacional genérico) | Ver regras |
| `PhotoRecord` | `photos` | `imageData` Base64 → Storage na A4/A6; A1 só metadata |
| Sessão local | — | Não migrar |

---

## Enums / status

### Paciente

| V2 | V3 `patient_status` |
|---|---|
| `ativo` | `active` |
| `inativo` | `inactive` |
| `em_tratamento` | `in_treatment` |

### Agenda

| V2 | V3 `appointment_status` |
|---|---|
| `agendado` | `scheduled` |
| `confirmado` | `confirmed` |
| `realizado` | `completed` |
| `cancelado` | `cancelled` |
| `faltou` | `no_show` |

### CRM lead

| V2 `LeadStage` | V3 `crm_lead_stage` |
|---|---|
| `lead` | `lead` |
| `avaliacao` | `evaluation` |
| `tratamento` | `treatment` |
| `manutencao` | `maintenance` |

### Consentimento → documento

| V2 `ConsentStatus` | V3 `document_status` |
|---|---|
| `rascunho` | `draft` |
| `enviado` | `sent` |
| `assinado` | `signed` |
| `expirado` | `expired` |

### Contrato → documento

| V2 `ContractStatus` | V3 `document_status` |
|---|---|
| `rascunho` | `draft` |
| `enviado` | `sent` |
| `assinado` | `signed` |
| `encerrado` | `cancelled` |

### Orçamento

| V2 `BudgetStatus` | V3 `quote_status` |
|---|---|
| `rascunho` | `draft` |
| `enviado` | `sent` |
| `aprovado` | `approved` |
| `recusado` | `refused` |
| `expirado` | `expired` |

### Foto

| V2 `PhotoSide` | V3 `photo_category` |
|---|---|
| `antes` | `before` |
| `depois` | `after` |

(`during` / `follow_up` são novos na V3.)

### Interação

| V2 | V3 `interaction_channel` |
|---|---|
| `whatsapp` | `whatsapp` |
| `email` | `email` |
| `ligacao` | `phone` |
| `outro` | `other` |

### Reminder

| V2 `ReminderKind` | Destino V3 |
|---|---|
| `retorno` | `alerts` (`kind = return`) |
| `orcamento_validade` | `alerts` (`kind = quote_expiry`) |
| `outro` | `tasks` (ou `alerts` com `kind = other`) |

---

## Campos principais

### Patient → patients

| V2 | V3 |
|---|---|
| `id` | `id` (preservar UUID se válido) |
| `name` | `full_name` |
| `email`, `phone`, `cpf` | idem |
| `birthDate` | `birth_date` |
| `gender` | `gender` |
| `address` | `address` |
| `allergies`, `medications`, `notes` | idem |
| `status` | `status` (mapeado) |
| `createdAt` / `updatedAt` | `created_at` / `updated_at` |
| — | `clinic_id` |
| — | `deleted_at` null |

### Lead → crm_leads

| V2 | V3 |
|---|---|
| `name`, `email`, `phone`, `source`, `interest`, `notes` | idem |
| `stage` | `stage` (mapeado) |
| `patientId` | `patient_id` (nullable) |
| `createdAt` / `updatedAt` | timestamps |

### MedicalRecordEntry → clinical_records + clinical_record_versions

Para cada entry V2 (ordem obrigatória por causa do ponteiro `current_version_id` nullable):

1. Inserir `clinical_records` com `status = finalized` e `current_version_id = null`.
2. Inserir `clinical_record_versions` versão `1` com:
   - `procedure_name` ← `procedure`
   - `professional_name` ← `professional`
   - `anamnesis`, `evolution`, `next_steps` ← campos V2
   - `recorded_at` ← `date` (ou `createdAt`)
   - `clinic_id` igual ao do header
3. Atualizar `clinical_records.current_version_id` para o id da versão criada.

Não inserir header e versão com FK circular preenchida no mesmo INSERT: o ponteiro nasce null e é atualizado depois (ver `docs/SCHEMA_A1.md`).

`productsUsed` (texto livre V2) → campo de resumo na versão; usages estruturados só quando houver parse confiável (**STATUS: FUTURO / NÃO DECIDIDO** no ETL).

### ConsentForm / Contract → documents

1. `documents` com `type` adequado e `status` mapeado.
2. `document_versions` v1 com `content` / cláusulas.
3. Se assinado: `document_signatures` com nome, timestamp, user agent; assinatura canvas → Storage depois (A4/A6).

### Budget → quotes + quote_items

Mapeamento 1:1 de cabeçalho e itens (`description`, `quantity`, `unit_price`).

### PhotoRecord → photos

| V2 | V3 |
|---|---|
| `patientId` | `patient_id` |
| `procedure` | `metadata.procedure_name` ou nota |
| `side` | `category` |
| `takenAt` | `captured_at` |
| `notes` | `metadata.notes` |
| `imageData` | **não** no Postgres; upload Storage + `storage_path` |
| `pairId` | `metadata.pair_id` |

---

## Relatório esperado do ETL (A6)

- registros encontrados / importados
- duplicidades
- inválidos / erros
- sem relacionamento (órfãos)
- fotos migradas (metadata + storage)
- documentos migrados
- contas paciente **excluídas** da migração (contagem)

---

## Idempotência

Preferir upsert por UUID de origem V2 preservado, ou tabela de controle `migration_id` / external key.

**STATUS: FUTURO / NÃO DECIDIDO** — detalhe do script ETL.
