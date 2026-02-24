import { useState, useEffect } from "react";
import { User, Link2, Bell, CreditCard, MessageCircle, RefreshCw, Linkedin, Mail, Pen, MousePointerClick, Upload, Palette, ShieldBan, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useWhatsAppConnection } from "@/hooks/useWhatsAppConnection";
import { useIntegration } from "@/hooks/useIntegrations";
import { WhatsAppConnectModal } from "@/components/WhatsAppConnect";
import { IntegrationConnectModal } from "@/components/IntegrationConnect";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { status: waStatus, disconnect: waDisconnect } = useWhatsAppConnection();
  const linkedin = useIntegration("linkedin");
  const email = useIntegration("email");
  const [showWaModal, setShowWaModal] = useState(false);
  const [showLinkedinModal, setShowLinkedinModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const defaultTab = searchParams.get("tab") || "profile";

  // Email settings query
  const { data: emailSettings } = useQuery({
    queryKey: ["email-settings"],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("email_settings" as any)
        .select("*")
        .eq("user_id", user.id)
        .single();
      return (data as unknown) as { email_signature: string | null; scheduling_link: string | null; scheduling_title: string | null; scheduling_duration: string | null } | null;
    },
    enabled: !!user,
  });

  const [signature, setSignature] = useState<string>("");
  const [schedulingLink, setSchedulingLink] = useState<string>("");
  const [schedulingTitle, setSchedulingTitle] = useState<string>("Agende uma conversa");
  const [schedulingDuration, setSchedulingDuration] = useState<string>("30 min");

  // Populate form when data loads
  useState(() => {
    if (emailSettings) {
      setSignature(emailSettings.email_signature || "");
      setSchedulingLink(emailSettings.scheduling_link || "");
      setSchedulingTitle(emailSettings.scheduling_title || "Agende uma conversa");
      setSchedulingDuration(emailSettings.scheduling_duration || "30 min");
    }
  });

  const saveEmailSettings = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const payload = {
        user_id: user.id,
        email_signature: signature || null,
        scheduling_link: schedulingLink || null,
        scheduling_title: schedulingTitle || "Agende uma conversa",
        scheduling_duration: schedulingDuration || "30 min",
      };
      const { error } = await supabase
        .from("email_settings" as any)
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-settings"] });
      toast({ title: "Configurações de email salvas!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie sua conta, integrações e preferências.
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Link2 className="h-4 w-4" />
            Integrações
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Pen className="h-4 w-4" />
            E-mail
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Assinatura
          </TabsTrigger>
          <TabsTrigger value="tracking" className="gap-2">
            <MousePointerClick className="h-4 w-4" />
            Tracking
          </TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile">
          <Card className="border border-border shadow-none">
            <CardHeader>
              <CardTitle className="font-display text-lg">Conta e Perfil</CardTitle>
              <CardDescription>Atualize suas informações pessoais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input placeholder="Seu nome" defaultValue="ELEV Admin" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" placeholder="email@empresa.com" defaultValue="admin@elev.io" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Input placeholder="Nome da empresa" defaultValue="ELEV" />
              </div>
              <Button size="sm">Salvar alterações</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations">
          <Card className="border border-border shadow-none">
            <CardHeader>
              <CardTitle className="font-display text-lg">Integrações</CardTitle>
              <CardDescription>Conecte suas contas para habilitar campanhas multicanal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* WhatsApp */}
              <IntegrationCard
                icon={<MessageCircle className="h-5 w-5 text-green-600" />}
                iconBg="bg-green-100"
                name="WhatsApp"
                description="Envie mensagens diretamente aos leads"
                status={waStatus}
                onConnect={() => setShowWaModal(true)}
                onReconnect={() => setShowWaModal(true)}
                onDisconnect={waDisconnect}
              />

              {/* LinkedIn */}
              <IntegrationCard
                icon={<Linkedin className="h-5 w-5 text-blue-600" />}
                iconBg="bg-blue-100"
                name="LinkedIn (Campanhas)"
                description="Envie convites, InMails e mensagens via sua conta pessoal"
                status={linkedin.status}
                onConnect={() => setShowLinkedinModal(true)}
                onReconnect={() => setShowLinkedinModal(true)}
                onDisconnect={linkedin.disconnect}
              />

              {/* Email */}
              <IntegrationCard
                icon={<Mail className="h-5 w-5 text-red-600" />}
                iconBg="bg-red-100"
                name="Email"
                description="Conecte Gmail ou Outlook para campanhas de email"
                status={email.status}
                onConnect={() => setShowEmailModal(true)}
                onReconnect={() => setShowEmailModal(true)}
                onDisconnect={email.disconnect}
              />

              <WhatsAppConnectModal open={showWaModal} onOpenChange={setShowWaModal} />
              <IntegrationConnectModal
                open={showLinkedinModal}
                onOpenChange={setShowLinkedinModal}
                provider="linkedin"
                title="Conectar LinkedIn"
                description="Conecte sua conta pessoal do LinkedIn para enviar convites, InMails e mensagens via campanhas."
                icon={<Linkedin className="h-8 w-8 text-blue-600" />}
                iconBgClass="bg-blue-100"
                buttonClass="bg-blue-600 hover:bg-blue-700 text-white"
                status={linkedin.status}
                connecting={linkedin.connecting}
                onConnect={linkedin.connect}
              />
              <IntegrationConnectModal
                open={showEmailModal}
                onOpenChange={setShowEmailModal}
                provider="email"
                title="Conectar Email"
                description="Conecte sua conta de Gmail ou Outlook para enviar campanhas de email."
                icon={<Mail className="h-8 w-8 text-red-600" />}
                iconBgClass="bg-red-100"
                buttonClass="bg-red-600 hover:bg-red-700 text-white"
                status={email.status}
                connecting={email.connecting}
                onConnect={email.connect}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email settings */}
        <TabsContent value="email">
          <div className="space-y-4">
            {/* Signature */}
            <Card className="border border-border shadow-none">
              <CardHeader>
                <CardTitle className="font-display text-lg">Assinatura de E-mail</CardTitle>
                <CardDescription>
                  Adicionada automaticamente ao final de todos os emails enviados em campanhas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <RichTextEditor
                  value={signature}
                  onChange={setSignature}
                  placeholder="Atenciosamente, Seu Nome..."
                  minHeight="120px"
                />
                <p className="text-xs text-muted-foreground">
                  Você pode usar HTML básico para formatar sua assinatura.
                </p>
              </CardContent>
            </Card>

            {/* Scheduling link */}
            <Card className="border border-border shadow-none">
              <CardHeader>
                <CardTitle className="font-display text-lg">Link de Agendamento</CardTitle>
                <CardDescription>
                  Configure o bloco de agendamento que pode ser inserido nos emails (Cal.com, Calendly, etc.).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>URL do calendário</Label>
                  <Input
                    value={schedulingLink}
                    onChange={(e) => setSchedulingLink(e.target.value)}
                    placeholder="https://cal.com/seu-nome/reuniao"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Título do bloco</Label>
                    <Input
                      value={schedulingTitle}
                      onChange={(e) => setSchedulingTitle(e.target.value)}
                      placeholder="Agende uma conversa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duração</Label>
                    <Input
                      value={schedulingDuration}
                      onChange={(e) => setSchedulingDuration(e.target.value)}
                      placeholder="30 min"
                    />
                  </div>
                </div>

                {/* Preview */}
                {schedulingLink && (
                  <div className="rounded-lg border border-border p-4 bg-muted/20">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Preview do bloco:</p>
                    <div style={{ padding: "16px", border: "1px solid #e2e8f0", borderRadius: "8px", display: "inline-block" }}>
                      <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: "14px" }}>📅 {schedulingTitle}</p>
                      <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: "13px" }}>{schedulingDuration} · Online</p>
                      <a href={schedulingLink} style={{ background: "#3b82f6", color: "#fff", padding: "8px 16px", borderRadius: "6px", textDecoration: "none", fontSize: "13px" }}>
                        Veja todos os horários disponíveis
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={() => saveEmailSettings.mutate()}
              disabled={saveEmailSettings.isPending}
              size="sm"
            >
              {saveEmailSettings.isPending ? "Salvando..." : "Salvar configurações de email"}
            </Button>

            {/* Blocklist */}
            <BlocklistCard />
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card className="border border-border shadow-none">
            <CardHeader>
              <CardTitle className="font-display text-lg">Notificações</CardTitle>
              <CardDescription>Configure como deseja receber alertas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Novos resultados de busca", desc: "Receba alertas quando novas empresas corresponderem aos seus filtros." },
                { label: "Atualizações de contatos", desc: "Notificações sobre mudanças em contatos salvos." },
                { label: "Relatórios semanais", desc: "Resumo semanal de atividades e métricas." },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription */}
        <TabsContent value="subscription">
          <Card className="border border-border shadow-none">
            <CardHeader>
              <CardTitle className="font-display text-lg">Assinatura e Limites</CardTitle>
              <CardDescription>Gerencie seu plano e limites de pesquisa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Plano Pro</p>
                    <p className="text-sm text-muted-foreground">500 buscas/mês • 10.000 contatos</p>
                  </div>
                  <Badge className="bg-primary text-primary-foreground">Ativo</Badge>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Buscas realizadas</span>
                    <span className="font-medium text-foreground">127 / 500</span>
                  </div>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">1 crédito por página retornada</p>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: "25.4%" }} />
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Enriquecimento Email</span>
                    <span className="font-medium text-foreground">—</span>
                  </div>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">1 crédito por email retornado</p>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Enriquecimento Celular</span>
                    <span className="font-medium text-foreground">—</span>
                  </div>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">8 créditos por telefone retornado</p>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Contatos exportados</span>
                  <span className="font-medium text-foreground">1,234 / 10,000</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: "12.3%" }} />
                </div>
              </div>
              <Button variant="outline" size="sm">Upgrade do plano</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tracking Page */}
        <TabsContent value="tracking">
          <div className="space-y-4">
            <TrackingPageSettings />
            <SiteTrackingScript />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

function TrackingPageSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: trackingSettings, isLoading } = useQuery({
    queryKey: ["tracking-page-settings"],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("tracking_page_settings" as any)
        .select("*")
        .eq("user_id", user.id)
        .single();
      return data as any;
    },
    enabled: !!user,
  });

  const [bgColor, setBgColor] = useState("#f8fafc");
  const [buttonText, setButtonText] = useState("Acessar conteúdo");
  const [buttonColor, setButtonColor] = useState("#3b82f6");
  const [buttonFontColor, setButtonFontColor] = useState("#ffffff");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (trackingSettings) {
      setBgColor(trackingSettings.background_color || "#f8fafc");
      setButtonText(trackingSettings.button_text || "Acessar conteúdo");
      setButtonColor(trackingSettings.button_color || "#3b82f6");
      setButtonFontColor(trackingSettings.button_font_color || "#ffffff");
      setRedirectUrl(trackingSettings.redirect_url || "");
      setLogoUrl(trackingSettings.logo_url || null);
    }
  }, [trackingSettings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const path = `${user.id}/logo-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("tracking-logos").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Erro ao enviar logo", description: error.message, variant: "destructive" });
    } else {
      const { data: urlData } = supabase.storage.from("tracking-logos").getPublicUrl(path);
      setLogoUrl(urlData.publicUrl);
      toast({ title: "Logo enviada!" });
    }
    setUploading(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const payload = {
        user_id: user.id,
        background_color: bgColor,
        button_text: buttonText,
        button_color: buttonColor,
        button_font_color: buttonFontColor,
        redirect_url: redirectUrl || null,
        logo_url: logoUrl,
      };
      const { error } = await supabase
        .from("tracking_page_settings" as any)
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracking-page-settings"] });
      toast({ title: "Configurações de tracking salvas!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card className="border border-border shadow-none">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Página de Tracking de Email
          </CardTitle>
          <CardDescription>
            Configure a aparência da página intermediária exibida quando o lead clica no botão do email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Logo upload */}
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-12 w-auto rounded border border-border object-contain" />
              ) : (
                <div className="flex h-12 w-20 items-center justify-center rounded border border-dashed border-border">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                  className="text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG ou WEBP. Recomendado: 200×60px.</p>
              </div>
            </div>
          </div>

          {/* Colors */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Cor de fundo</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-9 w-10 rounded border border-border cursor-pointer" />
                <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor do botão</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="h-9 w-10 rounded border border-border cursor-pointer" />
                <Input value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor da fonte do botão</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={buttonFontColor} onChange={(e) => setButtonFontColor(e.target.value)} className="h-9 w-10 rounded border border-border cursor-pointer" />
                <Input value={buttonFontColor} onChange={(e) => setButtonFontColor(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
          </div>

          {/* Button text */}
          <div className="space-y-2">
            <Label>Texto do botão</Label>
            <Input value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="Acessar conteúdo" />
          </div>

          {/* Redirect URL */}
          <div className="space-y-2">
            <Label>URL de redirecionamento final</Label>
            <Input value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} placeholder="https://seusite.com.br" />
            <p className="text-xs text-muted-foreground">O lead será redirecionado para esta URL após clicar no botão.</p>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-center p-8" style={{ backgroundColor: bgColor, minHeight: 160 }}>
                <div className="flex flex-col items-center gap-4">
                  {logoUrl && <img src={logoUrl} alt="Preview logo" className="max-h-16 w-auto object-contain" />}
                  <button
                    className="rounded-lg px-6 py-3 font-semibold shadow-md"
                    style={{ backgroundColor: buttonColor, color: buttonFontColor }}
                    disabled
                  >
                    {buttonText}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        size="sm"
      >
        {saveMutation.isPending ? "Salvando..." : "Salvar configurações de tracking"}
      </Button>
    </div>
  );
}

function SiteTrackingScript() {
  const [copied, setCopied] = useState(false);
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "rwagvawmceempafacnfh";
  const trackingEndpoint = `https://${projectId}.supabase.co/functions/v1/track-event`;

  const script = `<!-- ELEV Site Tracking -->
<script>
(function() {
  var ENDPOINT = "${trackingEndpoint}";
  var params = new URLSearchParams(window.location.search);
  var contactId = params.get("contact_id");
  if (!contactId) return;

  function send(eventType, meta) {
    var payload = { contact_id: contactId, event_type: eventType, metadata: meta || {} };
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, JSON.stringify(payload));
    } else {
      fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true });
    }
  }

  // Page visit
  send("page_visit", { url: location.href, page_title: document.title, referrer: document.referrer });

  // Scroll depth
  var maxScroll = 0;
  var reported = {};
  window.addEventListener("scroll", function() {
    var pct = Math.round((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100);
    if (pct > maxScroll) maxScroll = pct;
    [25,50,75,100].forEach(function(t) {
      if (maxScroll >= t && !reported[t]) {
        reported[t] = true;
        send("scroll_depth", { scroll_percent: t, url: location.href });
      }
    });
  });

  // CTA clicks
  document.addEventListener("click", function(e) {
    var el = e.target.closest("[data-track-cta]");
    if (el) {
      send("cta_click", { cta_id: el.getAttribute("data-track-cta"), cta_text: (el.textContent || "").trim().substring(0, 100), url: location.href });
    }
  });
})();
</script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border border-border shadow-none">
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <MousePointerClick className="h-5 w-5" />
          Script de Tracking do Site
        </CardTitle>
        <CardDescription>
          Cole este script no seu site para rastrear visitas, scroll e cliques em CTAs dos leads que chegam via campanhas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <pre className="rounded-lg bg-muted/50 border border-border p-4 text-xs font-mono overflow-x-auto max-h-64 whitespace-pre-wrap">
            {script}
          </pre>
          <Button
            variant="outline"
            size="sm"
            className="absolute top-2 right-2"
            onClick={handleCopy}
          >
            {copied ? "Copiado!" : "Copiar"}
          </Button>
        </div>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p><strong>Como funciona:</strong></p>
          <ul className="list-disc pl-4 space-y-1">
            <li>O script detecta o parâmetro <code className="bg-muted px-1 rounded">contact_id</code> na URL (injetado automaticamente pelo sistema de campanhas)</li>
            <li>Registra <strong>page_visit</strong> ao carregar a página</li>
            <li>Registra <strong>scroll_depth</strong> em 25%, 50%, 75% e 100%</li>
            <li>Registra <strong>cta_click</strong> ao clicar em elementos com <code className="bg-muted px-1 rounded">data-track-cta="nome"</code></li>
          </ul>
          <p className="mt-2"><strong>Exemplo de CTA:</strong></p>
          <code className="block bg-muted px-2 py-1 rounded">&lt;button data-track-cta="hero-demo"&gt;Agendar Demo&lt;/button&gt;</code>
        </div>
      </CardContent>
    </Card>
  );
}

function BlocklistCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: blocklist, isLoading } = useQuery({
    queryKey: ["email-blocklist"],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("email_blocklist" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("blocked_at", { ascending: false });
      return (data as unknown as { id: string; email: string; reason: string; bounce_count: number; blocked_at: string }[]) || [];
    },
    enabled: !!user,
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_blocklist" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-blocklist"] });
      toast({ title: "Email desbloqueado" });
    },
  });

  return (
    <Card className="border border-border shadow-none">
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <ShieldBan className="h-5 w-5 text-destructive" />
          Blocklist de E-mails
        </CardTitle>
        <CardDescription>
          Emails bloqueados automaticamente após 3+ falhas de entrega (bounces). Clique no ícone para desbloquear.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : !blocklist || blocklist.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum email bloqueado. 🎉</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {blocklist.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs truncate">{item.email}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {item.bounce_count} bounce{item.bounce_count > 1 ? "s" : ""}
                  </Badge>
                  {item.bounce_count >= 3 && (
                    <Badge variant="destructive" className="text-[10px] shrink-0">Bloqueado</Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeMutation.mutate(item.id)}
                  disabled={removeMutation.isPending}
                  title="Desbloquear"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IntegrationCard({
  icon,
  iconBg,
  name,
  description,
  status,
  onConnect,
  onReconnect,
  onDisconnect,
}: {
  icon: React.ReactNode;
  iconBg: string;
  name: string;
  description: string;
  status: string;
  onConnect: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
}) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    connected: { label: "Conectado", className: "border-green-300 text-green-700" },
    pending: { label: "Pendente", className: "border-amber-300 text-amber-700" },
    expired: { label: "Expirado", className: "border-red-300 text-red-700" },
    disconnected: { label: "Desconectado", className: "border-muted text-muted-foreground" },
  };

  const cfg = statusConfig[status] || statusConfig.disconnected;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {status === "connected" ? (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
          <Button variant="ghost" size="sm" onClick={onReconnect}
            className="gap-1 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            Reconectar
          </Button>
          <Button variant="ghost" size="sm" onClick={onDisconnect} className="text-xs text-muted-foreground">
            Desconectar
          </Button>
        </div>
      ) : status === "pending" ? (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
          <Button variant="outline" size="sm" onClick={onConnect}>
            Continuar conexão
          </Button>
        </div>
      ) : status === "expired" ? (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
          <Button variant="outline" size="sm" onClick={onReconnect}>
            Reconectar
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={onConnect}>
          Conectar
        </Button>
      )}
    </div>
  );
}

export default Settings;
