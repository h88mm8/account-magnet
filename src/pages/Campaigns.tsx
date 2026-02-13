import { useState } from "react";
import { Plus, Play, Pause, Mail, MessageSquare, Linkedin, Send, Users, CheckCircle, XCircle, Eye, Reply } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCampaigns, useCreateCampaign, useActivateCampaign, usePauseCampaign, useCampaignLeads, useAddLeadsToCampaign, type Campaign } from "@/hooks/useCampaigns";
import { useProspectLists } from "@/hooks/useProspectLists";
import { useToast } from "@/hooks/use-toast";

const channelIcons = {
  whatsapp: MessageSquare,
  email: Mail,
  linkedin: Linkedin,
};

const channelLabels = {
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
  const { data: campaigns, isLoading } = useCampaigns();
  const { lists } = useProspectLists();
  const createCampaign = useCreateCampaign();
  const activateCampaign = useActivateCampaign();
  const pauseCampaign = usePauseCampaign();
  const addLeads = useAddLeadsToCampaign();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<string>("");
  const [linkedinType, setLinkedinType] = useState<string>("");
  const [listId, setListId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [dailyLimit, setDailyLimit] = useState("50");

  const resetForm = () => {
    setName("");
    setChannel("");
    setLinkedinType("");
    setListId("");
    setSubject("");
    setMessageTemplate("");
    setDailyLimit("50");
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

      // If list selected, add all leads from that list
      if (listId && campaign) {
        const { data: items } = await (await import("@/integrations/supabase/client")).supabase
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

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Campanhas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie campanhas de prospecção por WhatsApp, Email e LinkedIn.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

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
            const Icon = channelIcons[c.channel];
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
                    {c.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); activateCampaign.mutate(c.id); }}
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
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create campaign dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Campanha</DialogTitle>
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
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                </SelectContent>
              </Select>
            </div>

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

            {channel === "email" && (
              <div>
                <Label>Assunto do email</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto" />
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

      {/* Campaign detail dialog */}
      {selectedCampaign && (
        <CampaignDetail campaign={selectedCampaign} onClose={() => setSelectedCampaign(null)} />
      )}
    </div>
  );
};

function CampaignDetail({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const { data: leads, isLoading } = useCampaignLeads(campaign.id);
  const Icon = channelIcons[campaign.channel];

  const statusColors: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    queued: "bg-primary/10 text-primary",
    sent: "bg-blue-100 text-blue-700",
    delivered: "bg-green-100 text-green-700",
    opened: "bg-amber-100 text-amber-700",
    replied: "bg-emerald-100 text-emerald-700",
    failed: "bg-destructive/10 text-destructive",
    accepted: "bg-violet-100 text-violet-700",
    bounced: "bg-red-100 text-red-700",
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {campaign.name}
          </DialogTitle>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[
            { label: "Enviados", val: campaign.total_sent, icon: Send },
            { label: "Entregues", val: campaign.total_delivered, icon: CheckCircle },
            { label: "Abertos", val: campaign.total_opened, icon: Eye },
            { label: "Respondidos", val: campaign.total_replied, icon: Reply },
            { label: "Aceitos", val: campaign.total_accepted, icon: Users },
            { label: "Falhas", val: campaign.total_failed, icon: XCircle },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border p-3 text-center">
              <s.icon className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
              <p className="text-lg font-bold text-foreground">{s.val}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Lead statuses */}
        <div className="max-h-[300px] overflow-auto">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !leads || leads.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lead na campanha.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Atualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.lead_id.slice(0, 8)}...</TableCell>
                    <TableCell>
                      <Badge className={statusColors[l.status] || ""} variant="secondary">
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{l.sent_at ? new Date(l.sent_at).toLocaleString("pt-BR") : "—"}</TableCell>
                    <TableCell className="text-xs">{new Date(l.updated_at).toLocaleString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default Campaigns;
