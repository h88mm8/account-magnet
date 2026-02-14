

# Corrigir Campanhas LinkedIn: Resolucao de provider_id via Unipile

## Problema Atual

As campanhas de LinkedIn falham com erro 400 porque o sistema envia um username parcial (ex: `john-doe`) ou um ID do Sales Navigator (ex: `ACwAAASNCJcBS2NERCgi0j...`) diretamente para a API do Unipile. A API exige um `provider_id` valido, que so pode ser obtido resolvendo o perfil do lead previamente.

## Solucao

Adicionar uma etapa de resolucao de perfil antes de qualquer envio LinkedIn. O `provider_id` obtido sera salvo no lead para reutilizacao futura.

## Fluxo Corrigido

```text
Lead com linkedin_url
       |
       v
  Ja tem provider_id salvo?
       |
  SIM -+-> Usar direto para invite/message/inmail
       |
  NAO -+-> Chamar Unipile GET /api/v1/users/{linkedin_identifier}
              ?account_id=ACCOUNT_ID
              |
              +-- Sucesso: salvar provider_id no lead, prosseguir envio
              +-- Falha: marcar lead como "invalid" (nao como falha de envio)
```

## Detalhes Tecnicos

### 1. Migracao de banco de dados

Adicionar coluna `provider_id` na tabela `prospect_list_items`:

```sql
ALTER TABLE public.prospect_list_items
  ADD COLUMN IF NOT EXISTS provider_id text;
```

Isso permite salvar o provider_id resolvido para reutilizacao em campanhas futuras, sem chamar a API novamente.

### 2. Modificacoes na Edge Function `process-campaign-queue/index.ts`

**Nova funcao `resolveLinkedInProviderId`:**

- Recebe: `linkedin_url`, `UNIPILE_BASE_URL`, `UNIPILE_API_KEY`, `UNIPILE_ACCOUNT_ID`
- Extrai o identificador da URL (username de `/in/xxx` ou ID de `/sales/lead/xxx`)
- Chama `GET {UNIPILE_BASE_URL}/api/v1/users/{identifier}?account_id={ACCOUNT_ID}`
- Retorna o `provider_id` da resposta ou `null` em caso de falha
- Timeout de 10 segundos

**Modificacao no bloco LinkedIn (linhas 218-303):**

- Antes de enviar qualquer acao (invite, inmail, message), verificar se o lead ja tem `provider_id` salvo
- Se nao tem: chamar `resolveLinkedInProviderId`
- Se resolucao falhar: marcar lead com status `"invalid"` e erro `"Perfil LinkedIn nao encontrado na resolucao"` (diferente de erro de envio)
- Se resolucao suceder: salvar `provider_id` no `prospect_list_items` e usar para o envio
- Usar o `provider_id` em todos os 3 tipos de campanha (connection_request, inmail, message)

**Logging diferenciado:**

- `console.log("[RESOLVE]")` para etapa de resolucao
- `console.log("[SEND]")` para etapa de envio
- `console.error("[RESOLVE_FAIL]")` e `console.error("[SEND_FAIL]")` para erros

### 3. Ajuste na query de leads

Alterar a query que busca dados do lead (linha 130-133) para incluir `provider_id`:

```typescript
.select("name, email, phone, linkedin_url, provider_id")
```

### 4. Nova funcao `markInvalid`

Similar a `markFailed`, mas com status `"invalid"` para diferenciar leads cujo perfil nao pode ser resolvido de leads cujo envio falhou por erro da API.

### 5. Nenhuma mudanca necessaria em

- Frontend (Campaigns.tsx) -- ja exibe status e error_message
- Webhooks (webhooks-linkedin) -- ja processa respostas corretamente
- Outras Edge Functions

## Resumo das Mudancas

| Arquivo | Acao |
|---|---|
| Migracao SQL | Adicionar coluna `provider_id` em `prospect_list_items` |
| `process-campaign-queue/index.ts` | Adicionar resolucao de perfil, salvar provider_id, diferenciar erros |

