

# Plano: Migrar Busca/Perfil/Email para Apify, manter Telefone no Apollo

## Resumo da Mudanca

| Fluxo | Atual | Novo |
|---|---|---|
| **Busca** | Apollo `/mixed_people/api_search` | Apify LinkedIn scraper |
| **Revelar Perfil** | Apollo `/people/match` | Apify LinkedIn scraper |
| **Buscar Email** | Apollo `/people/match` + `reveal_personal_emails` | Apify LinkedIn scraper |
| **Buscar Telefone** | Apollo `/people/match` + `reveal_phone_number` + webhook | **Sem mudanca** (Apollo) |

---

## Questao Critica: Apify para Busca

A busca atual usa Apollo para pesquisar por **filtros** (cargo, senioridade, localizacao, tamanho empresa) e retorna ate 100 resultados paginados. Apify funciona de forma diferente: ele **scrapa perfis do LinkedIn** a partir de URLs ou buscas no LinkedIn.

Para migrar a busca para Apify, existem duas opcoes:

1. **Apify LinkedIn Search Scraper** (ex: actor `hMvNSpz3JnHgl5jkh` ou similar) -- aceita termos de busca e retorna resultados do LinkedIn Sales Navigator / LinkedIn Search
2. **Manter Apollo so para busca** e migrar apenas Perfil + Email para Apify

Vou assumir que voce quer migrar **tudo** (busca inclusive) para Apify. Se a busca nao funcionar bem com Apify, poderemos reverter so essa parte.

---

## Arquivos a Modificar

### 1. `supabase/functions/apollo-search/index.ts` -- Migrar para Apify
- Trocar chamada de `api.apollo.io/api/v1/mixed_people/api_search` por actor Apify de busca no LinkedIn
- Para **pessoas**: usar Apify LinkedIn People Search actor
- Para **empresas**: usar Apify LinkedIn Company Search actor
- Manter mesma interface de resposta (`{ items, pagination }`)
- Manter logica de creditos (1 por pagina)
- Trocar `APOLLO_API_KEY` por `APIFY_API_KEY`

### 2. `supabase/functions/enrich-profile-basic/index.ts` -- Migrar para Apify
- Substituir chamada Apollo `/people/match` por Apify LinkedIn Profile Scraper (actor `2SyF0bVxmgGr8IVCZ`)
- Input: LinkedIn URL do lead (ja disponivel no `raw_data` ou `linkedin_url`)
- Extrair: nome completo, titulo, empresa, localizacao, foto
- Se nao houver LinkedIn URL, usar `apolloId` para tentar construir URL ou pular
- **Sem custo de creditos** (mantém comportamento atual)

### 3. `supabase/functions/enrich-lead/index.ts` -- Email via Apify
- Secao `searchType === "email"` (linhas 131-230): trocar Apollo por Apify LinkedIn scraper
- Disparar actor Apify com LinkedIn URL do lead
- Polling sincrono (ate ~30s) pelo resultado do dataset
- Extrair email do resultado Apify (`profile.email`, `profile.emails[0]`)
- Se Apify nao encontrar, marcar como `not_found` (sem fallback Apollo)
- Secao `searchType === "phone"` (linhas 232-352): **JA ESTA NO APIFY** -- manter como esta

**Espera:** Na verdade, reli o codigo e o phone no `enrich-lead` ja usa Apify! Mas voce quer phone no Apollo. Entao preciso **reverter phone para Apollo** nesse arquivo tambem.

Correcao do plano:
- `searchType === "email"`: **Apollo -> Apify** (scraper LinkedIn)
- `searchType === "phone"`: **Apify -> Apollo** (voltar para `/people/match` + `reveal_phone_number` + webhook)

### 4. `supabase/functions/enrich-batch-emails/index.ts` -- Email em lote via Apify
- Substituir chamadas Apollo `/people/match` + `reveal_personal_emails` por Apify scraper
- Para cada lead: disparar run Apify com LinkedIn URL, poll resultado, extrair email
- Manter concorrencia de 5 e limite de 100 leads
- Logica de creditos igual (1 credito por email encontrado)

### 5. `supabase/functions/enrich-batch-phones/index.ts` -- Manter no Apollo
- **Sem mudanca significativa** -- ja usa Apollo `/people/match` + `reveal_phone_number` + webhook
- Continua funcionando como esta

### 6. `supabase/functions/enrich-batch-leads/index.ts` -- Email via Apify
- Secao de Apollo email: trocar por Apify scraper (mesmo padrao do batch-emails)
- Secao de Apify fallback: agora Apify e o **primario** para email, nao fallback
- Phone bonus do Apollo: remover (phone so vem pelo fluxo dedicado `enrich-batch-phones`)

### 7. `supabase/functions/webhooks-apify/index.ts` -- Ajustar para novo fluxo
- Quando `searchType === "phone"`: remover (phone agora e Apollo, nao Apify)
- Quando `searchType === "email"`: processar resultado Apify para email
- Remover fallback Apollo para email (Apify e o unico provedor)

### 8. `supabase/functions/webhooks-apollo/index.ts` -- Manter como esta
- Continua recebendo webhooks de phone do Apollo
- Sem mudanca

### 9. `src/hooks/useProspectLists.ts` -- Ajustar auto-enrich
- Linhas 186-206: `enrich-profile-basic` agora precisa de `linkedin_url` ao inves de `apolloId`
- Passar `linkedinUrl` junto com `itemId` no payload

---

## Detalhes Tecnicos

### Apify Actor para Scraping LinkedIn
- Actor ID: `2SyF0bVxmgGr8IVCZ` (LinkedIn Profile Scraper) -- ja usado no projeto
- Input: `{ startUrls: [{ url: linkedinUrl }], maxItems: 1 }`
- Output: perfil com `email`, `emails[]`, `phone`, `phones[]`, `firstName`, `lastName`, etc.

### Apify Actor para Busca LinkedIn
- Precisaremos identificar o actor correto para LinkedIn People Search
- Alternativa: manter Apollo **somente para busca** enquanto migra perfil/email para Apify
- A busca por filtros (cargo, senioridade, localizacao) e algo que Apollo faz nativamente mas Apify depende de um actor especifico

### Fluxo de Phone (Apollo -- sem mudanca)
```text
enrich-lead (phone) -> Apollo /people/match + reveal_phone_number + webhook_url
                                    |
                              webhooks-apollo -> atualiza prospect_list_items.phone
```

### Novo Fluxo de Email (Apify)
```text
enrich-lead (email) -> Apify actor run (LinkedIn URL)
                           |
                     Poll sincrono (~30s)
                           |
                     Dataset result -> extrair email -> atualiza DB
```

---

## Riscos e Consideracoes

1. **Busca via Apify**: nao tem a mesma experiencia que Apollo (filtros estruturados). Pode precisar de um actor especifico ou manter Apollo so para busca
2. **LinkedIn URL obrigatoria**: para Apify funcionar no perfil/email, precisa da URL do LinkedIn. O fluxo de profile-basic atualmente recebe `apolloId` e nao `linkedinUrl` -- precisa adaptar
3. **Tempo de resposta**: Apify scraper pode levar 15-45s por perfil vs Apollo que e instantaneo. O enriquecimento individual tera delay
4. **Rate limits Apify**: processar 100 leads em lote, cada um com um run Apify separado, pode ser lento. Alternativa: enviar multiplas URLs em um unico run

