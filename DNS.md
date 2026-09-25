# Domínio — gratuito vs pago

## Não precisa de domínio pago

O **GitHub Pages** já hospeda de graça em:

**https://spadbut.github.io/evelynclinica/**

Para usar essa URL:
1. **Settings → Pages → Custom domain → Remove** (apague `evelynclinica.com.br` se estiver salvo)
2. Source = **GitHub Actions**
3. Merge do deploy na `main`

## Domínio próprio (opcional, pago)

`.com.br` no Registro.br **não é gratuito**. Só faça isso se quiser um endereço tipo `evelynclinica.com.br`.

Nesse caso, compre/registre o domínio e configure os records **A**:

| Tipo | Host | Valor |
|------|------|-------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

Opcional: CNAME `www` → `spadbut.github.io`

Depois: Settings → Pages → Custom domain → salvar → **Check again** → **Enforce HTTPS**.

## “Domínios gratuitos”?

Subdomínios grátis de terceiros (Freenom, etc.) costumam ser instáveis ou indisponíveis. Para a V1, o mais simples e confiável é a URL do GitHub Pages acima.
