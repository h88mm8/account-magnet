import { useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import { Search, Mail, Lock, User, Building2, Users, Send, Bell, ArrowRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/* ── Autonomy-inspired palette ── */
const C = {
  bg: "#0B0B0F",
  surface: "#111116",
  surfaceAlt: "#161619",
  border: "#1E1E24",
  borderLight: "#2A2A32",
  text: "#E8E6E1",
  textMuted: "#8A8A96",
  textDim: "#555560",
  accent: "#2DD4BF", // teal/cyan from Autonomy
  accentDim: "rgba(45,212,191,0.12)",
  accentBorder: "rgba(45,212,191,0.3)",
};

export default function Auth() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loginRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: C.bg }}>
        <div className="h-8 w-8 animate-spin rounded-full border-[3px]" style={{ borderColor: C.border, borderTopColor: C.accent }} />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast({ title: "Erro no login", description: error.message, variant: "destructive" });
    setIsSubmitting(false);
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const fullName = form.get("fullName") as string;
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
    });
    if (error) toast({ title: "Erro no cadastro", description: error.message, variant: "destructive" });
    else toast({ title: "Cadastro realizado!", description: "Verifique seu e-mail para confirmar a conta." });
    setIsSubmitting(false);
  };

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

  const steps = [
    { icon: Building2, num: "01", title: "Busca", desc: "Empresas e contatos com filtros por cargo, setor, localização e porte." },
    { icon: Users, num: "02", title: "Organização", desc: "Listas segmentadas por ICP, região, campanha ou critérios internos." },
    { icon: Send, num: "03", title: "Campanhas", desc: "WhatsApp, LinkedIn e Email executados a partir das listas." },
    { icon: Bell, num: "04", title: "Monitoramento", desc: "Alertas em tempo real quando o lead acessa e interage com sua página." },
  ];

  /* ── Shared styles ── */
  const sectionBorder = { borderTop: `1px solid ${C.border}` };
  const inputClass = `rounded-none pl-9 border-[${C.border}] focus:border-[${C.accent}] focus:ring-0`;

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif" }}>
      {/* ═══ Header ═══ */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-10"
        style={{ background: "rgba(11,11,15,0.85)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}` }}
      >
        <span
          className="text-base font-black uppercase tracking-[0.15em]"
          style={{ fontFamily: "'Plus Jakarta Sans', monospace", color: C.accent }}
        >
          ELEV<span style={{ color: C.text }}>_</span>
        </span>
        <nav className="hidden md:flex items-center gap-8">
          {[
            { label: "Fluxo", ref: flowRef },
            { label: "Acesso", ref: loginRef },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => scrollTo(item.ref)}
              className="text-xs font-medium uppercase tracking-[0.2em] transition-colors hover:text-[#2DD4BF]"
              style={{ color: C.textMuted }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button
          onClick={() => scrollTo(loginRef)}
          className="px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors hover:bg-[#2DD4BF] hover:text-[#0B0B0F]"
          style={{ border: `1px solid ${C.accent}`, color: C.accent }}
        >
          Falar com a ELEV
        </button>
      </header>

      {/* ═══ Hero ═══ */}
      <section className="relative flex min-h-[92vh] flex-col items-center justify-center px-4 pt-16 text-center overflow-hidden">
        {/* Network-node texture (like Autonomy hero) */}
        <div className="pointer-events-none absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, ${C.accentDim} 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, ${C.accentDim} 0%, transparent 50%)`,
        }} />
        <div className="pointer-events-none absolute inset-0" style={{
          backgroundImage:
            `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }} />

        <div className="relative z-10">
          <p
            className="mb-6 inline-block px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.35em]"
            style={{ color: C.textMuted, border: `1px solid ${C.borderLight}` }}
          >
            ELEV Discover
          </p>
          <h1
            className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: C.text }}
          >
            Prospecção B2B organizada em um único lugar.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: C.textMuted }}>
            Encontre decisores, organize listas e execute campanhas por WhatsApp, LinkedIn e Email — com alertas em tempo real quando o lead demonstra interesse.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => scrollTo(loginRef)}
              className="px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] transition-all hover:brightness-110"
              style={{ background: C.accent, color: "#0B0B0F" }}
            >
              Solicitar demonstração
            </button>
            <button
              onClick={() => scrollTo(flowRef)}
              className="group flex items-center gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] transition-colors"
              style={{ color: C.textMuted, border: `1px solid ${C.borderLight}` }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.borderLight; e.currentTarget.style.color = C.textMuted; }}
            >
              Conhecer o fluxo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      {/* ═══ Problema ═══ */}
      <section className="px-4 py-28" style={sectionBorder}>
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.35em]" style={{ color: C.accent }}>01 — Tese</p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Estrutura vence improviso.
          </h2>
          <p className="mt-8 text-base leading-[1.8]" style={{ color: C.textMuted }}>
            Hoje a prospecção é fragmentada. Você busca em um lugar, dispara em outro e não sabe quando o lead realmente está interessado. Isso gera abordagem fora de hora.
          </p>
          <p className="mt-5 text-base font-medium" style={{ color: C.text }}>ELEV Discover organiza tudo em um único fluxo.</p>
        </div>
      </section>

      {/* ═══ O Fluxo ═══ */}
      <section ref={flowRef} className="px-4 py-28" style={sectionBorder}>
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-[0.35em]" style={{ color: C.accent }}>02 — Arquitetura</p>
          <h2 className="mb-16 text-center text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            O Fluxo
          </h2>
          <div className="grid gap-px sm:grid-cols-2" style={{ background: C.border }}>
            {steps.map((s) => (
              <div key={s.num} className="p-8" style={{ background: C.surface }}>
                <span className="text-xs font-bold tracking-wider" style={{ color: C.accent }}>{s.num}</span>
                <h3 className="mt-3 text-sm font-bold uppercase tracking-[0.15em]" style={{ color: C.text }}>{s.title}</h3>
                <div className="my-4 flex h-10 w-10 items-center justify-center" style={{ background: C.accentDim, border: `1px solid ${C.accentBorder}` }}>
                  <s.icon className="h-4 w-4" style={{ color: C.accent }} />
                </div>
                <p className="text-sm leading-relaxed" style={{ color: C.textMuted }}>{s.desc}</p>
              </div>
            ))}
          </div>
          {/* Timeline strip */}
          <div className="mt-12 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: C.textDim }}>
            {["Encontrar", "Organizar", "Executar", "Agir"].map((label, i) => (
              <span key={label} className="flex items-center gap-2">
                <span className="px-3 py-1.5" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.accent }}>
                  {label}
                </span>
                {i < 3 && <ArrowRight className="h-3 w-3" style={{ color: C.borderLight }} />}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Comparativo ═══ */}
      <section className="px-4 py-28" style={sectionBorder}>
        <div className="mx-auto max-w-4xl md:grid md:grid-cols-[1fr_1px_1fr] md:gap-0">
          <div className="p-8 md:p-10">
            <h3 className="mb-5 text-lg font-bold" style={{ color: C.text }}>Ferramentas separadas</h3>
            <ul className="space-y-3 text-sm leading-relaxed" style={{ color: C.textDim }}>
              <li>CRM organiza pipeline.</li>
              <li>Ferramentas de email apenas disparam.</li>
              <li>Extensões apenas buscam contatos.</li>
            </ul>
          </div>
          <div className="hidden md:block" style={{ background: C.border }} />
          <div className="p-8 md:p-10">
            <h3 className="mb-5 text-lg font-bold" style={{ color: C.accent }}>ELEV Discover</h3>
            <ul className="space-y-3 text-sm leading-relaxed" style={{ color: C.textMuted }}>
              <li>Fluxo único.</li>
              <li>Execução multicanal integrada.</li>
              <li>Alertas em tempo real.</li>
              <li>Abordagem no momento certo.</li>
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-16 max-w-lg text-center text-xl font-semibold leading-relaxed" style={{ color: C.text }}>
          O valor não é disparar mais.<br />
          <span style={{ color: C.accent, borderBottom: `1px solid ${C.accentBorder}`, paddingBottom: "3px" }}>
            É abordar quando existe intenção.
          </span>
        </p>
      </section>

      {/* ═══ Privacidade ═══ */}
      <section className="px-4 py-28" style={sectionBorder}>
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-5 flex h-10 w-10 items-center justify-center" style={{ background: C.accentDim, border: `1px solid ${C.accentBorder}` }}>
            <Shield className="h-5 w-5" style={{ color: C.accent }} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Privacidade & LGPD</h2>
          <ul className="mt-8 space-y-4 text-sm text-left max-w-lg mx-auto leading-relaxed" style={{ color: C.textMuted }}>
            <li>• Uso de fontes públicas com base legal de legítimo interesse.</li>
            <li>• WhatsApp não importa histórico anterior; apenas ações feitas na plataforma são rastreadas.</li>
            <li>• Autonomia para conectar e reconectar contas sem suporte técnico.</li>
          </ul>
        </div>
      </section>

      {/* ═══ Final CTA + Login ═══ */}
      <section ref={loginRef} className="px-4 py-28" style={{ ...sectionBorder, background: "#08080C" }}>
        <div className="mx-auto max-w-md text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: C.text }}>
            Mais organização. Mais controle.<br />Mais conversas no timing certo.
          </h2>

          <div className="mt-10 p-8" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <h3 className="text-base font-bold tracking-wide" style={{ color: C.text }}>ELEV Discover</h3>
            <p className="text-[10px] mt-1.5 uppercase tracking-[0.3em]" style={{ color: C.textDim }}>Agendar demonstração</p>

            <Tabs defaultValue="login" className="mt-6">
              <TabsList className="grid w-full grid-cols-2 rounded-none h-10" style={{ background: C.surfaceAlt }}>
                <TabsTrigger
                  value="login"
                  className="rounded-none text-[10px] uppercase tracking-[0.2em] font-bold transition-all data-[state=active]:text-[#0B0B0F]"
                  style={{ "--tw-data-active-bg": C.accent } as React.CSSProperties}
                  data-accent={C.accent}
                >Entrar</TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="rounded-none text-[10px] uppercase tracking-[0.2em] font-bold transition-all data-[state=active]:text-[#0B0B0F]"
                >Cadastrar</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-5">
                  <div className="space-y-2 text-left">
                    <Label htmlFor="login-email" className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: C.textDim }}>E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.textDim }} />
                      <input id="login-email" name="email" type="email" required placeholder="seu@email.com"
                        className="w-full py-2.5 pl-9 pr-3 text-sm outline-none transition-colors"
                        style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
                        onFocus={(e) => e.currentTarget.style.borderColor = C.accent}
                        onBlur={(e) => e.currentTarget.style.borderColor = C.border}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 text-left">
                    <Label htmlFor="login-password" className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: C.textDim }}>Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.textDim }} />
                      <input id="login-password" name="password" type="password" required placeholder="••••••••"
                        className="w-full py-2.5 pl-9 pr-3 text-sm outline-none transition-colors"
                        style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
                        onFocus={(e) => e.currentTarget.style.borderColor = C.accent}
                        onBlur={(e) => e.currentTarget.style.borderColor = C.border}
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmitting}
                    className="w-full py-3 text-xs font-bold uppercase tracking-[0.2em] transition-all hover:brightness-110 disabled:opacity-50"
                    style={{ background: C.accent, color: "#0B0B0F" }}
                  >
                    {isSubmitting ? "Entrando..." : "Entrar"}
                  </button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 pt-5">
                  <div className="space-y-2 text-left">
                    <Label htmlFor="signup-name" className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: C.textDim }}>Nome completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.textDim }} />
                      <input id="signup-name" name="fullName" required placeholder="Seu nome"
                        className="w-full py-2.5 pl-9 pr-3 text-sm outline-none transition-colors"
                        style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
                        onFocus={(e) => e.currentTarget.style.borderColor = C.accent}
                        onBlur={(e) => e.currentTarget.style.borderColor = C.border}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 text-left">
                    <Label htmlFor="signup-email" className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: C.textDim }}>E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.textDim }} />
                      <input id="signup-email" name="email" type="email" required placeholder="seu@email.com"
                        className="w-full py-2.5 pl-9 pr-3 text-sm outline-none transition-colors"
                        style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
                        onFocus={(e) => e.currentTarget.style.borderColor = C.accent}
                        onBlur={(e) => e.currentTarget.style.borderColor = C.border}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 text-left">
                    <Label htmlFor="signup-password" className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: C.textDim }}>Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.textDim }} />
                      <input id="signup-password" name="password" type="password" required minLength={6} placeholder="Mínimo 6 caracteres"
                        className="w-full py-2.5 pl-9 pr-3 text-sm outline-none transition-colors"
                        style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
                        onFocus={(e) => e.currentTarget.style.borderColor = C.accent}
                        onBlur={(e) => e.currentTarget.style.borderColor = C.border}
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmitting}
                    className="w-full py-3 text-xs font-bold uppercase tracking-[0.2em] transition-all hover:brightness-110 disabled:opacity-50"
                    style={{ background: C.accent, color: "#0B0B0F" }}
                  >
                    {isSubmitting ? "Cadastrando..." : "Cadastrar"}
                  </button>
                </form>
              </TabsContent>
            </Tabs>
          </div>

          <p className="mt-8 text-xs" style={{ color: C.textDim }}>contato@elevsales.com.br</p>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer
        className="flex flex-col md:flex-row items-center justify-between px-6 py-6 md:px-10 gap-3"
        style={{ borderTop: `1px solid ${C.border}`, background: C.bg }}
      >
        <p className="text-[11px] tracking-wide" style={{ color: C.textDim, fontFamily: "monospace" }}>
          © 2025 ELEV Sales. Todos os direitos reservados.
        </p>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: C.textDim }}>
          Prospecção B2B integrada
        </p>
      </footer>
    </div>
  );
}
