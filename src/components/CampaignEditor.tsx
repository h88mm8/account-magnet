import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronDown, Link2, Calendar, Eye, Save, Send, Users, AlertTriangle,
  CheckCircle, Variable, FlaskConical, Loader2, Plus, Trash2, Linkedin, Mail, MessageSquare, Clock,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProspectLists } from "@/hooks/useProspectLists";
import { useCreateCampaign, useAddLeadsToCampaign } from "@/hooks/useCampaigns";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/RichTextEditor";

// ─── Shared variables across all channels ────────────────────────
const VARIABLES = [
  { label: "Primeiro nome", token: "{{FIRST_NAME}}" },
  { label: "Sobrenome", token: "{{LAST_NAME}}" },
  { label: "Nome completo", token: "{{NAME}}" },
  { label: "E-mail", token: "{{EMAIL}}" },
  { label: "Empresa", token: "{{COMPANY}}" },
  { label: "Cargo", token: "{{POSITION}}" },
  { label: "Cidade", token: "{{CITY}}" },
  { label: "Setor", token: "{{INDUSTRY}}" },
];

// ─── LinkedIn character limits ───────────────────────────────────
const LINKEDIN_LIMITS: Record<string, number> = {
  connection_request: 300,
  inmail: 1900,
  message: 8000,
};

const LINKEDIN_TYPE_LABELS: Record<string, string> = {
  connection_request: "Convite de Conexão",
  inmail: "InMail (não-conexão)",
  message: "Mensagem (conexão existente)",
};

const DAY_OPTIONS = [
  { value: "mon", label: "Seg" },
  { value: "tue", label: "Ter" },
  { value: "wed", label: "Qua" },
  { value: "thu", label: "Qui" },
  { value: "fri", label: "Sex" },
  { value: "sat", label: "Sáb" },
  { value: "sun", label: "Dom" },
];

// ─── Step type for multi-step campaigns ──────────────────────────
interface CampaignStep {
  id: string;
  step_type: string; // connection_request | message | follow_up
  message_template: string;
  subject: string;
  delay_days: number;
  delay_hours: number;
  condition_type: string; // no_reply | always
}

interface ListPreview {
  id: string;
  name: string;
  count: number;
}

export type CampaignChannel = "email" | "linkedin" | "whatsapp";

interface CampaignEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  channel: CampaignChannel;
}

// ─── Helper to strip HTML for char count ─────────────────────────
function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

// ─── Preview variable replacement ────────────────────────────────
function replacePreviewVars(text: string, lead?: Record<string, string | null>): string {
  const defaults: Record<string, string> = {
    "{{FIRST_NAME}}": "João",
    "{{LAST_NAME}}": "Silva",
    "{{NAME}}": "João Silva",
    "{{EMAIL}}": "joao@empresa.com",
    "{{COMPANY}}": "Empresa XYZ",
    "{{POSITION}}": "Diretor Comercial",
    "{{CITY}}": "São Paulo",
    "{{INDUSTRY}}": "Tecnologia",
    "{{TRACKING_URL}}": "#",
    "{{SCHEDULING_LINK}}": "#",
  };
  let result = text;
  for (const [token, fallback] of Object.entries(defaults)) {
    const val = lead ? (lead[token] || fallback) : fallback;
    result = result.replace(new RegExp(token.replace(/[{}]/g, "\\$&"), "g"), val);
  }
  // Handle fallback syntax: {{var | "fallback"}}
  result = result.replace(/\{\{(\w+)\s*\|\s*"([^"]+)"\}\}/g, (_m, _key, fb) => fb);
  return result;
}

const CHANNEL_TITLES: Record<CampaignChannel, string> = {
  email: "Nova Campanha de E-mail",
  linkedin: "Nova Campanha LinkedIn",
  whatsapp: "Nova Campanha WhatsApp",
};

const CHANNEL_ICONS: Record<CampaignChannel, any> = {
  email: Mail,
  linkedin: Linkedin,
  whatsapp: MessageSquare,
};

export function CampaignEditor({ open, onOpenChange, onCreated, channel }: CampaignEditorProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { lists } = useProspectLists();
  const createCampaign = useCreateCampaign();
  const addLeads = useAddLeadsToCampaign();

  // ── Core form state ──
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [messageHtml, setMessageHtml] = useState("");
  const [selectedLists, setSelectedLists] = useState<ListPreview[]>([]);
  const [dailyLimit, setDailyLimit] = useState("50");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<"draft" | "send">("draft");

  // ── LinkedIn specific ──
  const [linkedinType, setLinkedinType] = useState("connection_request");

  // ── Scheduling ──
  const [minDelay, setMinDelay] = useState("10");
  const [maxDelay, setMaxDelay] = useState("30");
  const [scheduleDays, setScheduleDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri"]);
  const [scheduleStart, setScheduleStart] = useState("08:00");
  const [scheduleEnd, setScheduleEnd] = useState("18:00");
  const [scheduleTimezone, setScheduleTimezone] = useState("America/Sao_Paulo");

  // ── CTA (email only) ──
  const [ctaButtonText, setCtaButtonText] = useState("Acessar site");
  const [ctaButtonColor, setCtaButtonColor] = useState("#3b82f6");
  const [ctaButtonFontColor, setCtaButtonFontColor] = useState("#ffffff");

  // ── Multi-step (linkedin) ──
  const [steps, setSteps] = useState<CampaignStep[]>([]);
  const [activeStepIdx, setActiveStepIdx] = useState(0);

  // ── Progress ──
  const [showProgress, setShowProgress] = useState(false);
  const [progressSent, setProgressSent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressDone, setProgressDone] = useState(false);
  const [progressHadErrors, setProgressHadErrors] = useState(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Tracking link dialog ──
  const [showTrackingDialog, setShowTrackingDialog] = useState(false);
  const [trackingText, setTrackingText] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  // ── Preview with real lead ──
  const [previewLeads, setPreviewLeads] = useState<Record<string, string | null>[]>([]);
  const [previewLeadIdx, setPreviewLeadIdx] = useState(0);

  const totalContacts = selectedLists.reduce((s, l) => s + l.count, 0);
  const ChannelIcon = CHANNEL_ICONS[channel];

  // Character count for LinkedIn
  const plainTextLength = stripHtml(channel === "linkedin" && steps.length > 0
    ? (steps[activeStepIdx]?.message_template || "")
    : messageHtml
  ).length;
  const charLimit = channel === "linkedin" ? (LINKEDIN_LIMITS[linkedinType] || 8000) : 0;

  // ── Initialize LinkedIn steps ──
  useEffect(() => {
    if (channel === "linkedin" && steps.length === 0) {
      setSteps([{
        id: crypto.randomUUID(),
        step_type: "connection_request",
        message_template: "",
        subject: "",
        delay_days: 0,
        delay_hours: 0,
        condition_type: "always",
      }]);
      setActiveStepIdx(0);
    }
  }, [channel]);

  // ── Load preview leads when lists change ──
  useEffect(() => {
    if (selectedLists.length === 0) { setPreviewLeads([]); return; }
    const loadLeads = async () => {
      const { data } = await supabase
        .from("prospect_list_items")
        .select("name, email, company, title, location, industry")
        .eq("list_id", selectedLists[0].id)
        .eq("item_type", "lead")
        .limit(10);
      if (data) {
        setPreviewLeads(data.map(d => {
          const parts = (d.name || "").split(" ");
          return {
            "{{FIRST_NAME}}": parts[0] || null,
            "{{LAST_NAME}}": parts.slice(1).join(" ") || null,
            "{{NAME}}": d.name,
            "{{EMAIL}}": d.email,
            "{{COMPANY}}": d.company,
            "{{POSITION}}": d.title,
            "{{CITY}}": d.location,
            "{{INDUSTRY}}": d.industry,
          };
        }));
        setPreviewLeadIdx(0);
      }
    };
    loadLeads();
  }, [selectedLists]);

  const toggleList = async (listId: string, listName: string) => {
    const already = selectedLists.find((l) => l.id === listId);
    if (already) { setSelectedLists((prev) => prev.filter((l) => l.id !== listId)); return; }
    const { count } = await supabase
      .from("prospect_list_items")
      .select("*", { count: "exact", head: true })
      .eq("list_id", listId)
      .eq("item_type", "lead");
    setSelectedLists((prev) => [...prev, { id: listId, name: listName, count: count ?? 0 }]);
  };

  const toggleDay = (day: string) => {
    setScheduleDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const insertAtCursor = useCallback((text: string) => {
    if (channel === "linkedin" && steps.length > 0) {
      setSteps(prev => prev.map((s, i) =>
        i === activeStepIdx ? { ...s, message_template: s.message_template + text } : s
      ));
    } else {
      setMessageHtml((prev) => prev + text);
    }
  }, [channel, steps.length, activeStepIdx]);

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

  // ── LinkedIn step management ──
  const addStep = () => {
    const newStep: CampaignStep = {
      id: crypto.randomUUID(),
      step_type: steps.length === 0 ? "connection_request" : "message",
      message_template: "",
      subject: "",
      delay_days: 1,
      delay_hours: 0,
      condition_type: "no_reply",
    };
    setSteps(prev => [...prev, newStep]);
    setActiveStepIdx(steps.length);
  };

  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(prev => prev.filter((_, i) => i !== idx));
    setActiveStepIdx(Math.max(0, activeStepIdx >= idx ? activeStepIdx - 1 : activeStepIdx));
  };

  const updateStep = (idx: number, updates: Partial<CampaignStep>) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
  };

  // ── Current editor content (step or main) ──
  const currentMessage = channel === "linkedin" && steps.length > 0
    ? (steps[activeStepIdx]?.message_template || "")
    : messageHtml;

  const setCurrentMessage = (html: string) => {
    if (channel === "linkedin" && steps.length > 0) {
      updateStep(activeStepIdx, { message_template: html });
    } else {
      setMessageHtml(html);
    }
  };

  const previewLead = previewLeads[previewLeadIdx] || undefined;
  const htmlPreview = replacePreviewVars(currentMessage, previewLead);

  const resetForm = () => {
    setName(""); setSubject(""); setMessageHtml(""); setSelectedLists([]);
    setDailyLimit("50"); setLinkedinType("connection_request");
    setMinDelay("10"); setMaxDelay("30");
    setScheduleDays(["mon", "tue", "wed", "thu", "fri"]);
    setScheduleStart("08:00"); setScheduleEnd("18:00");
    setScheduleTimezone("America/Sao_Paulo");
    setCtaButtonText("Acessar site"); setCtaButtonColor("#3b82f6"); setCtaButtonFontColor("#ffffff");
    setSteps([]); setActiveStepIdx(0);
    setIsSubmitting(false); setShowProgress(false); setProgressSent(0);
    setProgressTotal(0); setProgressDone(false); setProgressHadErrors(false);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  };

  const pollProgress = (campaignId: string, totalLeads: number) => {
    setProgressTotal(totalLeads); setProgressSent(0); setProgressDone(false);
    setProgressHadErrors(false); setShowProgress(true);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(async () => {
      const { data } = await supabase.from("campaign_leads").select("status")
        .eq("campaign_id", campaignId)
        .in("status", ["sent", "delivered", "failed", "invalid"]);
      if (!data) return;
      const sent = data.filter((r) => r.status === "sent" || r.status === "delivered").length;
      const failed = data.filter((r) => r.status === "failed" || r.status === "invalid").length;
      setProgressSent(sent);
      if (failed > 0) setProgressHadErrors(true);
      if (sent + failed >= totalLeads) {
        setProgressDone(true);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      }
    }, 3000);
  };

  // ── Validate before submit ──
  const validate = (mode: "draft" | "send"): boolean => {
    if (!name.trim()) { toast({ title: "Preencha o nome da campanha", variant: "destructive" }); return false; }
    if (channel === "email" && !subject.trim()) { toast({ title: "Preencha o assunto do email", variant: "destructive" }); return false; }

    // Check for unresolved variables
    const content = channel === "linkedin" && steps.length > 0
      ? steps.map(s => s.message_template).join(" ")
      : messageHtml;

    if (!content.trim()) { toast({ title: "Escreva o conteúdo da mensagem", variant: "destructive" }); return false; }

    // Check broken variables (e.g. {{UNKNOWN}})
    const knownTokens = VARIABLES.map(v => v.token);
    const found = content.match(/\{\{[^}]+\}\}/g) || [];
    const broken = found.filter(t => !knownTokens.includes(t) && !/\{\{\w+\s*\|\s*"[^"]+"\}\}/.test(t));
    if (broken.length > 0) {
      toast({ title: "Variável desconhecida", description: `Verifique: ${broken.join(", ")}`, variant: "destructive" });
      return false;
    }

    // LinkedIn char limit
    if (channel === "linkedin" && steps.length > 0) {
      for (let i = 0; i < steps.length; i++) {
        const len = stripHtml(steps[i].message_template).length;
        const lType = i === 0 ? linkedinType : "message";
        const limit = LINKEDIN_LIMITS[lType] || 8000;
        if (len > limit) {
          toast({ title: `Step ${i + 1} excede o limite de ${limit} caracteres`, variant: "destructive" });
          return false;
        }
      }
    }

    if (selectedLists.length === 0 && mode === "send") {
      toast({ title: "Selecione pelo menos uma lista", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSubmit = async (mode: "draft" | "send") => {
    if (!validate(mode)) return;
    setIsSubmitting(true); setSubmitMode(mode);

    try {
      const campaign = await createCampaign.mutateAsync({
        name,
        channel,
        linkedin_type: channel === "linkedin" ? linkedinType : null,
        subject: channel === "email" ? subject : null,
        message_template: channel === "linkedin" && steps.length > 0
          ? steps[0].message_template
          : messageHtml,
        daily_limit: parseInt(dailyLimit) || 50,
        list_id: selectedLists[0]?.id || null,
        cta_button_text: channel === "email" ? ctaButtonText : undefined,
        cta_button_color: channel === "email" ? ctaButtonColor : undefined,
        cta_button_font_color: channel === "email" ? ctaButtonFontColor : undefined,
      });

      // Update scheduling fields
      if (campaign) {
        await supabase.from("campaigns").update({
          min_delay_seconds: parseInt(minDelay) || 10,
          max_delay_seconds: parseInt(maxDelay) || 30,
          schedule_days: scheduleDays,
          schedule_start_time: scheduleStart + ":00",
          schedule_end_time: scheduleEnd + ":00",
          schedule_timezone: scheduleTimezone,
        } as any).eq("id", campaign.id);
      }

      // Save campaign steps (LinkedIn multi-step)
      if (campaign && channel === "linkedin" && steps.length > 0) {
        const stepRows = steps.map((s, i) => ({
          campaign_id: campaign.id,
          user_id: user!.id,
          step_order: i + 1,
          step_type: i === 0 ? linkedinType : s.step_type,
          message_template: s.message_template,
          subject: s.subject || null,
          delay_days: s.delay_days,
          delay_hours: s.delay_hours,
          condition_type: s.condition_type,
        }));
        await supabase.from("campaign_steps").insert(stepRows);
      }

      // Add leads from selected lists
      const allLeadIds: string[] = [];
      if (campaign && selectedLists.length > 0) {
        for (const list of selectedLists) {
          let query = supabase.from("prospect_list_items").select("id").eq("list_id", list.id).eq("item_type", "lead");
          if (channel === "email") query = query.not("email", "is", null);
          if (channel === "whatsapp") query = query.not("phone", "is", null);
          if (channel === "linkedin") query = query.not("linkedin_url", "is", null);
          const { data: items } = await query;
          if (items) allLeadIds.push(...items.map((i) => i.id));
        }
        if (allLeadIds.length > 0) {
          await addLeads.mutateAsync({ campaignId: campaign.id, leadIds: allLeadIds });
        }
      }

      if (mode === "send" && campaign) {
        await supabase.from("campaigns").update({ status: "active" } as any).eq("id", campaign.id);
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

  useEffect(() => {
    return () => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); };
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!isSubmitting) { onOpenChange(v); if (!v) resetForm(); } }}>
        <DialogContent className="max-w-5xl h-[92vh] flex flex-col p-0 gap-0 [&>button.absolute]:hidden">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <ChannelIcon className="h-5 w-5 text-primary" />
              {CHANNEL_TITLES[channel]}
            </DialogTitle>
          </DialogHeader>

          {/* Body — two columns */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* ─── LEFT COLUMN: Config ─── */}
            <div className="w-72 shrink-0 border-r border-border overflow-y-auto p-4 space-y-4">
              {/* Campaign name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome interno</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Prospecção Q2" className="text-sm" />
              </div>

              {/* Subject (email only) */}
              {channel === "email" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assunto do email</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="O que o destinatário verá" className="text-sm" />
                  {subject && (
                    <p className="text-[10px] text-muted-foreground">
                      {subject.length}/60 caracteres
                      {subject.length > 60 && <span className="text-destructive ml-1">· Muito longo</span>}
                    </p>
                  )}
                </div>
              )}

              {/* LinkedIn type */}
              {channel === "linkedin" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo de campanha</Label>
                  <Select value={linkedinType} onValueChange={setLinkedinType}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="connection_request">Convite de Conexão</SelectItem>
                      <SelectItem value="inmail">InMail (não-conexão)</SelectItem>
                      <SelectItem value="message">Mensagem (conexão existente)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Separator />

              {/* List selection */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Users className="h-3 w-3" /> Selecionar Listas
                </Label>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {(!lists || lists.length === 0) ? (
                    <p className="text-xs text-muted-foreground py-2">Nenhuma lista disponível.</p>
                  ) : (
                    lists
                      .filter((l) => l.list_type === "leads" || l.list_type === "mixed")
                      .map((l) => {
                        const selected = selectedLists.some((s) => s.id === l.id);
                        return (
                          <button key={l.id} onClick={() => toggleList(l.id, l.name)}
                            className={cn(
                              "w-full flex items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors border",
                              selected
                                ? "border-primary/40 bg-primary/5 text-foreground"
                                : "border-border bg-background text-muted-foreground hover:bg-accent"
                            )}>
                            <span className="font-medium truncate">{l.name}</span>
                            {selected && <CheckCircle className="h-3 w-3 text-primary shrink-0" />}
                          </button>
                        );
                      })
                  )}
                </div>
                {selectedLists.length > 0 && (
                  <div className="rounded-md border border-border bg-muted/30 p-2.5 space-y-1">
                    <p className="text-xs font-semibold text-foreground">{totalContacts.toLocaleString("pt-BR")} contatos</p>
                    {selectedLists.map((l) => (
                      <div key={l.id} className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="truncate">{l.name}</span>
                        <span className="ml-1 shrink-0">{l.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Daily limit + delays */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Limite diário</Label>
                  <Input type="number" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} min={1} max={500} className="text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Delay mín (s)</Label>
                    <Input type="number" value={minDelay} onChange={(e) => setMinDelay(e.target.value)} min={1} className="text-sm h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Delay máx (s)</Label>
                    <Input type="number" value={maxDelay} onChange={(e) => setMaxDelay(e.target.value)} min={1} className="text-sm h-8" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Scheduling */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Agendamento
                </Label>
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground">Dias permitidos</Label>
                  <div className="flex flex-wrap gap-1">
                    {DAY_OPTIONS.map(d => (
                      <button key={d.value} onClick={() => toggleDay(d.value)}
                        className={cn(
                          "text-[10px] px-2 py-1 rounded-md border transition-colors",
                          scheduleDays.includes(d.value)
                            ? "border-primary/40 bg-primary/10 text-primary font-medium"
                            : "border-border text-muted-foreground hover:bg-accent"
                        )}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Início</Label>
                    <Input type="time" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} className="text-sm h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Fim</Label>
                    <Input type="time" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} className="text-sm h-8" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Fuso horário</Label>
                  <Select value={scheduleTimezone} onValueChange={setScheduleTimezone}>
                    <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Sao_Paulo">São Paulo (BRT)</SelectItem>
                      <SelectItem value="America/New_York">New York (EST)</SelectItem>
                      <SelectItem value="Europe/London">London (GMT)</SelectItem>
                      <SelectItem value="Europe/Berlin">Berlin (CET)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* CTA Button config (email only) */}
              {channel === "email" && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Botão de CTA</Label>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Texto do botão</Label>
                        <Input value={ctaButtonText} onChange={(e) => setCtaButtonText(e.target.value)} placeholder="Acessar site" className="text-sm h-8" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Cor fundo</Label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={ctaButtonColor} onChange={(e) => setCtaButtonColor(e.target.value)} className="h-8 w-8 rounded border border-border cursor-pointer" />
                            <Input value={ctaButtonColor} onChange={(e) => setCtaButtonColor(e.target.value)} className="text-xs h-8 font-mono" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Cor texto</Label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={ctaButtonFontColor} onChange={(e) => setCtaButtonFontColor(e.target.value)} className="h-8 w-8 rounded border border-border cursor-pointer" />
                            <Input value={ctaButtonFontColor} onChange={(e) => setCtaButtonFontColor(e.target.value)} className="text-xs h-8 font-mono" />
                          </div>
                        </div>
                      </div>
                      <div className="rounded-md border border-border bg-muted/20 p-3">
                        <p className="text-[10px] text-muted-foreground mb-2">Preview:</p>
                        <a href="#" onClick={(e) => e.preventDefault()}
                          style={{ display: "inline-block", backgroundColor: ctaButtonColor, color: ctaButtonFontColor, padding: "10px 20px", borderRadius: "6px", textDecoration: "none", fontWeight: 600, fontSize: "13px" }}>
                          {ctaButtonText || "Acessar site"}
                        </a>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* LinkedIn Multi-step */}
              {channel === "linkedin" && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Steps da cadência</Label>
                    <div className="space-y-1">
                      {steps.map((s, i) => (
                        <button key={s.id} onClick={() => setActiveStepIdx(i)}
                          className={cn(
                            "w-full flex items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors border",
                            i === activeStepIdx
                              ? "border-primary/40 bg-primary/5 text-foreground"
                              : "border-border bg-background text-muted-foreground hover:bg-accent"
                          )}>
                          <span className="font-medium">Step {i + 1}: {i === 0 ? LINKEDIN_TYPE_LABELS[linkedinType] : "Follow-up"}</span>
                          {steps.length > 1 && (
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={(e) => { e.stopPropagation(); removeStep(i); }} />
                          )}
                        </button>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={addStep}>
                      <Plus className="h-3 w-3" /> Adicionar step
                    </Button>
                  </div>

                  {/* Active step config */}
                  {steps[activeStepIdx] && activeStepIdx > 0 && (
                    <div className="space-y-2 rounded-md border border-border p-2.5 bg-muted/20">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Delay (dias)</Label>
                          <Input type="number" value={steps[activeStepIdx].delay_days}
                            onChange={(e) => updateStep(activeStepIdx, { delay_days: parseInt(e.target.value) || 0 })}
                            min={0} className="text-sm h-8" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Delay (horas)</Label>
                          <Input type="number" value={steps[activeStepIdx].delay_hours}
                            onChange={(e) => updateStep(activeStepIdx, { delay_hours: parseInt(e.target.value) || 0 })}
                            min={0} className="text-sm h-8" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Condição</Label>
                        <Select value={steps[activeStepIdx].condition_type}
                          onValueChange={(v) => updateStep(activeStepIdx, { condition_type: v })}>
                          <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no_reply">Se não respondeu</SelectItem>
                            <SelectItem value="no_accept">Se não aceitou</SelectItem>
                            <SelectItem value="always">Sempre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ─── RIGHT COLUMN: Editor + Preview ─── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <Tabs defaultValue="editor" className="flex flex-col flex-1 min-h-0">
                {/* Toolbar */}
                <div className="flex items-center justify-between border-b border-border px-4 py-2 shrink-0">
                  <TabsList className="h-8">
                    <TabsTrigger value="editor" className="text-xs px-3 py-1">✏️ Editor</TabsTrigger>
                    <TabsTrigger value="preview" className="text-xs px-3 py-1">
                      <Eye className="h-3 w-3 mr-1" /> Preview
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex items-center gap-1.5">
                    {/* Character counter for LinkedIn */}
                    {channel === "linkedin" && (
                      <span className={cn(
                        "text-[10px] font-mono px-2 py-1 rounded-md border",
                        plainTextLength > charLimit
                          ? "border-destructive/40 text-destructive bg-destructive/5"
                          : "border-border text-muted-foreground"
                      )}>
                        {plainTextLength}/{charLimit}
                      </span>
                    )}

                    {/* Insert variable */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                          <Variable className="h-3 w-3" /> Variável <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {VARIABLES.map((v) => (
                          <DropdownMenuItem key={v.token} onClick={() => insertAtCursor(v.token)} className="text-xs font-mono">
                            <span className="text-primary mr-2">{v.token}</span>
                            <span className="text-muted-foreground">{v.label}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Tracking link */}
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowTrackingDialog(true)}>
                      <Link2 className="h-3 w-3" /> Rastrear link
                    </Button>

                    {/* Scheduling link (email only) */}
                    {channel === "email" && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={insertSchedulingLink}>
                        <Calendar className="h-3 w-3" /> Agendamento
                      </Button>
                    )}
                  </div>
                </div>

                {/* Editor tab */}
                <TabsContent value="editor" className="flex-1 m-0 overflow-auto">
                  <RichTextEditor
                    value={currentMessage}
                    onChange={setCurrentMessage}
                    placeholder={channel === "linkedin"
                      ? "Olá {{FIRST_NAME}}, escreva sua mensagem LinkedIn aqui..."
                      : channel === "whatsapp"
                        ? "Olá {{FIRST_NAME}}, escreva sua mensagem WhatsApp aqui..."
                        : "Olá {{FIRST_NAME}}, escreva o corpo do seu email aqui..."
                    }
                    className="border-0 rounded-none"
                    minHeight="100%"
                  />
                </TabsContent>

                {/* Preview tab */}
                <TabsContent value="preview" className="flex-1 m-0 overflow-auto p-6">
                  {currentMessage ? (
                    <div className="max-w-xl mx-auto space-y-3">
                      {/* Lead selector for preview */}
                      {previewLeads.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>Preview com lead real:</span>
                          <Select value={String(previewLeadIdx)} onValueChange={(v) => setPreviewLeadIdx(parseInt(v))}>
                            <SelectTrigger className="h-7 w-auto text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {previewLeads.map((l, i) => (
                                <SelectItem key={i} value={String(i)} className="text-xs">
                                  {l["{{NAME}}"] || l["{{EMAIL}}"] || `Lead ${i + 1}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Channel-specific preview shell */}
                      {channel === "email" ? (
                        <div className="rounded-lg border border-border overflow-hidden shadow-sm">
                          <div className="bg-muted/30 px-4 py-3 border-b border-border">
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Assunto:</span>{" "}
                              {subject || <span className="italic">sem assunto</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Para:</span>{" "}
                              {previewLead?.["{{NAME}}"] || "João Silva"} &lt;{previewLead?.["{{EMAIL}}"] || "joao@empresa.com"}&gt;
                            </p>
                          </div>
                          <div className="bg-background p-6 prose prose-sm max-w-none text-sm text-foreground leading-relaxed [&_a]:text-primary"
                            dangerouslySetInnerHTML={{ __html: htmlPreview }} />
                          <div className="px-6 pb-4">
                            <a href="#" onClick={(e) => e.preventDefault()}
                              style={{ display: "inline-block", backgroundColor: ctaButtonColor, color: ctaButtonFontColor, padding: "12px 24px", borderRadius: "8px", textDecoration: "none", fontWeight: 600, fontSize: "14px" }}>
                              {ctaButtonText || "Acessar site"}
                            </a>
                          </div>
                        </div>
                      ) : channel === "linkedin" ? (
                        <div className="rounded-lg border border-border overflow-hidden shadow-sm">
                          <div className="bg-[hsl(var(--primary)/0.05)] px-4 py-3 border-b border-border flex items-center gap-2">
                            <Linkedin className="h-4 w-4 text-primary" />
                            <span className="text-xs font-medium text-foreground">
                              {steps[activeStepIdx] && activeStepIdx === 0
                                ? LINKEDIN_TYPE_LABELS[linkedinType]
                                : `Step ${activeStepIdx + 1}: Follow-up`}
                            </span>
                          </div>
                          <div className="bg-background p-6">
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                                {(previewLead?.["{{FIRST_NAME}}"] || "J")[0]}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">
                                  {previewLead?.["{{NAME}}"] || "João Silva"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {previewLead?.["{{POSITION}}"] || "Diretor Comercial"} · {previewLead?.["{{COMPANY}}"] || "Empresa XYZ"}
                                </p>
                                <div className="mt-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap"
                                  dangerouslySetInnerHTML={{ __html: htmlPreview }} />
                              </div>
                            </div>
                          </div>
                          <div className="border-t border-border px-4 py-2 flex items-center justify-between">
                            <span className={cn(
                              "text-[10px] font-mono",
                              stripHtml(htmlPreview).length > charLimit ? "text-destructive" : "text-muted-foreground"
                            )}>
                              {stripHtml(htmlPreview).length}/{charLimit} caracteres
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* WhatsApp preview */
                        <div className="rounded-lg border border-border overflow-hidden shadow-sm">
                          <div className="bg-[hsl(152,69%,41%,0.05)] px-4 py-3 border-b border-border flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-green-600" />
                            <span className="text-xs font-medium text-foreground">WhatsApp</span>
                          </div>
                          <div className="bg-background p-4">
                            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 max-w-[85%] ml-auto">
                              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{ __html: htmlPreview }} />
                              <p className="text-[10px] text-muted-foreground text-right mt-1">
                                {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground text-center">
                        {previewLead
                          ? `Preview com dados de ${previewLead["{{NAME}}"] || "lead"}`
                          : "Preview com dados fictícios"}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Eye className="h-10 w-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">Escreva a mensagem para ver o preview.</p>
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
                  {progressDone
                    ? <CheckCircle className="h-4 w-4 text-green-500" />
                    : <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  {progressDone
                    ? progressHadErrors ? "Concluído com alguns erros" : "Enviado com sucesso!"
                    : "Enviando..."}
                </span>
                <span className="text-muted-foreground font-mono text-xs">
                  {progressSent.toLocaleString("pt-BR")} / {progressTotal.toLocaleString("pt-BR")}
                </span>
              </div>
              <Progress value={progressTotal > 0 ? (progressSent / progressTotal) * 100 : 0} className="h-2" />
              {progressDone && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => { resetForm(); onOpenChange(false); }}>Fechar</Button>
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
                  <><AlertTriangle className="h-3.5 w-3.5 text-warning" /><span>Nenhuma lista selecionada</span></>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleSubmit("draft")} disabled={isSubmitting} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" />
                  {isSubmitting && submitMode === "draft" ? "Salvando..." : "Salvar rascunho"}
                </Button>
                <Button size="sm" onClick={() => handleSubmit("send")} disabled={isSubmitting} className="gap-1.5">
                  <Send className="h-3.5 w-3.5" />
                  {isSubmitting && submitMode === "send" ? "Criando..." : "Criar e enviar"}
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
              <Link2 className="h-4 w-4 text-primary" /> Inserir Link de Rastreamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Texto do link (CTA)</Label>
              <Input value={trackingText} onChange={(e) => setTrackingText(e.target.value)} placeholder='Ex: "Visite nosso site"' autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">URL de destino (opcional)</Label>
              <Input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://seusite.com (ou deixe vazio)" />
              <p className="text-[10px] text-muted-foreground">Se vazio, será usado o link configurado nas integrações.</p>
            </div>
            <div className="rounded-md bg-muted/40 border border-border p-2.5 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Como funciona o rastreamento:</p>
              <p>Cada destinatário recebe uma URL única com seu <code className="text-primary">contact_id</code> embutido. Todos os cliques são registrados automaticamente.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowTrackingDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={insertTrackingLink} disabled={!trackingText}>Inserir link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
