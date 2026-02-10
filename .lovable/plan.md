

## Correção: Erro ao salvar em lista

### Causa raiz

A tabela `prospect_lists` tem uma constraint no banco de dados que aceita apenas estes valores para `list_type`:

- `accounts`
- `leads`
- `mixed`

Porém, o código frontend está enviando `lead` e `account` (no singular), o que viola a constraint e gera o erro.

### Correção

Ajustar o mapeamento em dois arquivos para usar os valores corretos (plural):

**1. `src/components/SaveToListModal.tsx`**

Alterar a derivação de `listType` de:
- `"lead"` para `"leads"`
- `"account"` para `"accounts"`

E ajustar o filtro de `compatibleLists` para comparar com os valores corretos.

**2. `src/pages/Lists.tsx`**

Ajustar as comparações de `list.list_type` nos badges e ícones para usar `"leads"` e `"accounts"` em vez de `"lead"` e `"account"`.

### Detalhes Técnicos

Arquivos modificados:
- `src/components/SaveToListModal.tsx` - corrigir mapeamento `listType` e filtro de listas compatíveis
- `src/pages/Lists.tsx` - corrigir comparações de tipo nos ícones e badges

Nenhuma alteração de banco de dados necessária.
