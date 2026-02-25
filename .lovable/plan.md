

# Plano: Limpar referencias Apollo no frontend + Migrar busca para Apify

## Contexto atual

O backend ja esta correto:
- **Email**: Apify (enrich-lead, enrich-batch-emails, enrich-batch-leads)
- **Profile**: Apify (enrich-profile-basic)
- **Phone**: Apollo (enrich-lead, enrich-batch-phones, webhooks-apollo)

Falta:
1. Migrar a **busca** (`apollo-search`) para Apify LinkedIn Search Scraper
2. Remover **todas as referencias visuais ao Apollo** no frontend
3. Adicionar secrets `LINKEDIN_COOKIES` e `LINKEDIN_USER_AGENT`

---

## Arquivos a modificar

### 1. Secrets necessarios

Antes de implementar, preciso solicitar dois novos secrets:
- **LINKEDIN_COOKIES**: cookies de sessao do LinkedIn (necessario para o actor de busca Apify)
- **LINKEDIN_USER_AGENT**: user-agent do navegador onde os cookies foram extraidos

### 2. `supabase/functions/apollo-search/index.ts` -- Migrar para Apify

Substituir toda a logica Apollo por chamadas ao Apify LinkedIn Search Scraper (actor `hMvNSpz3JnHgl5jkh` ou similar como `curious_coder/linkedin-people-search-scraper`).

Mudancas:
- Trocar `APOLLO_API_KEY` por `APIFY_API_KEY` + `LINKEDIN_COOKIES`
- Para **pessoas**: construir URL de busca LinkedIn a partir dos filtros (keywords, titles, location, seniority) e disparar actor Apify
- Para **empresas**: construir URL de busca LinkedIn Companies
- Polling sincrono ate resultado disponivel (~30-60s)
- Normalizar resultados Apify para o mesmo formato `{ items, pagination }`
- Manter logica de creditos (1 por pagina) e refund em erro

### 3. `src/lib/api/apollo.ts` -- Renomear para `src/lib/api/search.ts`

- Renomear tipos: `ApolloPersonFilters` -> `PersonFilters`, `ApolloCompanyFilters` -> `CompanyFilters`, etc.
- Renomear funcoes: `searchApolloPersons` -> `searchPersons`, `searchApolloCompanies` -> `searchCompanies`
- Renomear catalogs: `apolloSeniorities` -> `seniorities`, `apolloEmployeeRanges` -> `employeeRanges`
- Remover erro "Erro ao buscar pessoas no Apollo" -> "Erro ao buscar contatos"
- O edge function chamado continua sendo `apollo-search` (nome interno, invisivel ao usuario)

### 4. `src/pages/ApolloSearch.tsx` -- Renomear para `src/pages/DiscoverContacts.tsx`

- Renomear componente `ApolloSearch` -> `DiscoverContacts`
- Atualizar imports de `apollo.ts` para `search.ts` com nomes novos
- Titulo ja esta "Discover Contatos" (ja atualizado)
- Remover qualquer texto "Apollo" restante

### 5. `src/App.tsx`

- Import `DiscoverContacts` ao inves de `ApolloSearch`
- Route `/search` -> `<DiscoverContacts />`

### 6. `src/lib/api/unipile.ts`

- Renomear campo `apolloId` para `providerId` nos tipos `AccountResult` e `LeadResult`

### 7. `src/pages/Lists.tsx`

- Trocar `apolloId` por `providerId` nas referencias
- Comentario "Apollo webhook" -> "webhook de telefone"

### 8. `src/lib/normalize.ts`

- Remover comentarios que mencionam "Apollo" (ex: "Apollo normalized", "Apollo raw")

### 9. `src/pages/Documentation.tsx`

- Remover mencao a `apollo-search` na tabela de edge functions
- Substituir por descricao generica "busca de contatos"

### 10. Outros arquivos com `apolloId`

- `src/components/ResultsTable.tsx`: se referencia `apolloId`, trocar por `providerId`
- `src/components/LeadResultsTable.tsx`: idem
- `src/components/LeadDrawer.tsx`, `src/components/AccountDrawer.tsx`: verificar e limpar

---

## O que NAO muda

- `supabase/functions/enrich-lead/index.ts` -- ja correto (Apify email, Apollo phone)
- `supabase/functions/enrich-batch-emails/index.ts` -- ja correto (Apify)
- `supabase/functions/enrich-batch-phones/index.ts` -- ja correto (Apollo)
- `supabase/functions/webhooks-apollo/index.ts` -- continua recebendo phone webhooks
- `supabase/functions/webhooks-apify/index.ts` -- continua processando email
- `supabase/functions/enrich-profile-basic/index.ts` -- ja correto (Apify)

---

## Ordem de execucao

1. Solicitar secrets `LINKEDIN_COOKIES` e `LINKEDIN_USER_AGENT`
2. Aguardar usuario inserir os valores
3. Atualizar `apollo-search` edge function para Apify
4. Renomear `apollo.ts` -> `search.ts` e limpar tipos
5. Renomear `ApolloSearch.tsx` -> `DiscoverContacts.tsx`
6. Atualizar imports em `App.tsx`
7. Limpar `apolloId` -> `providerId` em types e componentes
8. Limpar comentarios e documentacao

---

## Riscos

- **LinkedIn cookies expiram**: usuario precisara atualizar periodicamente
- **Tempo de resposta da busca**: Apify scraper pode levar 30-60s vs Apollo que era instantaneo. A UX de busca tera um loading mais longo
- **Resultados da busca**: formato diferente do Apollo, pode ter menos campos (sem email/phone na busca, so no enriquecimento)

