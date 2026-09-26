# Auditoria localStorage (A2)

Classificação solicitada na A2. Não remoção indiscriminada.

| Chave | Onde | Classe | Notas |
|---|---|---|---|
| `evelyn-clinic-v2` | `src/lib/storage.ts` | **C** dado de negócio / **D** clínico | Fonte oficial V2 até migração A3/A6. Não é autorização. |
| `evelyn-clinic-v1` | `src/lib/storage.ts` | **C** legado | Lido uma vez para migrar para v2. |
| `evelyn-clinic-session-v2` | `AuthContext` | **E** sessão | Em modo Supabase, staff não usa esta chave. Mantida para portal paciente legado / modo sem env. |
| `evelyn-current-clinic-id` | `ClinicScopeContext` | **B** preferência UI | Nunca usada como fronteira de segurança (RLS decide). |
| Chaves do SDK Supabase (`sb-*-auth-token`) | `@supabase/supabase-js` | sessão Auth | Persistência oficial do SDK; app não grava tokens manualmente. |

## Regras

- **A** estado UI puro → pode permanecer
- **B** preferência local → pode permanecer
- **C** dado de negócio → migrar para Supabase (incremental)
- **D** dado clínico → não pode ser fonte oficial em localStorage a longo prazo
- **E** credencial/token → não armazenar manualmente

## Decisão A2

Auth de equipe → Supabase.  
Dados clínicos/operacionais da UI → ainda localStorage (sem rewrite V2).  
Preferência de clínica atual → localStorage (B).
