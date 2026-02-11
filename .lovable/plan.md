

## Correção: Seletor de quantidade por página (limit) não funciona

### Causa raiz

A API do Unipile espera `limit` como **query parameter na URL**, nao no corpo JSON da requisicao. Atualmente, o edge function envia `limit` dentro do `body` JSON, onde e ignorado pela API. Por isso, o valor padrao de **10 resultados** e sempre usado.

Documentacao da Unipile confirma:
- `limit` - query parameter (integer, 0 a 100, default 10)
- `cursor` - query parameter (string)
- `account_id` - query parameter (string, obrigatorio)

Alem disso, o limite maximo da API e **100 por requisicao** (Sales Navigator). As opcoes de 200 no seletor nao sao suportadas diretamente pela API.

### Plano de correcao

**1. Edge Function (`supabase/functions/unipile-search/index.ts`)**

Mover `limit` e `cursor` do corpo JSON para query parameters na URL:

- Construir a URL assim: `${baseUrl}/api/v1/linkedin/search?account_id=${accountId}&limit=${limit}`
- Quando houver cursor: `${baseUrl}/api/v1/linkedin/search?account_id=${accountId}&limit=${limit}&cursor=${cursor}`
- Remover `limit` e `cursor` do objeto `unipileBody` (corpo JSON)
- Quando usar cursor, o body deve conter apenas `{}` (vazio) ou ser omitido

**2. Ajustar opcoes do seletor (`SearchPagination.tsx`)**

- Alterar opcoes de `[25, 50, 100, 200]` para `[10, 25, 50, 100]`
- O maximo suportado pela API e 100, entao 200 deve ser removido

**3. Ajustar default nos componentes**

- Manter `DEFAULT_PER_PAGE = 25` em Companies.tsx, Contacts.tsx e Index.tsx (ja esta assim)

### Detalhes tecnicos

Arquivo principal: `supabase/functions/unipile-search/index.ts`

Mudanca na construcao da URL (linha ~328):

```text
ANTES:
  const unipileUrl = `${baseUrl}/api/v1/linkedin/search?account_id=${accountId}`;
  body: JSON.stringify({ ...params, limit, cursor })

DEPOIS:
  let unipileUrl = `${baseUrl}/api/v1/linkedin/search?account_id=${accountId}&limit=${limit || 25}`;
  if (cursor) unipileUrl += `&cursor=${encodeURIComponent(cursor)}`;
  body: JSON.stringify(cursorOnly ? {} : searchParams)  // sem limit/cursor no body
```

Arquivo secundario: `src/components/SearchPagination.tsx`
- Alterar `PER_PAGE_OPTIONS` de `[25, 50, 100, 200]` para `[10, 25, 50, 100]`

Nenhuma alteracao de banco de dados necessaria.

