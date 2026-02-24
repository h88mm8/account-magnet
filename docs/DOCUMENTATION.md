# Documentação Completa — ELEV Discover

---

## 1. Propósito Geral

**ELEV Discover** é um ecossistema SaaS de prospecção B2B projetado para equipes de SDRs (Sales Development Representatives) e BDRs (Business Development Representatives). O sistema unifica em uma única plataforma todo o ciclo de prospecção comercial: desde a busca de decisores e empresas, passando pela organização em listas segmentadas, até a execução de campanhas multicanal (Email, LinkedIn e WhatsApp) com rastreamento comportamental e automação baseada em eventos.

**O problema que resolve:** eliminar a fragmentação de ferramentas (LinkedIn Sales Navigator, ferramentas de email, CRMs, planilhas) ao consolidar busca, enriquecimento, outreach e monitoramento em um fluxo único e integrado.

---

## 2. Usuários / Perfis

O sistema possui um único perfil de usuário autenticado (SDR/BDR/Gestor Comercial). Todos os dados são isolados por `user_id` via Row-Level Security, garantindo que cada usuário vê apenas seus próprios dados. Não há perfis administrativos ou multi-tenant visível na aplicação atual.

---

## 3. Telas e Funcionalidades

### 3.1 Autenticação (`/auth`)
- Página de marketing + login/signup
- Apresenta os 4 pilares do produto (Busca, Organização, Campanhas, Monitoramento)
- Formulários de login e cadastro com email/senha via sistema de autenticação integrado

### 3.2 Busca (`/search`)
- **Duas abas**: Pessoas e Empresas
- **Filtros para Pessoas**: palavras-chave, cargos, localização, senioridade, tamanho da empresa
- **Filtros para Empresas**: nome, palavras-chave, localização, faixa de funcionários
- Integra com Apollo.io para busca de contatos e empresas
- Resultados exibidos em tabela com paginação por cursor
- Possibilidade de salvar resultados em listas de prospecção

### 3.3 Empresas (`/companies`)
- Busca dedicada de empresas (accounts)
- Filtros avançados com paginação
- Exportação CSV

### 3.4 Contatos (`/contacts`)
- Busca dedicada de leads/contatos
- Filtros avançados com paginação
- Exportação CSV

### 3.5 Listas (`/lists`)
- CRUD de listas de prospecção (tipo: "leads" ou "accounts")
- Gerenciamento de itens: busca, seleção, remoção, detalhes
- **Enriquecimento**: busca de email e telefone (individual ou em lote até 100 itens) via Edge Functions
- Exportação CSV
- Atualização em tempo real via Realtime quando enriquecimento assíncrono completa

### 3.6 Campanhas (`/campaigns`)
- **Campaign Builder Omnichannel** unificado para Email, LinkedIn e WhatsApp
- **Layout 2 colunas**: configurações (esquerda) + editor/preview (direita)
- **Configurações por campanha**:
  - Nome, lista vinculada, canal (email/linkedin/whatsapp)
  - Tipo LinkedIn (convite, mensagem, InMail)
  - Limite diário, delays min/max entre envios
  - Agendamento: dias permitidos, horário início/fim, fuso horário
  - Status: rascunho, ativa, pausada
- **Multi-step (campaign_steps)**: sequências de mensagens com delays e condições (ex: parar se respondeu)
- **Editor rico** com variáveis dinâmicas (`{{FIRST_NAME}}`, `{{COMPANY}}`, etc.) e fallback (`{{first_name | "Olá"}}`)
- **Preview** com dados reais de um lead da lista
- **Contador de caracteres** (essencial para LinkedIn)
- **CTA configurável** para email (botão com texto/cor personalizável)
- Métricas por campanha: enviados, entregues, abertos, respondidos, aceitos, cliques, falhas

### 3.7 Workflows (`/workflows`)
- **Editor visual drag-and-drop** baseado em React Flow
- **8 tipos de nós**: Start, Send Email, Send LinkedIn, Send WhatsApp, Wait, Condition (bifurcação true/false), Action (adicionar/remover de lista), End
- Configuração de variáveis dinâmicas por nó
- Agendamento por workflow (dias, horários, fuso)
- **Gatilho automático**: entrada de contato em lista dispara execução
- **Aba de detalhe do workflow** com 3 sub-abas:
  - Execuções: status individual por contato
  - Métricas: KPIs por canal (email/linkedin/whatsapp/site)
  - Log de eventos: histórico granular

### 3.8 Analytics (`/analytics`)
- **KPIs**: empresas salvas, contatos salvos, taxa de conversão, listas ativas, campanhas ativas, total enviados, total respondidos
- **Gráficos**:
  - Crescimento por período (linha: empresas vs contatos)
  - Empresas por setor (barras)
  - Eventos por dia (linha)
- **Aba Eventos**: log detalhado com filtros por período, campanha e tipo de evento (enviado, entregue, respondido, aceito, falha, bounce)

### 3.9 Configurações (`/settings`)
- **Perfil**: nome, avatar
- **Integrações**: WhatsApp, LinkedIn, Email (via Unipile)
- **Email**: assinatura, link de agendamento, blocklist de emails
- **Notificações**: in-app, email, WhatsApp
- **Assinatura**: resumo do plano
- **Tracking**: configuração de página de rastreamento (logo, cores, botão, URL de redirect) + script JS embarcável para rastreamento de site

### 3.10 Ajuda (`/help`)
- FAQ com perguntas frequentes
- Links para documentação, suporte e API docs

---

## 4. Estrutura de Dados (Principais Entidades)

```
+---------------------+       +----------------------+       +------------------+
|   prospect_lists    |1─────N|  prospect_list_items  |       |    campaigns     |
|---------------------|       |----------------------|       |------------------|
| id, name, list_type |       | id, list_id, name    |       | id, name, channel|
| user_id, description|       | email, phone, company|       | list_id, status  |
+---------------------+       | linkedin_url, title  |       | daily_limit      |
                               | enrichment_status    |       | schedule_*       |
                               | item_type (lead/acct)|       | message_template |
                               +----------------------+       +--------+---------+
                                                                       |1
                                                                       │
                                                              +--------N---------+
                                                              |  campaign_steps  |
                                                              |------------------|
                                                              | step_order, type |
                                                              | message_template |
                                                              | delay_days/hours |
                                                              | condition_type   |
                                                              +------------------+

+---------------------+       +----------------------+       +------------------+
|   campaign_leads    |       |       events         |       |    workflows     |
|---------------------|       |----------------------|       |------------------|
| campaign_id, lead_id|       | id, user_id          |       | id, name, status |
| status, sent_at     |       | contact_id           |       | trigger_list_id  |
| delivered_at        |       | campaign_id          |       | schedule_*       |
| replied_at          |       | workflow_id          |       +--------+---------+
+---------------------+       | channel, event_type  |                |1
                               | metadata, created_at |       +--------N---------+
                               +----------------------+       |  workflow_nodes  |
                                                              |------------------|
+---------------------+       +----------------------+       | type, config     |
|  user_integrations  |       |  workflow_executions  |       | next/true/false  |
|---------------------|       |----------------------|       | _node_id         |
| provider (linkedin/ |       | workflow_id           |       +------------------+
|   email/whatsapp)   |       | contact_id, status   |
| unipile_account_id  |       | current_node_id      |
| status              |       | next_run_at          |
+---------------------+       +----------------------+
```

### Outras tabelas

`profiles`, `user_credits`, `credit_transactions`, `email_settings`, `email_blocklist`, `messages_sent`, `messages_received`, `link_tracking`, `link_clicks`, `email_clicks`, `notifications`, `tracking_page_settings`, `instances`

### Tabelas-chave

| Tabela | Propósito |
|---|---|
| `prospect_lists` | Listas de prospecção (leads ou accounts) |
| `prospect_list_items` | Contatos/empresas salvos com dados enriquecidos |
| `campaigns` | Campanhas multicanal com config de scheduling/limites |
| `campaign_steps` | Steps de sequência multi-etapa (LinkedIn multi-step) |
| `campaign_leads` | Status individual de cada lead em cada campanha |
| `events` | Tabela unificada de rastreamento (todos os canais + site) |
| `workflows` | Automações com gatilhos e agendamento |
| `workflow_nodes` | Nós do fluxo visual (start, email, wait, condition, etc.) |
| `workflow_executions` | Estado de execução por contato em cada workflow |
| `user_integrations` | Conexões com provedores (LinkedIn, Email) via Unipile |
| `whatsapp_connections` | Conexão WhatsApp dedicada |
| `user_credits` | Saldo de créditos do usuário |
| `email_settings` | Assinatura de email e link de agendamento |
| `email_blocklist` | Emails bloqueados (bounce/spam) |
| `link_tracking` / `link_clicks` | Rastreamento de cliques em links |

---

## 5. Fluxo Principal de Uso

```
1. BUSCAR                    2. ORGANIZAR
   ┌──────────────┐            ┌──────────────┐
   │ /search      │───salvar──>│ /lists       │
   │ Filtrar por  │            │ Criar listas │
   │ cargo, setor,│            │ Enriquecer   │
   │ localização  │            │ email/phone  │
   └──────────────┘            └──────┬───────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    v                                   v
            3a. CAMPANHAS                      3b. WORKFLOWS
   ┌──────────────────────┐            ┌──────────────────────┐
   │ /campaigns           │            │ /workflows           │
   │ Criar campanha       │            │ Criar automação      │
   │ Email/LinkedIn/WA    │            │ Cadência multi-canal │
   │ Multi-step sequences │            │ Condições baseadas   │
   │ Agendamento          │            │ em comportamento     │
   └──────────┬───────────┘            └──────────┬───────────┘
              │                                   │
              └───────────────┬───────────────────┘
                              v
                    4. MONITORAR
              ┌──────────────────────┐
              │ /analytics           │
              │ KPIs em tempo real   │
              │ Eventos por canal    │
              │ Gráficos de evolução │
              └──────────────────────┘
```

### Fluxo detalhado

1. **Buscar**: O usuário acessa `/search` e utiliza filtros (cargo, senioridade, setor, localização, tamanho da empresa) para encontrar decisores e empresas via integração Apollo.io.

2. **Organizar**: Os resultados são salvos em listas tipadas (leads ou accounts) em `/lists`. O usuário pode enriquecer os contatos buscando email e telefone verificados, consumindo créditos do sistema.

3. **Executar**: O usuário vincula uma lista a uma campanha (`/campaigns`) ou workflow (`/workflows`):
   - **Campanhas**: disparo direto multicanal com scheduling, limites diários e multi-step (convite → mensagem → follow-up para LinkedIn).
   - **Workflows**: automações visuais com lógica condicional (ex: "se respondeu, parar; se não, enviar follow-up em 3 dias").

4. **Monitorar**: Em `/analytics`, o usuário acompanha KPIs agregados, eventos por canal/campanha, e identifica leads com maior engajamento. As métricas são derivadas da tabela unificada `events`, alimentada por webhooks dos provedores (Unipile) e pelo script de rastreamento de site.

---

## 6. Integração Técnica

| Integração | Função | Mecanismo |
|---|---|---|
| **Apollo.io** | Busca de contatos e empresas | Edge Function `apollo-search` |
| **Unipile** | Envio de Email, LinkedIn (convites + mensagens) e WhatsApp; webhooks para delivery/reply/bounce | Edge Functions `unipile-*`, `process-campaign-queue`, `process-workflow-batch` |
| **Rastreamento de site** | Captura `page_visit`, `scroll_depth`, `cta_click` | Script JS embarcável → Edge Function `track-event` |
| **Motor de processamento** | Execução de campanhas e workflows agendados | Edge Functions via `pg_cron` (a cada minuto) |
| **Créditos** | Cobrança por operações de enriquecimento e busca | RPCs `add_credits` / `deduct_credits` |

---

## 7. Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui (Radix) |
| Estado | TanStack React Query |
| Roteamento | React Router v6 |
| Editor visual | React Flow (@xyflow/react) |
| Editor de texto | TipTap |
| Gráficos | Recharts |
| Backend | Lovable Cloud |
| Funções serverless | Edge Functions (Deno) |
| Autenticação | Email/senha integrado |
| Tempo real | Realtime (postgres_changes) |
| Agendamento | pg_cron |

---

## 8. Edge Functions (Backend)

| Função | Propósito |
|---|---|
| `apollo-search` | Proxy de busca Apollo.io com dedução de créditos |
| `enrich-lead` | Enriquecimento individual (email/phone) |
| `enrich-batch-emails` | Enriquecimento em lote de emails (até 100) |
| `enrich-batch-phones` | Enriquecimento em lote de telefones |
| `enrich-batch-leads` | Enriquecimento completo em lote (Apollo + Apify fallback) |
| `enrich-profile-basic` | Enriquecimento básico de perfil |
| `process-campaign-queue` | Motor de envio de campanhas |
| `process-workflow-batch` | Motor de execução de workflows |
| `unipile-search` | Busca de contatos via Unipile |
| `unipile-messages` | Envio de mensagens WhatsApp via Unipile |
| `unipile-lookup` | Lookup de perfis via Unipile |
| `unipile-webhook` | Recebe webhooks do Unipile |
| `connect-account` | Conexão de contas (LinkedIn/Email) |
| `whatsapp-connect` | Conexão de conta WhatsApp |
| `track-event` | Recebe eventos de rastreamento de site |
| `track-click` | Rastreia cliques em links |
| `redirect-link` | Redireciona links rastreados |
| `send-click-notification` | Notifica sobre cliques |
| `webhooks-apollo` | Webhooks Apollo.io |
| `webhooks-apify` | Webhooks Apify |
| `webhooks-integration` | Webhooks de integrações (Unipile) |
| `webhooks-linkedin` | Webhooks LinkedIn |
| `webhooks-whatsapp` | Webhooks WhatsApp |

---

## 9. Segurança

- **Row-Level Security (RLS)**: Todas as tabelas principais possuem políticas que restringem acesso ao `user_id` autenticado via `auth.uid()`.
- **Autenticação**: Email/senha com confirmação de email obrigatória.
- **Isolamento de dados**: Cada usuário acessa exclusivamente seus próprios dados em todas as operações.
- **Edge Functions**: Utilizam `SUPABASE_SERVICE_ROLE_KEY` internamente; chaves de API externas (Apollo, Unipile, Apify) são armazenadas como secrets no backend.
- **Blocklist de emails**: Emails que retornam bounce ou spam são automaticamente bloqueados para evitar danos à reputação do remetente.

---

*Documento gerado em 24/02/2026 — ELEV Discover v1.0*
