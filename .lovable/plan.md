

## Resolucao de URL Publica do LinkedIn via Unipile

### Problema
Todos os leads vindos do Sales Navigator possuem URLs no formato `/sales/lead/ACwAAA...`, que o Apify nao consegue processar. Sem uma URL publica (`/in/username`), o Apify nunca e acionado e o Apollo e chamado indevidamente como unico caminho.

### Solucao
Adicionar uma etapa de resolucao de URL na `enrich-lead` Edge Function que converte URLs do Sales Navigator em URLs publicas usando a API do Unipile (`GET /api/v1/users/{provider_id}`).

### Fluxo Atualizado

```text
Sales Navigator URL (/sales/lead/ID)
         |
         v
  Extrair provider_id da URL
         |
         v
  Unipile GET /api/v1/users/{provider_id}
         |
         v
  Extrair public_identifier da resposta
         |
         v
  linkedin.com/in/{public_identifier}
         |
         v
  Apify (async) --> webhook --> fallback Apollo
```

### Detalhes Tecnicos

**1. Modificar `supabase/functions/enrich-lead/index.ts`**

- Adicionar funcao `resolvePublicLinkedInUrl(salesNavUrl, unipileApiKey, unipileBaseUrl, accountId)`:
  - Extrai o ID do provider da URL do Sales Navigator (ex: `ACwAAASNCJcBS2NERCgi0j...`)
  - Chama `GET {UNIPILE_BASE_URL}/api/v1/users/{provider_id}?account_id={UNIPILE_ACCOUNT_ID}`
  - Extrai `public_identifier` da resposta
  - Retorna `https://www.linkedin.com/in/{public_identifier}`
  - Em caso de falha: retorna `null` (fallback para Apollo direto)

- Modificar `toPublicLinkedInUrl` para se tornar async e chamar a resolucao quando detectar URL do Sales Navigator
- Usar as secrets ja configuradas: `UNIPILE_API_KEY`, `UNIPILE_BASE_URL`, `UNIPILE_ACCOUNT_ID`

**2. Fluxo de decisao atualizado no `enrich-lead`:**

```text
linkedinUrl do item
    |
    +-- ja e /in/username? --> usar direto --> Apify async
    |
    +-- e /sales/lead/ID? --> Unipile lookup --> obtem /in/username
    |       |
    |       +-- sucesso? --> Apify async
    |       +-- falha? --> Apollo direto (se identificadores fortes)
    |
    +-- sem URL? --> Apollo direto (se identificadores fortes)
```

**3. Nenhuma mudanca necessaria em:**
- `webhooks-apify/index.ts` (ja processa resultados corretamente)
- Banco de dados (campos ja existem)
- Frontend (ja escuta Realtime)

**4. Extracao do provider_id:**
A URL do Sales Navigator segue o padrao:
- `linkedin.com/sales/lead/ACwAAASNCJcBS2NERCgi0j_f7_oYqCSbTGsNYBc`
- O ID apos `/lead/` e o provider_id que o Unipile aceita como identifier

**5. Resposta esperada do Unipile:**
```json
{
  "public_identifier": "luciano-bana",
  "first_name": "Luciano",
  "last_name": "Bana",
  ...
}
```

### Riscos e Mitigacoes

- **Rate limit do Unipile**: A resolucao e feita 1 lead por vez (disparo manual), sem risco de burst
- **Timeout**: Timeout de 8s na chamada Unipile; em caso de falha, fallback para Apollo
- **ID invalido**: Se o Unipile nao encontrar o perfil, log + fallback para Apollo

