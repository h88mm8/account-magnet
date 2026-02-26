import { useState } from "react";
import { Mail, Phone, MapPin, Briefcase, Building2, Users, Factory, ExternalLink, MousePointerClick, Send, CheckCircle, Reply, XCircle, Eye, Clock, Pencil, Globe, ArrowDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { ProspectListItem } from "@/hooks/useProspectLists";
import { useLeadEmailHistory } from "@/hooks/useLeadEmailHistory";
import { useContactWebActivity } from "@/hooks/useWebTracking";

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Send; color: string }> = {
  pending: { label: "Pendente", icon: Clock, color: "text-muted-foreground" },
  sent: { label: "Enviado", icon: Send, color: "text-blue-500" },
  delivered: { label: "Entregue", icon: CheckCircle, color: "text-green-500" },
  replied: { label: "Respondido", icon: Reply, color: "text-emerald-500" },
  accepted: { label: "Aceito", icon: CheckCircle, color: "text-blue-500" },
  failed: { label: "Falha", icon: XCircle, color: "text-red-500" },
  invalid: { label: "Inválido", icon: XCircle, color: "text-orange-500" },
};

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
};

const WEB_EVENT_LABELS: Record<string, { label: string; icon: typeof Eye; color: string }> = {
  page_visit: { label: "Visita", icon: Eye, color: "text-blue-500" },
  scroll_depth: { label: "Scroll", icon: ArrowDown, color: "text-purple-500" },
  cta_click: { label: "CTA Click", icon: MousePointerClick, color: "text-orange-500" },
};

type Props = {
  item: ProspectListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
};

export function ListItemDetailModal({ item, open, onOpenChange, onEdit }: Props) {
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const { data: emailHistory, isLoading: historyLoading } = useLeadEmailHistory(item?.id ?? null);
  const { data: webActivity, isLoading: webLoading } = useContactWebActivity(item?.id ?? null);

  if (!item) return null;

  const isLead = item.item_type === "lead";
  const initials = item.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  // Group web activity by session
  const sessionGroups: Record<string, typeof webActivity> = {};
  if (webActivity) {
    for (const ev of webActivity) {
      const sid = (ev.metadata as any)?.session_id || "sem-sessão";
      if (!sessionGroups[sid]) sessionGroups[sid] = [];
      sessionGroups[sid]!.push(ev);
    }
  }

  // Build engagement chart data (events per day, last 14 days)
  const engagementChart: { date: string; eventos: number }[] = [];
  if (webActivity && webActivity.length > 0) {
    const days: Record<string, number> = {};
    for (const ev of webActivity) {
      const key = new Date(ev.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      days[key] = (days[key] || 0) + 1;
    }
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      engagementChart.push({ date: key, eventos: days[key] || 0 });
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{item.name}</SheetTitle>
          </SheetHeader>

          {/* Header */}
          <div className="p-6 pb-4">
            <div className="flex items-start gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-base">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground leading-tight truncate">{item.name}</h2>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {isLead ? "Lead" : "Empresa"}
                  </Badge>
                  {onEdit && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground" onClick={onEdit}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {isLead && item.title && (
                  <p className="text-sm text-muted-foreground truncate">{item.title}</p>
                )}
                {item.company && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.company}</span>
                  </div>
                )}
                {item.location && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.location}</span>
                  </div>
                )}
              </div>
            </div>

            {item.link_clicks_count > 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <MousePointerClick className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground">
                  {item.link_clicks_count} clique{item.link_clicks_count !== 1 ? "s" : ""} em links rastreados
                </span>
              </div>
            )}
          </div>

          <Separator />

          {/* Tabs for Lead details */}
          {isLead ? (
            <Tabs defaultValue="info" className="p-0">
              <div className="px-6 pt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="info" className="flex-1">Detalhes</TabsTrigger>
                  <TabsTrigger value="campaigns" className="flex-1">Campanhas</TabsTrigger>
                  <TabsTrigger value="web-activity" className="flex-1 gap-1">
                    <Globe className="h-3 w-3" />
                    Web
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="info" className="p-6 pt-4 space-y-5">
                <LeadInfoSection item={item} />
              </TabsContent>

              <TabsContent value="campaigns" className="p-6 pt-4 space-y-5">
                <CampaignHistorySection
                  emailHistory={emailHistory}
                  historyLoading={historyLoading}
                  onPreview={setPreviewHtml}
                />
              </TabsContent>

              <TabsContent value="web-activity" className="p-6 pt-4 space-y-5">
                <WebActivitySection
                  webActivity={webActivity || []}
                  webLoading={webLoading}
                  sessionGroups={sessionGroups}
                  engagementChart={engagementChart}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="p-6 space-y-5">
              <CompanyInfoSection item={item} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* HTML Preview Dialog */}
      <Dialog open={!!previewHtml} onOpenChange={(v) => { if (!v) setPreviewHtml(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Preview da mensagem</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div
              className="prose prose-sm max-w-none p-4 border border-border rounded-lg bg-background"
              dangerouslySetInnerHTML={{ __html: previewHtml || "" }}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Sub-components ──

function LeadInfoSection({ item }: { item: ProspectListItem }) {
  return (
    <>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Informações profissionais</h3>
        <div className="space-y-3">
          {item.title && (
            <div className="flex items-start gap-3">
              <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                {item.company && <p className="text-xs text-muted-foreground">{item.company}</p>}
              </div>
            </div>
          )}
          {item.location && (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-foreground">{item.location}</p>
            </div>
          )}
        </div>
      </div>
      {(item.email || item.phone) && (
        <>
          <Separator />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Contato</h3>
            <div className="space-y-3">
              {item.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <a href={`mailto:${item.email}`} className="text-sm font-medium text-foreground hover:text-primary">{item.email}</a>
                </div>
              )}
              {item.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <a href={`tel:${item.phone}`} className="text-sm font-medium text-foreground hover:text-primary">{item.phone}</a>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {item.linkedin_url && (
        <>
          <Separator />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Links</h3>
            <a href={item.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <ExternalLink className="h-3.5 w-3.5" />
              Ver perfil no LinkedIn
            </a>
          </div>
        </>
      )}
    </>
  );
}

function CompanyInfoSection({ item }: { item: ProspectListItem }) {
  return (
    <>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Informações da empresa</h3>
        <div className="space-y-3">
          {item.industry && (
            <div className="flex items-start gap-3">
              <Factory className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Setor</p>
                <p className="text-sm font-medium text-foreground">{item.industry}</p>
              </div>
            </div>
          )}
          {item.headcount && (
            <div className="flex items-start gap-3">
              <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Funcionários</p>
                <p className="text-sm font-medium text-foreground">{item.headcount}</p>
              </div>
            </div>
          )}
          {item.location && (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-foreground">{item.location}</p>
            </div>
          )}
        </div>
      </div>
      {(item.email || item.phone) && (
        <>
          <Separator />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Contato</h3>
            <div className="space-y-3">
              {item.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <a href={`mailto:${item.email}`} className="text-sm font-medium text-foreground hover:text-primary">{item.email}</a>
                </div>
              )}
              {item.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <a href={`tel:${item.phone}`} className="text-sm font-medium text-foreground hover:text-primary">{item.phone}</a>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {item.linkedin_url && (
        <>
          <Separator />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Links</h3>
            <a href={item.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <ExternalLink className="h-3.5 w-3.5" />
              Ver perfil no LinkedIn
            </a>
          </div>
        </>
      )}
    </>
  );
}

function CampaignHistorySection({ emailHistory, historyLoading, onPreview }: { emailHistory: any[] | undefined; historyLoading: boolean; onPreview: (html: string) => void }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Histórico de campanhas</h3>
      {historyLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : emailHistory && emailHistory.length > 0 ? (
        <div className="space-y-3">
          {emailHistory.map((ev: any) => {
            const cfg = STATUS_CONFIG[ev.status] || STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            return (
              <div key={ev.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {CHANNEL_LABELS[ev.campaign_channel] || ev.campaign_channel}
                    </Badge>
                    <span className="text-sm font-medium text-foreground truncate">{ev.campaign_name}</span>
                  </div>
                  <div className={`flex items-center gap-1 text-xs ${cfg.color}`}>
                    <Icon className="h-3 w-3" />
                    {cfg.label}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {ev.sent_at && <span>Enviado: {new Date(ev.sent_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>}
                  {ev.delivered_at && <span>Entregue: {new Date(ev.delivered_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>}
                  {ev.replied_at && <span>Respondido: {new Date(ev.replied_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>}
                  {ev.click_count > 0 && (
                    <span className="flex items-center gap-0.5">
                      <MousePointerClick className="h-3 w-3" /> {ev.click_count}x
                    </span>
                  )}
                </div>
                {ev.message_content && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-primary p-0" onClick={() => onPreview(ev.message_content)}>
                    <Eye className="h-3 w-3 mr-1" />
                    Ver mensagem
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma campanha enviada para este contato.</p>
      )}
    </div>
  );
}

function WebActivitySection({ webActivity, webLoading, sessionGroups, engagementChart }: {
  webActivity: any[];
  webLoading: boolean;
  sessionGroups: Record<string, any[]>;
  engagementChart: { date: string; eventos: number }[];
}) {
  if (webLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!webActivity || webActivity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Globe className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">Nenhuma atividade web registrada para este contato.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Engagement Chart */}
      {engagementChart.length > 0 && engagementChart.some(d => d.eventos > 0) && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Engajamento (14 dias)</h3>
          <div className="rounded-lg border border-border p-3">
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={engagementChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={20} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", color: "hsl(var(--foreground))", fontSize: 12 }} />
                <Line type="monotone" dataKey="eventos" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sessions */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Histórico por sessão ({Object.keys(sessionGroups).length} sessões)
        </h3>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {Object.entries(sessionGroups).map(([sessionId, events]) => (
            <div key={sessionId} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <code className="text-[10px] font-mono text-muted-foreground">{sessionId.slice(0, 20)}</code>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(events[events.length - 1].created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                  {" "}
                  {new Date(events[events.length - 1].created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="space-y-1.5">
                {events.map((ev: any) => {
                  const cfg = WEB_EVENT_LABELS[ev.event_type] || { label: ev.event_type, icon: Eye, color: "text-muted-foreground" };
                  const Icon = cfg.icon;
                  const meta = ev.metadata || {};
                  return (
                    <div key={ev.id} className="flex items-start gap-2 text-xs">
                      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cfg.color}`} />
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-foreground">{cfg.label}</span>
                        {ev.event_type === "page_visit" && meta.url && (
                          <span className="text-muted-foreground ml-1 truncate block" title={meta.url}>
                            {meta.url.replace(/^https?:\/\//, "").slice(0, 60)}
                            {meta.time_on_page ? ` · ${Math.round(meta.time_on_page / 1000)}s` : ""}
                          </span>
                        )}
                        {ev.event_type === "scroll_depth" && (
                          <span className="text-muted-foreground ml-1">{meta.scroll_percent}%</span>
                        )}
                        {ev.event_type === "cta_click" && (
                          <span className="text-muted-foreground ml-1 truncate block">
                            {meta.cta_id || meta.cta_text || "CTA"}
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground shrink-0">
                        {new Date(ev.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
