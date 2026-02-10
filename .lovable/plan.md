

## Plano: Corrigir Normalização de Dados da API Unipile

### Problema
Os dados de localização, empresa e funcionários existem na resposta da API Unipile, mas aparecem como "Não informado" porque a edge function `unipile-search` mapeia campos que podem não corresponder aos nomes reais retornados pela API.

### Estrategia

A correção sera feita em **duas camadas**:

1. **Edge Function (backend)** - Adicionar log do payload bruto da API + expandir os fallbacks de normalização
2. **Frontend** - Criar helpers de normalização como camada de segurança adicional

### Etapas

#### 1. Edge Function: Log + Normalização Expandida

Modificar `supabase/functions/unipile-search/index.ts`:

- Adicionar `console.log` do primeiro item bruto retornado pela API para diagnosticar os nomes reais dos campos
- Expandir os fallbacks de normalização para Accounts:
  - `name`: `item.name || item.title || item.company_name || ""`
  - `location`: `item.location || item.headquarters || item.geography || item.geo || ""`
  - `employeeCount`: `item.employeeCount || item.employee_count || item.size || item.staff_count || item.company_headcount || item.headcount || ""`
  - `industry`: `item.industry || item.sector || ""`
- Expandir os fallbacks para Leads:
  - `company`: `item.company || item.current_company || item.company_name || item.currentCompany?.name || ""`
  - `location`: `item.location || item.geo_location || item.geoLocation || item.geography || ""`
  - `title`: `item.title || item.headline || item.current_role || item.position || ""`

#### 2. Frontend: Helper de Normalização

Criar `src/lib/normalize.ts` com duas funcoes:

- `normalizeAccount(raw)` - recebe um `AccountResult` e garante que todos os campos tenham valor ou fallback
- `normalizeLead(raw)` - recebe um `LeadResult` e garante o mesmo

Estas funcoes serao usadas nos componentes antes do render.

#### 3. Aplicar nos Componentes

Todos os componentes que renderizam dados ja usam o fallback `|| FALLBACK` no JSX, entao a principal correcao e garantir que os dados cheguem corretamente da edge function.

Componentes que serao revisados para consistencia:
- `ResultsTable.tsx` (Accounts)
- `LeadResultsTable.tsx` (Leads)
- `LeadDrawer.tsx` (Drawer lateral)
- `LeadMiniCard.tsx` (Hover card)
- `Lists.tsx` (Listas salvas)

#### 4. Deploy e Validacao

- Deploy da edge function atualizada
- Executar uma busca real para capturar o log do payload bruto
- Verificar nos logs quais campos a API realmente retorna
- Ajustar mapeamentos se necessario com base nos logs

### Detalhes Tecnicos

```text
Fluxo de dados:
API Unipile --> Edge Function (normaliza) --> Frontend (renderiza com fallback)
                     ^                              ^
              Corrigir fallbacks            Helper de seguranca
              + log do payload bruto        src/lib/normalize.ts
```

Os arquivos modificados serao:
- `supabase/functions/unipile-search/index.ts` - normalização expandida + log
- `src/lib/normalize.ts` - novo helper
- `src/lib/api/unipile.ts` - aplicar normalização pos-fetch
- Componentes de tabela/drawer/card - manter consistencia de fallback

### Risco

O principal risco e nao saber exatamente quais campos a API Unipile retorna. O log adicionado na edge function permitira diagnosticar isso apos o primeiro teste. Se os nomes dos campos forem diferentes dos esperados, sera necessario um ajuste adicional baseado nos logs.
