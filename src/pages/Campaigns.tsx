import { useState, useEffect } from "react";
import { Plus, Play, Pause, Mail, MessageSquare, Linkedin, Send, Users, CheckCircle, XCircle, Eye, Reply, AlertTriangle, Trash2, MousePointerClick, ChevronRight } from "lucide-react";
import { EmailCampaignEditor } from "@/components/EmailCampaignEditor";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCampaigns, useCreateCampaign, useActivateCampaign, usePauseCampaign, useDeleteCampaign, useCampaignLeads, useAddLeadsToCampaign, checkWhatsAppConnection, checkIntegrationConnection, type Campaign } from "@/hooks/useCampaigns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useProspectLists } from "@/hooks/useProspectLists";
import { useAuth } from "@/contexts/AuthContext";
import { useWhatsAppConnection } from "@/hooks/useWhatsAppConnection";
import { useIntegration } from "@/hooks/useIntegrations";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const channelIcons: Record<string, any> = {
  whatsapp: MessageSquare,
  email: Mail,
  linkedin: Linkedin,
};

const channelLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  linkedin: "LinkedIn",
};

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  active: { label: "Ativa", variant: "default" },
  paused: { label: "Pausada", variant: "outline" },
  completed: { label: "Concluída", variant: "secondary" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

const linkedinTypeLabels: Record<string, string> = {
  connection_request: "Convite de Conexão",
  inmail: "InMail (não-conexão)",
  message: "Mensagem (conexão existente)",
};

const Campaigns = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { status: waStatus } = useWhatsAppConnection();
  const { status: linkedinStatus } = useIntegration("linkedin");
  const { status: emailStatus } = useIntegration("email");
  const { data: campaigns, isLoading } = useCampaigns();
  const { lists } = useProspectLists();
  const createCampaign = useCreateCampaign();
  const activateCampaign = useActivateCampaign();
  const pauseCampaign = usePauseCampaign();
  const deleteCampaign = useDeleteCampaign();
  const addLeads = useAddLeadsToCampaign();

  const [showCreate, setShowCreate] = useState(false);
  const [showEmailEditor, setShowEmailEditor] = useState(false);
  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);



  const [name, setName] = useState("");
  const [channel, setChannel] = useState<string>("");
  const [linkedinType, setLinkedinType] = useState<string>("");
  const [listId, setListId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [dailyLimit, setDailyLimit] = useState("50");

  const resetForm = () => {
    setName(""); setChannel(""); setLinkedinType(""); setListId("");
    setSubject(""); setMessageTemplate(""); setDailyLimit("50");
  };

  const handleCreate = async () => {
    if (!name || !channel) {
      toast({ title: "Preencha nome e canal", variant: "destructive" });
      return;
    }
    if (channel === "linkedin" && !linkedinType) {
      toast({ title: "Selecione o tipo de campanha LinkedIn", variant: "destructive" });
      return;
    }
    if (channel === "email" && !subject) {
      toast({ title: "Preencha o assunto do email", variant: "destructive" });
      return;
    }

    try {
      const campaign = await createCampaign.mutateAsync({
        name,
        channel,
        linkedin_type: channel === "linkedin" ? linkedinType : null,
        list_id: listId || null,
        subject: channel === "email" ? subject : null,
        message_template: messageTemplate || null,
        daily_limit: parseInt(dailyLimit) || 50,
      });

      if (listId && campaign) {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: items } = await supabase
          .from("prospect_list_items")
          .select("id")
          .eq("list_id", listId)
          .eq("item_type", "lead");
        if (items && items.length > 0) {
          await addLeads.mutateAsync({
            campaignId: campaign.id,
            leadIds: items.map((i) => i.id),
          });
        }
      }

      toast({ title: "Campanha criada com sucesso!" });
      setShowCreate(false);
      resetForm();
    } catch (e: any) {
      toast({ title: "Erro ao criar campanha", description: e.message, variant: "destructive" });
    }
  };

  const handleActivate = async (campaign: Campaign) => {
    if (campaign.channel === "whatsapp" && user) {
      const connected = await checkWhatsAppConnection(user.id);
      if (!connected) {
        toast({
          title: "WhatsApp não conectado",
          description: "Conecte seu WhatsApp nas Configurações antes de ativar a campanha.",
          variant: "destructive",
        });
        navigate("/settings?tab=integrations");
        return;
      }
    }
    if (campaign.channel === "linkedin" && user) {
      const connected = await checkIntegrationConnection(user.id, "linkedin");
      if (!connected) {
        toast({
          title: "LinkedIn não conectado",
          description: "Conecte sua conta pessoal do LinkedIn nas Configurações antes de ativar a campanha.",
          variant: "destructive",
        });
        navigate("/settings?tab=integrations");
        return;
      }
    }
    if (campaign.channel === "email" && user) {
      const connected = await checkIntegrationConnection(user.id, "email");
      if (!connected) {
        toast({
          title: "Email não conectado",
          description: "Conecte sua conta de email nas Configurações antes de ativar a campanha.",
          variant: "destructive",
        });
        navigate("/settings?tab=integrations");
        return;
      }
    }
    activateCampaign.mutate(campaign.id);
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Campanhas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie campanhas de prospecção por WhatsApp, Email e LinkedIn.
          </p>
        </div>
        <Button onClick={() => setShowChannelPicker(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Disconnection warnings */}
      {[
        { show: waStatus !== "connected", label: "WhatsApp", desc: "Campanhas de WhatsApp não poderão ser disparadas sem uma conexão ativa." },
        { show: linkedinStatus !== "connected", label: "LinkedIn", desc: "Conecte sua conta pessoal do LinkedIn para enviar convites e mensagens." },
        { show: emailStatus !== "connected", label: "Email", desc: "Conecte sua conta de email para disparar campanhas de email." },
      ].filter(w => w.show).map(w => (
        <Card key={w.label} className="border border-amber-300 bg-amber-50 shadow-none dark:border-amber-700 dark:bg-amber-950/30">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{w.label} desconectado</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">{w.desc}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/settings?tab=integrations")}
              className="border-amber-400 text-amber-700 hover:bg-amber-100">
              Conectar
            </Button>
          </CardContent>
        </Card>
      ))}

      {/* Campaign list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !campaigns || campaigns.length === 0 ? (
        <Card className="border border-border shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Send className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma campanha criada ainda.</p>
            <Button variant="outline" className="mt-4" onClick={() => setShowCreate(true)}>
              Criar primeira campanha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const Icon = channelIcons[c.channel] || Send;
            const sb = statusBadge[c.status] || statusBadge.draft;
            return (
              <Card
                key={c.id}
                className="cursor-pointer border border-border shadow-none transition-colors hover:bg-accent/50"
                onClick={() => setSelectedCampaign(c)}
              >
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.name}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{channelLabels[c.channel]}</span>
                        {c.linkedin_type && (
                          <>
                            <span>·</span>
                            <span>{linkedinTypeLabels[c.linkedin_type]}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
                      <span className="flex items-center gap-1"><Send className="h-3 w-3" />{c.total_sent}</span>
                      <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" />{c.total_delivered}</span>
                      <span className="flex items-center gap-1"><Reply className="h-3 w-3" />{c.total_replied}</span>
                      <span className="flex items-center gap-1"><XCircle className="h-3 w-3" />{c.total_failed}</span>
                    </div>
                    <Badge variant={sb.variant}>{sb.label}</Badge>
                    {(c.status === "draft" || c.status === "paused") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); handleActivate(c); }}
                      >
                        <Play className="mr-1 h-3 w-3" /> Ativar
                      </Button>
                    )}
                    {c.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); pauseCampaign.mutate(c.id); }}
                      >
                        <Pause className="mr-1 h-3 w-3" /> Pausar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); setCampaignToDelete(c); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Channel picker dialog */}
      <Dialog open={showChannelPicker} onOpenChange={setShowChannelPicker}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Selecione o canal da campanha</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {[
              { label: "E-mail", icon: Mail, desc: "Disparos com rastreamento, variáveis e preview", value: "email", color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/20" },
              { label: "WhatsApp", icon: MessageSquare, desc: "Mensagens em massa via WhatsApp conectado", value: "whatsapp", color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
              { label: "LinkedIn", icon: Linkedin, desc: "Convites, InMails e mensagens para conexões", value: "linkedin", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
            ].map((ch) => (
              <button
                key={ch.value}
                onClick={() => {
                  setShowChannelPicker(false);
                  if (ch.value === "email") {
                    setShowEmailEditor(true);
                  } else {
                    setChannel(ch.value);
                    setShowCreate(true);
                  }
                }}
                className="w-full flex items-center gap-3 rounded-lg border border-border p-3.5 text-left hover:bg-accent transition-colors"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ch.bg}`}>
                  <ch.icon className={`h-5 w-5 ${ch.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{ch.label}</p>
                  <p className="text-xs text-muted-foreground">{ch.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Email campaign editor */}
      <EmailCampaignEditor
        open={showEmailEditor}
        onOpenChange={setShowEmailEditor}
        onCreated={() => {}}
      />

      {/* Create campaign dialog (WhatsApp / LinkedIn) */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Nova Campanha {channel === "whatsapp" ? "WhatsApp" : channel === "linkedin" ? "LinkedIn" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da campanha</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Prospecção Q1 2026" />
            </div>
            <div>
              <Label>Canal</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue placeholder="Selecione o canal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {channel === "whatsapp" && waStatus !== "connected" && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>WhatsApp não conectado. <button className="underline font-medium" onClick={() => navigate("/settings?tab=integrations")}>Conectar agora</button></span>
              </div>
            )}

            {channel === "linkedin" && (
              <div>
                <Label>Tipo de campanha LinkedIn</Label>
                <Select value={linkedinType} onValueChange={setLinkedinType}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="connection_request">Convite de Conexão (mensagem opcional)</SelectItem>
                    <SelectItem value="inmail">Mensagem para não-conexões (InMail)</SelectItem>
                    <SelectItem value="message">Mensagem para conexões existentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Lista de leads</Label>
              <Select value={listId} onValueChange={setListId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma lista" /></SelectTrigger>
                <SelectContent>
                  {lists?.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Mensagem / Template</Label>
              <Textarea
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Use {{name}} para personalizar"
                rows={4}
              />
            </div>

            <div>
              <Label>Limite diário de envios</Label>
              <Input type="number" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} min={1} max={500} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createCampaign.isPending}>
              {createCampaign.isPending ? "Criando..." : "Criar Campanha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedCampaign && (
        <CampaignDetail campaign={selectedCampaign} onClose={() => setSelectedCampaign(null)} />
      )}

      <AlertDialog open={!!campaignToDelete} onOpenChange={(open) => !open && setCampaignToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a campanha "{campaignToDelete?.name}"? Esta ação não pode ser desfeita e todos os leads vinculados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (campaignToDelete) {
                  deleteCampaign.mutate(campaignToDelete.id, {
                    onSuccess: () => {
                      toast({ title: "Campanha removida com sucesso" });
                      setCampaignToDelete(null);
                      if (selectedCampaign?.id === campaignToDelete.id) setSelectedCampaign(null);
                    },
                    onError: (e) => {
                      toast({ title: "Erro ao remover", description: e.message, variant: "destructive" });
                    },
                  });
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function CampaignDetail({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const { data: leads, isLoading } = useCampaignLeads(campaign.id);
  const [leadData, setLeadData] = useState<Record<string, { name: string; email: string | null; phone: string | null }>>({});
  const [clicksByLead, setClicksByLead] = useState<Record<string, number>>({});
  const Icon = channelIcons[campaign.channel] || Send;

  useEffect(() => {
    if (!leads || leads.length === 0) return;
    const ids = leads.map((l) => l.lead_id);

    // Fetch lead details
    supabase
      .from("prospect_list_items")
      .select("id, name, email, phone, link_clicks_count")
      .in("id", ids)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, { name: string; email: string | null; phone: string | null }> = {};
          const clicks: Record<string, number> = {};
          data.forEach((d) => {
            map[d.id] = { name: d.name || d.email || d.id.slice(0, 8), email: d.email, phone: d.phone };
            clicks[d.id] = d.link_clicks_count || 0;
          });
          setLeadData(map);
          setClicksByLead(clicks);
        }
      });
  }, [leads]);

  const statusColors: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    queued: "bg-primary/10 text-primary",
    sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    opened: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    clicked: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    replied: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    failed: "bg-destructive/10 text-destructive",
    accepted: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    invalid: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pendente",
    queued: "Na fila",
    sent: "Enviado",
    delivered: "Entregue",
    opened: "Aberto",
    clicked: "Clicado",
    replied: "Respondido",
    failed: "Falha",
    accepted: "Aceito",
    invalid: "Inválido",
  };

  const repliedLeads = leads?.filter((l) => l.replied_at) || [];
  const clickedLeads = leads?.filter((l) => clicksByLead[l.lead_id] > 0) || [];
  const totalRate = leads && leads.length > 0
    ? Math.round(((repliedLeads.length + clickedLeads.length) / leads.length) * 100)
    : 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {campaign.name}
            {campaign.linkedin_type && (
              <Badge variant="outline" className="ml-2 text-xs font-normal">
                {linkedinTypeLabels[campaign.linkedin_type]}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* KPI summary row */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-7 shrink-0">
          {[
            { label: "Enviados", val: campaign.total_sent, icon: Send },
            { label: "Entregues", val: campaign.total_delivered, icon: CheckCircle },
            { label: "Abertos", val: campaign.total_opened, icon: Eye },
            { label: "Clicados", val: (campaign as any).total_clicked || 0, icon: MousePointerClick },
            { label: "Respondidos", val: campaign.total_replied, icon: Reply },
            { label: "Aceitos", val: campaign.total_accepted, icon: Users },
            { label: "Falhas", val: campaign.total_failed, icon: XCircle },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border p-2.5 text-center">
              <s.icon className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-base font-bold text-foreground">{s.val}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="leads" className="flex-1 flex flex-col min-h-0">
          <TabsList className="shrink-0">
            <TabsTrigger value="leads">
              Todos os leads {leads ? `(${leads.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="replies">
              Respostas {repliedLeads.length > 0 ? `(${repliedLeads.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="clicks">
              Cliques {clickedLeads.length > 0 ? `(${clickedLeads.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="metrics">
              Métricas
            </TabsTrigger>
          </TabsList>

          {/* All Leads tab */}
          <TabsContent value="leads" className="flex-1 overflow-auto min-h-0 mt-3">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !leads || leads.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum lead na campanha.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cliques</TableHead>
                    <TableHead>Enviado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-foreground">{leadData[l.lead_id]?.name || l.lead_id.slice(0, 8) + "..."}</p>
                          {leadData[l.lead_id]?.email && (
                            <p className="text-xs text-muted-foreground">{leadData[l.lead_id].email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[l.status] || ""} variant="secondary">
                          {statusLabels[l.status] || l.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {clicksByLead[l.lead_id] > 0 ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                            <MousePointerClick className="h-3 w-3" />
                            {clicksByLead[l.lead_id]}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.sent_at ? new Date(l.sent_at).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Replies tab */}
          <TabsContent value="replies" className="flex-1 overflow-auto min-h-0 mt-3">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : repliedLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Reply className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma resposta ainda.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Enviado em</TableHead>
                    <TableHead>Respondido em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repliedLeads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-foreground">{leadData[l.lead_id]?.name || l.lead_id.slice(0, 8) + "..."}</p>
                          {leadData[l.lead_id]?.email && (
                            <p className="text-xs text-muted-foreground">{leadData[l.lead_id].email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.sent_at ? new Date(l.sent_at).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-foreground font-medium">
                        {l.replied_at ? new Date(l.replied_at).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Clicks tab */}
          <TabsContent value="clicks" className="flex-1 overflow-auto min-h-0 mt-3">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : clickedLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MousePointerClick className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum clique registrado ainda.</p>
                <p className="text-xs text-muted-foreground mt-1">Os cliques aparecerão aqui quando os leads acessarem os links das mensagens.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cliques únicos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clickedLeads
                    .sort((a, b) => (clicksByLead[b.lead_id] || 0) - (clicksByLead[a.lead_id] || 0))
                    .map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-foreground">{leadData[l.lead_id]?.name || l.lead_id.slice(0, 8) + "..."}</p>
                            {leadData[l.lead_id]?.email && (
                              <p className="text-xs text-muted-foreground">{leadData[l.lead_id].email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[l.status] || ""} variant="secondary">
                            {statusLabels[l.status] || l.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-sm font-bold text-primary">
                            <MousePointerClick className="h-3.5 w-3.5" />
                            {clicksByLead[l.lead_id]}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Metrics tab */}
          <TabsContent value="metrics" className="flex-1 overflow-auto min-h-0 mt-3">
            <div className="space-y-4">
              {/* Engagement rate */}
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Taxa de engajamento geral</h3>
                <div className="flex items-end gap-3">
                  <span className="text-3xl font-bold text-primary">{totalRate}%</span>
                  <span className="text-sm text-muted-foreground mb-1">respostas + cliques / total</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(totalRate, 100)}%` }}
                  />
                </div>
              </div>

              {/* Metric cards */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Taxa de entrega",
                    value: campaign.total_sent > 0 ? Math.round((campaign.total_delivered / campaign.total_sent) * 100) : 0,
                    icon: CheckCircle,
                    desc: `${campaign.total_delivered} de ${campaign.total_sent} enviados`
                  },
                  {
                    label: "Taxa de resposta",
                    value: campaign.total_sent > 0 ? Math.round((campaign.total_replied / campaign.total_sent) * 100) : 0,
                    icon: Reply,
                    desc: `${campaign.total_replied} respondidos`
                  },
                  {
                    label: "Taxa de cliques",
                    value: leads && leads.length > 0 ? Math.round((clickedLeads.length / leads.length) * 100) : 0,
                    icon: MousePointerClick,
                    desc: `${clickedLeads.length} leads clicaram em links`
                  },
                  {
                    label: "Cliques (tracking)",
                    value: campaign.total_sent > 0 ? Math.round(((campaign as any).total_clicked || 0) / campaign.total_sent * 100) : 0,
                    icon: MousePointerClick,
                    desc: `${(campaign as any).total_clicked || 0} clicaram no botão do email`
                  },
                  {
                    label: "Taxa de falha",
                    value: campaign.total_sent > 0 ? Math.round((campaign.total_failed / campaign.total_sent) * 100) : 0,
                    icon: XCircle,
                    desc: `${campaign.total_failed} falhas`
                  },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <m.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{m.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{m.value}%</p>
                    <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default Campaigns;
