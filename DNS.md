# DNS — evelynclinica.com.br → GitHub Pages

O erro `InvalidDNSError` / **DNS check unsuccessful** acontece porque o domínio ainda **não tem registros DNS** (hoje responde `NXDOMAIN`).

## No Registro.br (ou no provedor do domínio)

Edite a zona DNS de `evelynclinica.com.br` e configure:

### Opção recomendada — domínio raiz (apex)

Crie **4 registros A** (apague A/CNAME antigos do apex se existirem):

| Tipo | Nome/Host | Valor |
|------|-----------|-------|
| A | `@` (ou em branco) | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

Opcional (IPv6), **4 registros AAAA**:

| Tipo | Nome/Host | Valor |
|------|-----------|-------|
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |

### www (opcional, recomendado)

| Tipo | Nome/Host | Valor |
|------|-----------|-------|
| CNAME | `www` | `spadbut.github.io` |

## Depois de salvar o DNS

1. Espere a propagação (pode levar de minutos a algumas horas).
2. No GitHub: **Settings → Pages** → **Check again**.
3. Quando o check ficar verde, marque **Enforce HTTPS**.

## Conferir se já propagou

No terminal:

```bash
dig +short A evelynclinica.com.br
```

Deve listar os IPs `185.199.108–111.153`. Se continuar vazio ou `NXDOMAIN`, o DNS ainda não está publicado.
