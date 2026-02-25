import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Documentation() {
  const navigate = useNavigate();

  const handleExportPDF = () => {
    window.print();
  };

  useEffect(() => {
    document.title = "ELEV Discover — Documentação";
  }, []);

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .doc-container { max-width: 100% !important; padding: 0 !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-background">
        {/* Top bar - hidden in print */}
        <div className="no-print sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
            <Button onClick={handleExportPDF} size="sm">
              <FileDown className="mr-2 h-4 w-4" /> Exportar PDF
            </Button>
          </div>
        </div>

        {/* Document */}
        <article className="doc-container mx-auto max-w-4xl px-6 py-10 text-foreground prose prose-sm dark:prose-invert max-w-none
          [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-2 [&_h1]:mt-10
          [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-2
          [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2
          [&_p]:leading-7 [&_p]:mb-4
          [&_ul]:mb-4 [&_ul]:pl-6 [&_li]:mb-1
          [&_table]:w-full [&_table]:text-sm [&_table]:mb-6
          [&_th]:text-left [&_th]:border-b [&_th]:border-border [&_th]:pb-2 [&_th]:pr-4 [&_th]:font-semibold
          [&_td]:border-b [&_td]:border-border/50 [&_td]:py-2 [&_td]:pr-4
          [&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:text-xs [&_pre]:mb-6
          [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded
          [&_strong]:font-semibold
          [&_hr]:my-8 [&_hr]:border-border
        ">
          <h1>Documentação Completa — ELEV Discover</h1>
          <p className="text-muted-foreground text-base mt-1 mb-8">Plataforma SaaS de prospecção B2B omnichannel</p>

          <hr />

          <h2>1. Propósito Geral</h2>
          <p>
            <strong>ELEV Discover</strong> é um ecossistema SaaS de prospecção B2B projetado para equipes de SDRs
            (Sales Development Representatives) e BDRs (Business Development Representatives). O sistema unifica em
            uma única plataforma todo o ciclo de prospecção comercial: desde a busca de decisores e empresas, passando
            pela organização em listas segmentadas, até a execução de campanhas multicanal (Email, LinkedIn e WhatsApp)
            com rastreamento comportamental e automação baseada em eventos.
          </p>
          <p>
            <strong>O problema que resolve:</strong> eliminar a fragmentação de ferramentas (LinkedIn Sales Navigator,
            ferramentas de email, CRMs, planilhas) ao consolidar busca, enriquecimento, outreach e monitoramento em
            um fluxo único e integrado.
          </p>

          <hr />

          <h2>2. Usuários / Perfis</h2>
          <p>
            O sistema possui um único perfil de usuário autenticado (SDR/BDR/Gestor Comercial). Todos os dados são
            isolados por <code>user_id</code> via Row-Level Security, garantindo que cada usuário vê apenas seus
            próprios dados. Não há perfis administrativos ou multi-tenant visível na aplicação atual.
          </p>

          <hr />

          <h2>3. Telas e Funcionalidades</h2>

          <h3>3.1 Autenticação (<code>/auth</code>)</h3>
          <ul>
            <li>Página de marketing + login/signup</li>
            <li>Apresenta os 4 pilares do produto (Busca, Organização, Campanhas, Monitoramento)</li>
            <li>Formulários de login e cadastro com email/senha via sistema de autenticação integrado</li>
          </ul>

          <h3>3.2 Busca (<code>/search</code>)</h3>
          <ul>
            <li><strong>Duas abas:</strong> Pessoas e Empresas</li>
            <li><strong>Filtros para Pessoas:</strong> palavras-chave, cargos, localização, senioridade, tamanho da empresa</li>
            <li><strong>Filtros para Empresas:</strong> nome, palavras-chave, localização, faixa de funcionários</li>
            <li>Busca integrada de contatos e empresas</li>
            <li>Resultados exibidos em tabela com paginação por cursor</li>
            <li>Possibilidade de salvar resultados em listas de prospecção</li>
          </ul>

          <h3>3.3 Empresas (<code>/companies</code>)</h3>
          <ul>
            <li>Busca dedicada de empresas (accounts) com filtros avançados e paginação</li>
            <li>Exportação CSV</li>
          </ul>

          <h3>3.4 Contatos (<code>/contacts</code>)</h3>
          <ul>
            <li>Busca dedicada de leads/contatos com filtros avançados e paginação</li>
            <li>Exportação CSV</li>
          </ul>

          <h3>3.5 Listas (<code>/lists</code>)</h3>
          <ul>
            <li>CRUD de listas de prospecção (tipo: "leads" ou "accounts")</li>
            <li>Gerenciamento de itens: busca, seleção, remoção, detalhes</li>
            <li><strong>Enriquecimento:</strong> busca de email e telefone (individual ou em lote até 100 itens)</li>
            <li>Exportação CSV</li>
            <li>Atualização em tempo real via Realtime quando enriquecimento assíncrono completa</li>
          </ul>

          <h3>3.6 Campanhas (<code>/campaigns</code>)</h3>
          <ul>
            <li><strong>Campaign Builder Omnichannel</strong> unificado para Email, LinkedIn e WhatsApp</li>
            <li><strong>Layout 2 colunas:</strong> configurações (esquerda) + editor/preview (direita)</li>
            <li>Nome, lista vinculada, canal, tipo LinkedIn (convite, mensagem, InMail)</li>
            <li>Limite diário, delays min/max entre envios</li>
            <li>Agendamento: dias permitidos, horário início/fim, fuso horário</li>
            <li><strong>Multi-step:</strong> sequências de mensagens com delays e condições</li>
            <li><strong>Editor rico</strong> com variáveis dinâmicas e fallback (<code>{"{{first_name | \"Olá\"}}"}</code>)</li>
            <li>Preview com dados reais de um lead da lista</li>
            <li>Contador de caracteres (essencial para LinkedIn)</li>
            <li>CTA configurável para email (botão com texto/cor personalizável)</li>
            <li>Métricas: enviados, entregues, abertos, respondidos, aceitos, cliques, falhas</li>
          </ul>

          <h3>3.7 Workflows (<code>/workflows</code>)</h3>
          <ul>
            <li><strong>Editor visual drag-and-drop</strong> baseado em React Flow</li>
            <li><strong>8 tipos de nós:</strong> Start, Send Email, Send LinkedIn, Send WhatsApp, Wait, Condition, Action, End</li>
            <li>Configuração de variáveis dinâmicas por nó</li>
            <li>Agendamento por workflow (dias, horários, fuso)</li>
            <li>Gatilho automático: entrada de contato em lista dispara execução</li>
            <li>Aba de detalhe com execuções, métricas e log de eventos</li>
          </ul>

          <h3>3.8 Analytics (<code>/analytics</code>)</h3>
          <ul>
            <li><strong>KPIs:</strong> empresas salvas, contatos salvos, taxa de conversão, listas ativas, campanhas ativas, total enviados, total respondidos</li>
            <li>Gráficos: crescimento por período, empresas por setor, eventos por dia</li>
            <li>Aba Eventos: log detalhado com filtros por período, campanha e tipo de evento</li>
          </ul>

          <h3>3.9 Configurações (<code>/settings</code>)</h3>
          <ul>
            <li>Perfil: nome, avatar</li>
            <li>Integrações: WhatsApp, LinkedIn, Email (via Unipile)</li>
            <li>Email: assinatura, link de agendamento, blocklist</li>
            <li>Notificações: in-app, email, WhatsApp</li>
            <li>Tracking: página de rastreamento + script JS embarcável</li>
          </ul>

          <h3>3.10 Ajuda (<code>/help</code>)</h3>
          <ul>
            <li>FAQ com perguntas frequentes</li>
            <li>Links para documentação, suporte e API docs</li>
          </ul>

          <hr />

          <h2>4. Estrutura de Dados</h2>

          <pre>{`
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
          `}</pre>

          <h3>Tabelas-chave</h3>
          <table>
            <thead>
              <tr><th>Tabela</th><th>Propósito</th></tr>
            </thead>
            <tbody>
              <tr><td><code>prospect_lists</code></td><td>Listas de prospecção (leads ou accounts)</td></tr>
              <tr><td><code>prospect_list_items</code></td><td>Contatos/empresas salvos com dados enriquecidos</td></tr>
              <tr><td><code>campaigns</code></td><td>Campanhas multicanal com config de scheduling/limites</td></tr>
              <tr><td><code>campaign_steps</code></td><td>Steps de sequência multi-etapa (LinkedIn multi-step)</td></tr>
              <tr><td><code>campaign_leads</code></td><td>Status individual de cada lead em cada campanha</td></tr>
              <tr><td><code>events</code></td><td>Tabela unificada de rastreamento (todos os canais + site)</td></tr>
              <tr><td><code>workflows</code></td><td>Automações com gatilhos e agendamento</td></tr>
              <tr><td><code>workflow_nodes</code></td><td>Nós do fluxo visual (start, email, wait, condition, etc.)</td></tr>
              <tr><td><code>workflow_executions</code></td><td>Estado de execução por contato em cada workflow</td></tr>
              <tr><td><code>user_integrations</code></td><td>Conexões com provedores (LinkedIn, Email) via Unipile</td></tr>
              <tr><td><code>whatsapp_connections</code></td><td>Conexão WhatsApp dedicada</td></tr>
              <tr><td><code>user_credits</code></td><td>Saldo de créditos do usuário</td></tr>
              <tr><td><code>email_settings</code></td><td>Assinatura de email e link de agendamento</td></tr>
              <tr><td><code>email_blocklist</code></td><td>Emails bloqueados (bounce/spam)</td></tr>
              <tr><td><code>link_tracking</code> / <code>link_clicks</code></td><td>Rastreamento de cliques em links</td></tr>
            </tbody>
          </table>

          <hr />

          <h2>5. Fluxo Principal de Uso</h2>

          <pre>{`
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
          `}</pre>

          <h3>Fluxo detalhado</h3>
          <ol className="[&_li]:mb-3 pl-6">
            <li><strong>Buscar:</strong> O usuário acessa <code>/search</code> e utiliza filtros (cargo, senioridade, setor, localização, tamanho da empresa) para encontrar decisores e empresas.</li>
            <li><strong>Organizar:</strong> Os resultados são salvos em listas tipadas (leads ou accounts) em <code>/lists</code>. O usuário pode enriquecer os contatos buscando email e telefone verificados, consumindo créditos do sistema.</li>
            <li><strong>Executar:</strong> O usuário vincula uma lista a uma campanha (<code>/campaigns</code>) ou workflow (<code>/workflows</code>):
              <ul>
                <li><strong>Campanhas:</strong> disparo direto multicanal com scheduling, limites diários e multi-step.</li>
                <li><strong>Workflows:</strong> automações visuais com lógica condicional.</li>
              </ul>
            </li>
            <li><strong>Monitorar:</strong> Em <code>/analytics</code>, o usuário acompanha KPIs agregados, eventos por canal/campanha, e identifica leads com maior engajamento.</li>
          </ol>

          <hr />

          <h2>6. Integração Técnica</h2>
          <table>
            <thead>
              <tr><th>Integração</th><th>Função</th><th>Mecanismo</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Discover</strong></td><td>Busca de contatos e empresas</td><td>Edge Function <code>apollo-search</code></td></tr>
              <tr><td><strong>Unipile</strong></td><td>Envio Email, LinkedIn, WhatsApp + webhooks</td><td>Edge Functions <code>unipile-*</code></td></tr>
              <tr><td><strong>Rastreamento</strong></td><td>Captura page_visit, scroll, cta_click</td><td>Script JS → <code>track-event</code></td></tr>
              <tr><td><strong>Motor batch</strong></td><td>Execução agendada de campanhas e workflows</td><td><code>pg_cron</code> (1 min)</td></tr>
              <tr><td><strong>Créditos</strong></td><td>Cobrança por enriquecimento e busca</td><td>RPCs <code>add/deduct_credits</code></td></tr>
            </tbody>
          </table>

          <hr />

          <h2>7. Stack Tecnológica</h2>
          <table>
            <thead>
              <tr><th>Camada</th><th>Tecnologia</th></tr>
            </thead>
            <tbody>
              <tr><td>Frontend</td><td>React 18 + TypeScript + Vite</td></tr>
              <tr><td>UI</td><td>Tailwind CSS + shadcn/ui (Radix)</td></tr>
              <tr><td>Estado</td><td>TanStack React Query</td></tr>
              <tr><td>Roteamento</td><td>React Router v6</td></tr>
              <tr><td>Editor visual</td><td>React Flow (@xyflow/react)</td></tr>
              <tr><td>Editor de texto</td><td>TipTap</td></tr>
              <tr><td>Gráficos</td><td>Recharts</td></tr>
              <tr><td>Backend</td><td>Lovable Cloud</td></tr>
              <tr><td>Funções serverless</td><td>Edge Functions (Deno)</td></tr>
              <tr><td>Autenticação</td><td>Email/senha integrado</td></tr>
              <tr><td>Tempo real</td><td>Realtime (postgres_changes)</td></tr>
              <tr><td>Agendamento</td><td>pg_cron</td></tr>
            </tbody>
          </table>

          <hr />

          <h2>8. Edge Functions (Backend)</h2>
          <table>
            <thead>
              <tr><th>Função</th><th>Propósito</th></tr>
            </thead>
            <tbody>
              <tr><td><code>apollo-search</code></td><td>Proxy de busca de contatos com dedução de créditos</td></tr>
              <tr><td><code>enrich-lead</code></td><td>Enriquecimento individual (email/phone)</td></tr>
              <tr><td><code>enrich-batch-emails</code></td><td>Enriquecimento em lote de emails (até 100)</td></tr>
              <tr><td><code>enrich-batch-phones</code></td><td>Enriquecimento em lote de telefones</td></tr>
              <tr><td><code>enrich-batch-leads</code></td><td>Enriquecimento completo de leads</td></tr>
              <tr><td><code>process-campaign-queue</code></td><td>Motor de envio de campanhas</td></tr>
              <tr><td><code>process-workflow-batch</code></td><td>Motor de execução de workflows</td></tr>
              <tr><td><code>unipile-search</code></td><td>Busca de contatos via Unipile</td></tr>
              <tr><td><code>unipile-messages</code></td><td>Envio de mensagens WhatsApp</td></tr>
              <tr><td><code>connect-account</code></td><td>Conexão de contas (LinkedIn/Email)</td></tr>
              <tr><td><code>whatsapp-connect</code></td><td>Conexão de conta WhatsApp</td></tr>
              <tr><td><code>track-event</code></td><td>Recebe eventos de rastreamento de site</td></tr>
              <tr><td><code>redirect-link</code></td><td>Redireciona links rastreados</td></tr>
              <tr><td><code>webhooks-integration</code></td><td>Webhooks de integrações (Unipile)</td></tr>
              <tr><td><code>webhooks-whatsapp</code></td><td>Webhooks WhatsApp</td></tr>
            </tbody>
          </table>

          <hr />

          <h2>9. Segurança</h2>
          <ul>
            <li><strong>Row-Level Security (RLS):</strong> Todas as tabelas principais possuem políticas que restringem acesso ao <code>user_id</code> autenticado via <code>auth.uid()</code>.</li>
            <li><strong>Autenticação:</strong> Email/senha com confirmação de email obrigatória.</li>
            <li><strong>Isolamento de dados:</strong> Cada usuário acessa exclusivamente seus próprios dados.</li>
            <li><strong>Edge Functions:</strong> Chaves de API externas armazenadas como secrets no backend.</li>
            <li><strong>Blocklist de emails:</strong> Emails com bounce/spam são automaticamente bloqueados.</li>
          </ul>

          <hr />

          <p className="text-muted-foreground text-sm text-center mt-10">
            Documento gerado em 24/02/2026 — ELEV Discover v1.0
          </p>
        </article>
      </div>
    </>
  );
}
