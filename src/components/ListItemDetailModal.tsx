import { useState } from "react";
import { Mail, Phone, MapPin, Briefcase, Building2, Users, Factory, ExternalLink, MousePointerClick, Send, CheckCircle, Reply, XCircle, Eye, Clock, Pencil } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProspectListItem } from "@/hooks/useProspectLists";
import { useLeadEmailHistory } from "@/hooks/useLeadEmailHistory";

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Send; color: string }> = {
  pending: { label: "Pendente", icon: Clock, color: "text-muted-foreground" },
  sent: { label: "Enviado", icon: Send, color: "text-blue-500" },
  delivered: { label: "Entregue", icon: CheckCircle, color: "text-green-500" },
  replied: { label: "Respondido", icon: Reply, color: "text-emerald-500" },
  accepted: { label: "Aceito", icon: CheckCircle, color: "text-teal-500" },
  failed: { label: "Falha", icon: XCircle, color: "text-red-500" },
  invalid: { label: "Inválido", icon: XCircle, color: "text-orange-500" },
};

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
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

  if (!item) return null;

  const isLead = item.item_type === "lead";
  const initials = item.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
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

          {/* Professional / Company info */}
          <div className="p-6 space-y-5">
            {isLead ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Informações profissionais
                </h3>
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
            ) : (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Informações da empresa
                </h3>
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
            )}

            {(item.email || item.phone) && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Contato
                  </h3>
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
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Links
                  </h3>
                  <a href={item.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver perfil no LinkedIn
                  </a>
                </div>
              </>
            )}

            {/* Email History */}
            {isLead && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Histórico de campanhas
                  </h3>
                  {historyLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : emailHistory && emailHistory.length > 0 ? (
                    <div className="space-y-3">
                      {emailHistory.map((ev) => {
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
                              {ev.sent_at && (
                                <span>Enviado: {new Date(ev.sent_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>
                              )}
                              {ev.delivered_at && <span>Entregue: {new Date(ev.delivered_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>}
                              {ev.replied_at && <span>Respondido: {new Date(ev.replied_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>}
                              {ev.click_count > 0 && (
                                <span className="flex items-center gap-0.5">
                                  <MousePointerClick className="h-3 w-3" /> {ev.click_count}x
                                </span>
                              )}
                            </div>
                            {ev.message_content && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-primary p-0"
                                onClick={() => setPreviewHtml(ev.message_content)}
                              >
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
              </>
            )}
          </div>
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
