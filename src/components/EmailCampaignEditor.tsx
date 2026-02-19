import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ChevronDown,
  Link2,
  Calendar,
  Eye,
  Save,
  Send,
  Users,
  X,
  AlertTriangle,
  CheckCircle,
  Variable,
  FlaskConical,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProspectLists } from "@/hooks/useProspectLists";
import { useCreateCampaign, useAddLeadsToCampaign } from "@/hooks/useCampaigns";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const VARIABLES = [
  { label: "Primeiro nome", token: "{{FIRST_NAME}}" },
  { label: "Sobrenome", token: "{{LAST_NAME}}" },
  { label: "Nome completo", token: "{{NAME}}" },
  { label: "E-mail", token: "{{EMAIL}}" },
  { label: "Empresa", token: "{{COMPANY}}" },
];

interface EmailCampaignEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

interface ListPreview {
  id: string;
  name: string;
  count: number;
}

export function EmailCampaignEditor({ open, onOpenChange, onCreated }: EmailCampaignEditorProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { lists } = useProspectLists();
  const createCampaign = useCreateCampaign();
  const addLeads = useAddLeadsToCampaign();

  // Form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [messageHtml, setMessageHtml] = useState("");
  const [selectedLists, setSelectedLists] = useState<ListPreview[]>([]);
  const [dailyLimit, setDailyLimit] = useState("50");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<"draft" | "send" | "test">("draft");

  // Progress state
  const [showProgress, setShowProgress] = useState(false);
  const [progressSent, setProgressSent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressDone, setProgressDone] = useState(false);
  const [progressHadErrors, setProgressHadErrors] = useState(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tracking link dialog
  const [showTrackingDialog, setShowTrackingDialog] = useState(false);
  const [trackingText, setTrackingText] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const totalContacts = selectedLists.reduce((s, l) => s + l.count, 0);

  const toggleList = async (listId: string, listName: string) => {
    const already = selectedLists.find((l) => l.id === listId);
    if (already) {
      setSelectedLists((prev) => prev.filter((l) => l.id !== listId));
      return;
    }
    const { count } = await supabase
      .from("prospect_list_items")
      .select("*", { count: "exact", head: true })
      .eq("list_id", listId)
      .eq("item_type", "lead");
    setSelectedLists((prev) => [...prev, { id: listId, name: listName, count: count ?? 0 }]);
  };

  const insertAtCursor = useCallback(
    (text: string) => {
      const el = editorRef.current;
      if (!el) {
        setMessageHtml((prev) => prev + text);
        return;
      }
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const current = el.value;
      const newVal = current.substring(0, start) + text + current.substring(end);
      setMessageHtml(newVal);
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = start + text.length;
        el.focus();
      }, 10);
    },
    []
  );

  const insertTrackingLink = () => {
    if (!trackingText) return;
    const url = trackingUrl || "{{TRACKING_URL}}";
    const html = `<a href="${url}">${trackingText}</a>`;
    insertAtCursor(html);
    setShowTrackingDialog(false);
    setTrackingText("");
    setTrackingUrl("");
  };

  const insertSchedulingLink = () => {
    const block = `<div style="margin:16px 0;padding:16px;border:1px solid #e2e8f0;border-radius:8px;">
  <p style="margin:0 0 8px;font-weight:600;">📅 Agende uma conversa</p>
  <p style="margin:0 0 12px;color:#64748b;font-size:14px;">30 min · Online</p>
  <a href="{{SCHEDULING_LINK}}" style="background:#3b82f6;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:14px;">Veja todos os horários disponíveis</a>
</div>`;
    insertAtCursor(block);
  };

  const htmlPreview = messageHtml
    .replace(/{{FIRST_NAME}}/g, "João")
    .replace(/{{LAST_NAME}}/g, "Silva")
    .replace(/{{NAME}}/g, "João Silva")
    .replace(/{{EMAIL}}/g, "joao@empresa.com")
    .replace(/{{COMPANY}}/g, "Empresa XYZ")
    .replace(/{{TRACKING_URL}}/g, "#")
    .replace(/{{SCHEDULING_LINK}}/g, "#");

  const resetForm = () => {
    setName(""); setSubject(""); setMessageHtml(""); setSelectedLists([]); setDailyLimit("50");
    setIsSubmitting(false); setShowProgress(false); setProgressSent(0); setProgressTotal(0);
    setProgressDone(false); setProgressHadErrors(false);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  };

  const pollProgress = (campaignId: string, totalLeads: number) => {
    setProgressTotal(totalLeads); setProgressSent(0); setProgressDone(false); setProgressHadErrors(false); setShowProgress(true);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(async () => {
      const { data } = await supabase.from("campaign_leads").select("status").eq("campaign_id", campaignId).in("status", ["sent", "delivered", "failed", "invalid"]);
      if (!data) return;
      const sent = data.filter((r) => r.status === "sent" || r.status === "delivered").length;
      const failed = data.filter((r) => r.status === "failed" || r.status === "invalid").length;
      setProgressSent(sent);
      if (failed > 0) setProgressHadErrors(true);
      if (sent + failed >= totalLeads) { setProgressDone(true); if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); }
    }, 3000);
  };

  const handleTestSend = async () => {
    if (!subject.trim() || !messageHtml.trim()) { toast({ title: "Preencha assunto e conteúdo antes de testar", variant: "destructive" }); return; }
    setIsSubmitting(true); setSubmitMode("test");
    try {
      toast({ title: "Email de teste preparado", description: `Salve a campanha e ative para ver o resultado em ${user?.email}` });
    } finally { setIsSubmitting(false); }
  };

  const handleSubmit = async (mode: "draft" | "send") => {
    if (!name.trim()) { toast({ title: "Preencha o nome da campanha", variant: "destructive" }); return; }
    if (!subject.trim()) { toast({ title: "Preencha o assunto do email", variant: "destructive" }); return; }
    if (!messageHtml.trim()) { toast({ title: "Escreva o conteúdo do email", variant: "destructive" }); return; }
    if (selectedLists.length === 0 && mode === "send") { toast({ title: "Selecione pelo menos uma lista", variant: "destructive" }); return; }
    setIsSubmitting(true); setSubmitMode(mode);
    try {
      const campaign = await createCampaign.mutateAsync({ name, channel: "email", subject, message_template: messageHtml, daily_limit: parseInt(dailyLimit) || 50, list_id: selectedLists[0]?.id || null });
      const allLeadIds: string[] = [];
      if (campaign && selectedLists.length > 0) {
        for (const list of selectedLists) {
          const { data: items } = await supabase.from("prospect_list_items").select("id").eq("list_id", list.id).eq("item_type", "lead").not("email", "is", null);
          if (items) allLeadIds.push(...items.map((i) => i.id));
        }
        if (allLeadIds.length > 0) await addLeads.mutateAsync({ campaignId: campaign.id, leadIds: allLeadIds });
      }
      if (mode === "send" && campaign) {
        await supabase.from("campaigns").update({ status: "active" }).eq("id", campaign.id);
        pollProgress(campaign.id, allLeadIds.length || totalContacts);
        supabase.functions.invoke("process-campaign-queue", { body: { campaign_id: campaign.id } });
        onCreated?.();
      } else {
        toast({ title: "Rascunho salvo!", description: "Você pode ativar depois." });
        resetForm(); onOpenChange(false); onCreated?.();
      }
    } catch (e: any) {
      toast({ title: "Erro ao criar campanha", description: e.message, variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  useEffect(() => { return () => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); }; }, []);


  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!isSubmitting) { onOpenChange(v); if (!v) resetForm(); } }}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="font-display text-lg">Nova Campanha de E-mail</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => { onOpenChange(false); resetForm(); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Body — two columns */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* LEFT: config */}
            <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4 space-y-5">
              {/* Campaign name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Nome interno
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Follow-up Q2"
                  className="text-sm"
                />
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Assunto do email
                </Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="O que o destinatário verá"
                  className="text-sm"
                />
                {subject && (
                  <p className="text-[10px] text-muted-foreground">
                    {subject.length}/60 caracteres
                    {subject.length > 60 && (
                      <span className="text-destructive ml-1">· Muito longo</span>
                    )}
                  </p>
                )}
              </div>

              <Separator />

              {/* List selection */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Selecionar Listas
                </Label>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {(!lists || lists.length === 0) ? (
                    <p className="text-xs text-muted-foreground py-2">Nenhuma lista disponível.</p>
                  ) : (
                    lists
                      .filter((l) => l.list_type === "leads" || l.list_type === "mixed")
                      .map((l) => {
                        const selected = selectedLists.some((s) => s.id === l.id);
                        return (
                          <button
                            key={l.id}
                            onClick={() => toggleList(l.id, l.name)}
                            className={cn(
                              "w-full flex items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors border",
                              selected
                                ? "border-primary/40 bg-primary/5 text-foreground"
                                : "border-border bg-background text-muted-foreground hover:bg-accent"
                            )}
                          >
                            <span className="font-medium truncate">{l.name}</span>
                            {selected && <CheckCircle className="h-3 w-3 text-primary shrink-0" />}
                          </button>
                        );
                      })
                  )}
                </div>

                {/* Audience summary */}
                {selectedLists.length > 0 && (
                  <div className="rounded-md border border-border bg-muted/30 p-2.5 space-y-1">
                    <p className="text-xs font-semibold text-foreground">
                      {totalContacts.toLocaleString("pt-BR")} contatos
                    </p>
                    {selectedLists.map((l) => (
                      <div key={l.id} className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="truncate">{l.name}</span>
                        <span className="ml-1 shrink-0">{l.count}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1 border-t border-border">
                      <CheckCircle className="h-2.5 w-2.5 text-green-500" />
                      Bounces e descadastros excluídos automaticamente
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Daily limit */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Limite diário
                </Label>
                <Input
                  type="number"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  min={1}
                  max={500}
                  className="text-sm"
                />
              </div>
            </div>

            {/* RIGHT: editor + preview */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <Tabs defaultValue="editor" className="flex flex-col flex-1 min-h-0">
                {/* Toolbar */}
                <div className="flex items-center justify-between border-b border-border px-4 py-2 shrink-0">
                  <TabsList className="h-8">
                    <TabsTrigger value="editor" className="text-xs px-3 py-1">
                      ✏️ Editor
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="text-xs px-3 py-1">
                      <Eye className="h-3 w-3 mr-1" />
                      Preview
                    </TabsTrigger>
                  </TabsList>

                  {/* Insert buttons */}
                  <div className="flex items-center gap-1.5">
                    {/* Insert variable */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                          <Variable className="h-3 w-3" />
                          Variável
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {VARIABLES.map((v) => (
                          <DropdownMenuItem
                            key={v.token}
                            onClick={() => insertAtCursor(v.token)}
                            className="text-xs font-mono"
                          >
                            <span className="text-primary mr-2">{v.token}</span>
                            <span className="text-muted-foreground">{v.label}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Tracking link */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        setShowTrackingDialog(true);
                      }}
                    >
                      <Link2 className="h-3 w-3" />
                      Rastrear link
                    </Button>

                    {/* Scheduling link */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={insertSchedulingLink}
                    >
                      <Calendar className="h-3 w-3" />
                      Agendamento
                    </Button>
                  </div>
                </div>

                {/* Editor tab */}
                <TabsContent value="editor" className="flex-1 m-0 overflow-hidden">
                  <Textarea
                    ref={editorRef}
                    value={messageHtml}
                    onChange={(e) => setMessageHtml(e.target.value)}
                    placeholder={`Olá {{FIRST_NAME}},\n\nEscreva o corpo do seu email aqui. Use variáveis como {{NAME}} e {{COMPANY}} para personalização.\n\nVocê pode inserir links com o botão "Rastrear link" para monitorar cliques.`}
                    className="h-full w-full resize-none rounded-none border-0 focus-visible:ring-0 font-mono text-sm"
                    style={{ minHeight: "100%" }}
                  />
                </TabsContent>

                {/* Preview tab */}
                <TabsContent value="preview" className="flex-1 m-0 overflow-auto p-6">
                  {messageHtml ? (
                    <div className="max-w-xl mx-auto">
                      {/* Email shell */}
                      <div className="rounded-lg border border-border overflow-hidden shadow-sm">
                        <div className="bg-muted/30 px-4 py-3 border-b border-border">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Assunto:</span>{" "}
                            {subject || <span className="italic">sem assunto</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Para:</span> João Silva &lt;joao@empresa.com&gt;
                          </p>
                        </div>
                        <div
                          className="bg-background p-6 prose prose-sm max-w-none text-sm text-foreground whitespace-pre-wrap leading-relaxed [&_a]:text-primary"
                          dangerouslySetInnerHTML={{ __html: htmlPreview }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-3 text-center">
                        Preview com dados fictícios — João Silva · Empresa XYZ
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Eye className="h-10 w-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">Escreva o email para ver o preview.</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Progress overlay */}
          {showProgress && (
            <div className="border-t border-border px-6 py-4 shrink-0 bg-muted/30 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground flex items-center gap-2">
                  {progressDone ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {progressDone
                    ? progressHadErrors ? "Concluído com alguns erros" : "Enviado com sucesso!"
                    : "Enviando emails..."}
                </span>
                <span className="text-muted-foreground font-mono text-xs">
                  {progressSent.toLocaleString("pt-BR")} / {progressTotal.toLocaleString("pt-BR")}
                </span>
              </div>
              <Progress value={progressTotal > 0 ? (progressSent / progressTotal) * 100 : 0} className="h-2" />
              {progressDone && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => { resetForm(); onOpenChange(false); }}>
                  Fechar
                </Button>
              )}
            </div>
          )}

          {/* Footer */}
          {!showProgress && (
          <div className="border-t border-border px-6 py-3 flex items-center justify-between shrink-0 bg-background">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {selectedLists.length > 0 ? (
                <><Users className="h-3.5 w-3.5" /><span>{totalContacts.toLocaleString("pt-BR")} destinatários</span></>
              ) : (
                <><AlertTriangle className="h-3.5 w-3.5 text-yellow-500" /><span>Nenhuma lista selecionada</span></>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleTestSend} disabled={isSubmitting} className="gap-1.5 text-muted-foreground">
                <FlaskConical className="h-3.5 w-3.5" />
                Testar envio
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSubmit("draft")} disabled={isSubmitting} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                {isSubmitting && submitMode === "draft" ? "Salvando..." : "Salvar rascunho"}
              </Button>
              <Button size="sm" onClick={() => handleSubmit("send")} disabled={isSubmitting} className="gap-1.5">
                <Send className="h-3.5 w-3.5" />
                {isSubmitting && submitMode === "send" ? "Criando..." : "Criar e preparar envio"}
              </Button>
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tracking link dialog */}
      <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4 text-primary" />
              Inserir Link de Rastreamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Texto do link (CTA)</Label>
              <Input
                value={trackingText}
                onChange={(e) => setTrackingText(e.target.value)}
                placeholder='Ex: "Visite nosso site"'
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">URL de destino (opcional)</Label>
              <Input
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://seusite.com (ou deixe vazio)"
              />
              <p className="text-[10px] text-muted-foreground">
                Se vazio, será usado o link configurado nas integrações.
              </p>
            </div>
            <div className="rounded-md bg-muted/40 border border-border p-2.5 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Como funciona o rastreamento:</p>
              <p>Cada destinatário recebe uma URL única com seu <code className="text-primary">contact_id</code> embutido. Todos os cliques são registrados automaticamente.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowTrackingDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={insertTrackingLink} disabled={!trackingText}>
              Inserir link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
