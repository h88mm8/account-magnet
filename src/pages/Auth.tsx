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

/* ── ELEV SALES palette — azul primário #1E3A8A / ação #1D4ED8 ── */
const C = {
  bg: "#07091A",           // quase-preto azulado
  surface: "#0D1226",      // card dark
  surfaceAlt: "#111830",   // tabs/input bg
  border: "#1A2340",       // bordas sutis
  borderLight: "#243058",  // bordas levemente visíveis
  text: "#F0F7FF",         // off-white azulado
  textMuted: "#8A9CC2",    // azul acinzentado
  textDim: "#4A5A7A",      // texto muito apagado
  accent: "#3B82F6",       // azul ação
  accentDim: "rgba(59,130,246,0.12)",
  accentBorder: "rgba(59,130,246,0.3)",
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
    { icon: Search, num: "01", title: "Busca", desc: "Encontre leads por cargo, setor, localização e porte — tudo com filtros precisos." },
    { icon: Users, num: "02", title: "Enriquecimento", desc: "Email, telefone e LinkedIn enriquecidos automaticamente. Sem planilha, sem copiar e colar." },
    { icon: Send, num: "03", title: "Campanhas", desc: "Email, LinkedIn e WhatsApp no mesmo fluxo. Uma campanha, três canais, zero troca de tela." },
    { icon: Building2, num: "04", title: "Pay-as-you-go", desc: "Sem assinatura mensal. Compra créditos, usa quando quiser. Nunca expiram." },
  ];

  /* ── Shared styles ── */
  const sectionBorder = { borderTop: `1px solid ${C.border}` };
  const inputClass = `rounded-none pl-9 border-[${C.border}] focus:border-[${C.accent}] focus:ring-0`;

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text, fontFamily: "'Inter', sans-serif" }}>
      {/* ═══ Header ═══ */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-10"
        style={{ background: "rgba(11,11,15,0.85)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}` }}
      >
        <span
          className="text-base font-black uppercase tracking-[0.15em]"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.accent }}
        >
          ELEV<span style={{ color: C.accent }}>.</span>SALES
        </span>
        <nav className="hidden md:flex items-center gap-8">
          {[
            { label: "Fluxo", ref: flowRef },
            { label: "Acesso", ref: loginRef },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => scrollTo(item.ref)}
              className="text-xs font-medium uppercase tracking-[0.2em] transition-colors hover:text-[#3B82F6]"
              style={{ color: C.textMuted }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button
          onClick={() => scrollTo(loginRef)}
          className="px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors hover:bg-[#3B82F6] hover:text-[#07091A]"
          style={{ border: `1px solid ${C.accent}`, color: C.accent }}
        >
          Criar conta grátis
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
            ELEV SALES
          </p>
          <h1
            className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.text }}
          >
            O único sistema que busca, enriquece e prospecta pelo mesmo lugar.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: C.textMuted }}>
            Email, LinkedIn e WhatsApp num único fluxo. Sem assinatura mensal. Sem crédito que expira.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => scrollTo(loginRef)}
              className="px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] transition-all hover:brightness-110"
              style={{ background: C.accent, color: "#0B0B0F" }}
            >
              Começar agora — grátis
            </button>
            <button
              onClick={() => scrollTo(flowRef)}
              className="group flex items-center gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] transition-colors"
              style={{ color: C.textMuted, border: `1px solid ${C.borderLight}` }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.borderLight; e.currentTarget.style.color = C.textMuted; }}
            >
              Ver como funciona <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      {/* ═══ Problema ═══ */}
      <section className="px-4 py-28" style={sectionBorder}>
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.35em]" style={{ color: C.accent }}>01 — O Problema</p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Seu time usa 5 ferramentas pra fechar uma reunião.
          </h2>
          <p className="mt-8 text-base leading-[1.8]" style={{ color: C.textMuted }}>
            Uma para buscar leads. Outra para enriquecer. Outra para email. Outra para LinkedIn. E o WhatsApp ainda é manual, fora de qualquer fluxo. Cada uma cobra mensalidade — mesmo nos meses que você não prospecta.
          </p>
          <p className="mt-5 text-base font-medium" style={{ color: C.text }}>A ELEV SALES unifica tudo isso num só lugar. Você paga só os créditos que usar.</p>
        </div>
      </section>

      {/* ═══ Como funciona ═══ */}
      <section ref={flowRef} className="px-4 py-28" style={sectionBorder}>
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-[0.35em]" style={{ color: C.accent }}>02 — Como funciona</p>
          <h2 className="mb-16 text-center text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Como funciona
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
            {["Buscar", "Enriquecer", "Campanhas", "Resultado"].map((label, i) => (
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
            <h3 className="mb-5 text-lg font-bold" style={{ color: C.text }}>Stack fragmentado</h3>
             <ul className="space-y-3 text-sm leading-relaxed" style={{ color: C.textDim }}>
              <li>4–6 ferramentas separadas para prospectar.</li>
              <li>Assinatura mensal em cada uma — parado ou não.</li>
              <li>WhatsApp manual fora de qualquer processo.</li>
            </ul>
          </div>
          <div className="hidden md:block" style={{ background: C.border }} />
          <div className="p-8 md:p-10">
            <h3 className="mb-5 text-lg font-bold" style={{ color: C.accent }}>ELEV SALES</h3>
            <ul className="space-y-3 text-sm leading-relaxed" style={{ color: C.textMuted }}>
              <li>Busca, enriquecimento e campanhas num lugar só.</li>
              <li>Email, LinkedIn e WhatsApp no mesmo fluxo.</li>
              <li>Sem assinatura. Pague só os créditos que usar.</li>
              <li>Créditos que não expiram nunca.</li>
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-16 max-w-lg text-center text-xl font-semibold leading-relaxed" style={{ color: C.text }}>
          Do lead cru à mensagem enviada.<br />
          <span style={{ color: C.accent, borderBottom: `1px solid ${C.accentBorder}`, paddingBottom: "3px" }}>
            Sem sair da plataforma.
          </span>
        </p>
      </section>

      {/* ═══ Privacidade ═══ */}
      <section className="px-4 py-28" style={sectionBorder}>
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-5 flex h-10 w-10 items-center justify-center" style={{ background: C.accentDim, border: `1px solid ${C.accentBorder}` }}>
            <Shield className="h-5 w-5" style={{ color: C.accent }} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Privacidade & LGPD</h2>
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
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.text }}>
            Do lead à resposta.<br />Tudo pelo mesmo lugar.
          </h2>

          <div className="mt-10 p-8" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <h3 className="text-base font-bold tracking-wide" style={{ color: C.text }}>ELEV SALES</h3>
            <p className="text-[10px] mt-1.5 uppercase tracking-[0.3em]" style={{ color: C.textDim }}>Criar conta — 50 créditos grátis</p>

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
          © 2026 ELEV SALES. Todos os direitos reservados.
        </p>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: C.textDim }}>
          busca · enriquece · prospecta
        </p>
      </footer>
    </div>
  );
}
