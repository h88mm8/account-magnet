

# Documentacao Completa - ELEV Discover

---

## 1. Proposito Geral

**ELEV Discover** e um ecossistema SaaS de prospecao B2B projetado para equipes de SDRs (Sales Development Representatives) e BDRs (Business Development Representatives). O sistema unifica em uma unica plataforma todo o ciclo de prospecao comercial: desde a busca de decisores e empresas, passando pela organizacao em listas segmentadas, ate a execucao de campanhas multicanal (Email, LinkedIn e WhatsApp) com rastreamento comportamental e automacao baseada em eventos.

O problema que resolve: eliminar a fragmentacao de ferramentas (LinkedIn Sales Navigator, ferramentas de email, CRMs, planilhas) ao consolidar busca, enriquecimento, outreach e monitoramento em um fluxo unico e integrado.

---

## 2. Usuarios / Perfis

O sistema possui um unico perfil de usuario autenticado (SDR/BDR/Gestor Comercial). Todos os dados sao isolados por `user_id` via Row-Level Security, garantindo que cada usuario ve apenas seus proprios dados. Nao ha perfis administrativos ou multi-tenant visivel na aplicacao atual.

---

## 3. Telas e Funcionalidades

### 3.1 Autenticacao (`/auth`)
- Pagina de marketing + login/signup
- Apresenta os 4 pilares do produto (Busca, Organizacao, Campanhas, Monitoramento)
- Formularios de login e cadastro com email/senha via sistema de autenticacao integrado

### 3.2 Busca (`/search`)
- **Duas abas**: Pessoas e Empresas
- **Filtros para Pessoas**: palavras-chave, cargos, localizacao, senioridade, tamanho da empresa
- **Filtros para Empresas**: nome, palavras-chave, localizacao, faixa de funcionarios
- Integra com Apollo.io para busca de contatos e empresas
- Resultados exibidos em tabela com paginacao por cursor
- Possibilidade de salvar resultados em listas de prospecao

### 3.3 Empresas (`/companies`)
- Busca dedicada de empresas (accounts)
- Filtros avancados com paginacao
- Exportacao CSV

### 3.4 Contatos (`/contacts`)
- Busca dedicada de leads/contatos
- Filtros avancados com paginacao
- Exportacao CSV

### 3.5 Listas (`/lists`)
- CRUD de listas de prospecao (tipo: "leads" ou "accounts")
- Gerenciamento de itens: busca, selecao, remocao, detalhes
- **Enriquecimento**: busca de email e telefone (individual ou em lote ate 100 itens) via Edge Functions
- Exportacao CSV
- Atualizacao em tempo real via Realtime quando enriquecimento assincrono completa

### 3.6 Campanhas (`/campaigns`)
- **Campaign Builder Omnichannel** unificado para Email, LinkedIn e WhatsApp
- **Layout 2 colunas**: configuracoes (esquerda) + editor/preview (direita)
- **Configuracoes por campanha**:
  - Nome, lista vinculada, canal (email/linkedin/whatsapp)
  - Tipo LinkedIn (convite, mensagem, InMail)
  - Limite diario, delays min/max entre envios
  - Agendamento: dias permitidos, horario inicio/fim, fuso horario
  - Status: rascunho, ativa, pausada
- **Multi-step (campaign_steps)**: sequencias de mensagens com delays e condicoes (ex: parar se respondeu)
- **Editor rico** com variaveis dinamicas (`{{FIRST_NAME}}`, `{{COMPANY}}`, etc.) e fallback (`{{first_name | "Ola"}}`)
- **Preview** com dados reais de um lead da lista
- **Contador de caracteres** (essencial para LinkedIn)
- **CTA configuravel** para email (botao com texto/cor personalizavel)
- Metricas por campanha: enviados, entregues, abertos, respondidos, aceitos, cliques, falhas

### 3.7 Workflows (`/workflows`)
- **Editor visual drag-and-drop** baseado em React Flow
- **8 tipos de nos**: Start, Send Email, Send LinkedIn, Send WhatsApp, Wait, Condition (bifurcacao true/false), Action (adicionar/remover de lista), End
- Configuracao de variaveis dinamicas por no
- Agendamento por workflow (dias, horarios, fuso)
- **Gatilho automatico**: entrada de contato em lista dispara execucao
- **Aba de detalhe do workflow** com 3 sub-abas:
  - Execucoes: status individual por contato
  - Metricas: KPIs por canal (email/linkedin/whatsapp/site)
  - Log de eventos: historico granular

### 3.8 Analytics (`/analytics`)
- **KPIs**: empresas salvas, contatos salvos, taxa de conversao, listas ativas, campanhas ativas, total enviados, total respondidos
- **Graficos**:
  - Crescimento por periodo (linha: empresas vs contatos)
  - Empresas por setor (barras)
  - Eventos por dia (linha)
- **Aba Eventos**: log detalhado com filtros por periodo, campanha e tipo de evento (enviado, entregue, respondido, aceito, falha, bounce)

### 3.9 Configuracoes (`/settings`)
- **Perfil**: nome, avatar
- **Integracoes**: WhatsApp, LinkedIn, Email (via Unipile)
- **Email**: assinatura, link de agendamento, blocklist de emails
- **Notificacoes**: in-app, email, WhatsApp
- **Assinatura**: resumo do plano
- **Tracking**: configuracao de pagina de rastreamento (logo, cores, botao, URL de redirect) + script JS embarcavel para rastreamento de site

### 3.10 Ajuda (`/help`)
- FAQ com perguntas frequentes
- Links para documentacao, suporte e API docs

---

## 4. Estrutura de Dados (Principais Entidades)

```text
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

Outras tabelas: profiles, user_credits, credit_transactions, email_settings,
email_blocklist, messages_sent/received, link_tracking, link_clicks,
email_clicks, notifications, tracking_page_settings, instances
```

### Tabelas-chave:

| Tabela | Proposito |
|---|---|
| `prospect_lists` | Listas de prospecao (leads ou accounts) |
| `prospect_list_items` | Contatos/empresas salvos com dados enriquecidos |
| `campaigns` | Campanhas multicanal com config de scheduling/limites |
| `campaign_steps` | Steps de sequencia multi-etapa (LinkedIn multi-step) |
| `campaign_leads` | Status individual de cada lead em cada campanha |
| `events` | Tabela unificada de rastreamento (todos os canais + site) |
| `workflows` | Automacoes com gatilhos e agendamento |
| `workflow_nodes` | Nos do fluxo visual (start, email, wait, condition, etc.) |
| `workflow_executions` | Estado de execucao por contato em cada workflow |
| `user_integrations` | Conexoes com provedores (LinkedIn, Email) via Unipile |
| `whatsapp_connections` | Conexao WhatsApp dedicada |
| `user_credits` | Saldo de creditos do usuario |
| `email_settings` | Assinatura de email e link de agendamento |
| `email_blocklist` | Emails bloqueados (bounce/spam) |
| `link_tracking` / `link_clicks` | Rastreamento de cliques em links |

---

## 5. Fluxo Principal de Uso

```text
1. BUSCAR                    2. ORGANIZAR
   ┌──────────────┐            ┌──────────────┐
   │ /search      │───salvar──>│ /lists       │
   │ Filtrar por  │            │ Criar listas │
   │ cargo, setor,│            │ Enriquecer   │
   │ localizacao  │            │ email/phone  │
   └──────────────┘            └──────┬───────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    v                                   v
            3a. CAMPANHAS                      3b. WORKFLOWS
   ┌──────────────────────┐            ┌──────────────────────┐
   │ /campaigns           │            │ /workflows           │
   │ Criar campanha       │            │ Criar automacao      │
   │ Email/LinkedIn/WA    │            │ Cadencia multi-canal │
   │ Multi-step sequences │            │ Condicoes baseadas   │
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
              │ Graficos de evolucao │
              └──────────────────────┘
```

**Fluxo detalhado:**

1. **Buscar**: O usuario acessa `/search` e utiliza filtros (cargo, senioridade, setor, localizacao, tamanho da empresa) para encontrar decisores e empresas via integracao Apollo.io.

2. **Organizar**: Os resultados sao salvos em listas tipadas (leads ou accounts) em `/lists`. O usuario pode enriquecer os contatos buscando email e telefone verificados, consumindo creditos do sistema.

3. **Executar**: O usuario vincula uma lista a uma campanha (`/campaigns`) ou workflow (`/workflows`):
   - **Campanhas**: disparo direto multicanal com scheduling, limites diarios e multi-step (convite → mensagem → follow-up para LinkedIn).
   - **Workflows**: automacoes visuais com logica condicional (ex: "se respondeu, parar; se nao, enviar follow-up em 3 dias").

4. **Monitorar**: Em `/analytics`, o usuario acompanha KPIs agregados, eventos por canal/campanha, e identifica leads com maior engajamento. As metricas sao derivadas da tabela unificada `events`, alimentada por webhooks dos provedores (Unipile) e pelo script de rastreamento de site.

---

## 6. Integracao Tecnica

- **Apollo.io**: busca de contatos e empresas (via Edge Function `apollo-search`)
- **Unipile**: envio de Email, LinkedIn (convites + mensagens) e WhatsApp; webhooks para delivery/reply/bounce
- **Rastreamento de site**: script JS embarcavel que captura `page_visit`, `scroll_depth`, `cta_click` (via Edge Function `track-event`)
- **Motor de processamento**: Edge Function `process-campaign-queue` (campanhas) e `process-workflow-batch` (workflows), executadas via `pg_cron` a cada minuto
- **Creditos**: sistema de saldo por usuario consumido nas operacoes de enriquecimento

---

## 7. Stack Tecnologica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui (Radix) |
| Estado | TanStack React Query |
| Roteamento | React Router v6 |
| Editor visual | React Flow (@xyflow/react) |
| Editor de texto | TipTap |
| Graficos | Recharts |
| Backend | Lovable Cloud (Supabase) |
| Funcoes serverless | Edge Functions (Deno) |
| Autenticacao | Sistema integrado (email/senha) |
| Tempo real | Realtime (postgres_changes) |
| Agendamento | pg_cron |

