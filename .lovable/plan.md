

## Enriquecer resultados de empresas com localização real via API de perfil

### Problema
O endpoint de busca do Unipile (`/api/v1/linkedin/search`) retorna `location: null` para empresas. Porém, o endpoint de perfil individual (`GET /api/v1/linkedin/company/{id}`) retorna a localização completa (ex: "São Paulo e Região"), como mostrado na imagem de referência do LinkedIn.

### Solução
Após receber os resultados de busca de empresas, fazer chamadas paralelas ao endpoint de perfil de cada empresa para buscar a localização real.

### Detalhes técnicos

**Arquivo: `supabase/functions/unipile-search/index.ts`**

1. Criar uma função `enrichCompanyLocations` que:
   - Recebe a lista de itens da busca, o `baseUrl`, `apiKey` e `accountId`
   - Para cada empresa que tenha `id` e `location` nulo/vazio, faz uma chamada `GET` a `{baseUrl}/api/v1/linkedin/company/{id}?account_id={accountId}`
   - Executa todas as chamadas em paralelo com `Promise.allSettled` para não bloquear se uma falhar
   - Extrai o campo de localização da resposta do perfil (provavelmente `headquarters`, `location`, ou `hq_location`)
   - Retorna os itens com a localização preenchida

2. Chamar essa função apenas quando `searchType === "accounts"` (não para leads)

3. Adicionar logs de diagnóstico para verificar o formato da resposta do endpoint de perfil

4. Remover os logs de diagnóstico antigos (DIAG) que não são mais necessários

**Fluxo da requisição:**

```text
Busca -> /api/v1/linkedin/search (retorna empresas com location: null)
   |
   v
Enriquecimento -> GET /api/v1/linkedin/company/{id} (para cada empresa, em paralelo)
   |
   v
Resposta final -> items com location preenchida (ex: "São Paulo e Região")
```

**Considerações de performance:**
- As chamadas de perfil são feitas em paralelo (`Promise.allSettled`), minimizando a latência total
- Se uma chamada individual falhar, o item mantém location vazio sem afetar os outros
- Para 25 resultados (default), a latência adicional sera aproximadamente o tempo de 1 chamada (ja que sao paralelas)
- Timeout de 5 segundos por chamada individual para evitar travamentos

**Nenhuma alteração de frontend necessaria** - o campo `location` ja e renderizado em `ResultsTable.tsx`. Basta retornar o valor correto do backend.

