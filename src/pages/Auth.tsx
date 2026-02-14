import { useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import { Search, Mail, Lock, User, Building2, Users, Send, Bell, ArrowRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function Auth() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loginRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#0B0B0B" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#1B1B1B] border-t-primary" />
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
    if (error) {
      toast({ title: "Erro no login", description: error.message, variant: "destructive" });
    }
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
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    if (error) {
      toast({ title: "Erro no cadastro", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Cadastro realizado!",
        description: "Verifique seu e-mail para confirmar a conta.",
      });
    }
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

  return (
    <div className="min-h-screen" style={{ background: "#0B0B0B", color: "#F2F0EB" }}>
      {/* Hero */}
      <section
        className="relative flex min-h-[90vh] flex-col items-center justify-center px-4 text-center overflow-hidden"
      >
        {/* Subtle structural grid texture */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="relative z-10">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-none border border-primary/40 bg-primary/10">
            <Search className="h-6 w-6 text-primary" />
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "#666" }}>ELEV Discover</p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Prospecção B2B organizada em um único lugar.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: "#999" }}>
            Encontre decisores, organize listas e execute campanhas por WhatsApp, LinkedIn e Email — com alertas em tempo real quando o lead demonstra interesse.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => scrollTo(loginRef)}
              className="rounded-none px-8 font-semibold uppercase tracking-wider text-sm"
            >
              Solicitar demonstração
            </Button>
            <button
              onClick={() => scrollTo(flowRef)}
              className="group flex items-center gap-2 text-sm font-medium uppercase tracking-wider transition-colors hover:text-primary"
              style={{ color: "#999" }}
            >
              Ver o fluxo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      {/* Problema */}
      <section className="px-4 py-24" style={{ borderTop: "1px solid #1B1B1B" }}>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Estrutura vence improviso.</h2>
          <p className="mt-8 leading-relaxed" style={{ color: "#888" }}>
            Hoje a prospecção é fragmentada. Você busca em um lugar, dispara em outro e não sabe quando o lead realmente está interessado. Isso gera abordagem fora de hora.
          </p>
          <p className="mt-4 font-medium" style={{ color: "#F2F0EB" }}>ELEV Discover organiza tudo em um único fluxo.</p>
        </div>
      </section>

      {/* O Fluxo */}
      <section ref={flowRef} className="px-4 py-24" style={{ borderTop: "1px solid #1B1B1B" }}>
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-16 text-center text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>O Fluxo</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {steps.map((s) => (
              <div
                key={s.num}
                className="p-6"
                style={{
                  background: "#121212",
                  border: "1px solid #222",
                }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-xs font-bold tracking-wider text-primary">{s.num}</span>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "#666" }}>— {s.title}</span>
                </div>
                <div className="mb-3 flex h-9 w-9 items-center justify-center" style={{ background: "#1B1B1B", border: "1px solid #2a2a2a" }}>
                  <s.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#888" }}>{s.desc}</p>
              </div>
            ))}
          </div>
          {/* Timeline strip */}
          <div className="mt-12 flex items-center justify-center gap-3 text-xs font-medium" style={{ color: "#555" }}>
            {["Encontrar", "Organizar", "Executar", "Agir"].map((label, i) => (
              <span key={label} className="flex items-center gap-3">
                <span
                  className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary"
                  style={{ background: "#121212", border: "1px solid #222" }}
                >
                  {label}
                </span>
                {i < 3 && <ArrowRight className="h-3 w-3" style={{ color: "#333" }} />}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Comparativo */}
      <section className="px-4 py-24" style={{ borderTop: "1px solid #1B1B1B" }}>
        <div className="mx-auto max-w-4xl md:grid md:grid-cols-[1fr_1px_1fr] md:gap-0">
          {/* Ferramentas separadas */}
          <div className="p-8">
            <h3 className="mb-4 text-lg font-bold" style={{ color: "#F2F0EB" }}>Ferramentas separadas</h3>
            <ul className="space-y-3 text-sm" style={{ color: "#666" }}>
              <li>CRM organiza pipeline.</li>
              <li>Ferramentas de email apenas disparam.</li>
              <li>Extensões apenas buscam contatos.</li>
            </ul>
          </div>
          {/* Vertical divider */}
          <div className="hidden md:block" style={{ background: "#222" }} />
          {/* ELEV Discover */}
          <div className="p-8" style={{ borderLeft: "none" }}>
            <h3 className="mb-4 text-lg font-bold text-primary">ELEV Discover</h3>
            <ul className="space-y-3 text-sm" style={{ color: "#999" }}>
              <li>Fluxo único.</li>
              <li>Execução multicanal integrada.</li>
              <li>Alertas em tempo real.</li>
              <li>Abordagem no momento certo.</li>
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-14 max-w-lg text-center text-lg font-medium leading-relaxed" style={{ color: "#F2F0EB" }}>
          O valor não é disparar mais.<br />
          <span className="text-primary" style={{ borderBottom: "1px solid hsl(var(--primary) / 0.4)", paddingBottom: "2px" }}>
            É abordar quando existe intenção.
          </span>
        </p>
      </section>

      {/* Privacidade */}
      <section className="px-4 py-24" style={{ borderTop: "1px solid #1B1B1B" }}>
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center" style={{ background: "#121212", border: "1px solid #222" }}>
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Privacidade & LGPD</h2>
          <ul className="mt-8 space-y-3 text-sm text-left max-w-lg mx-auto" style={{ color: "#888" }}>
            <li>• Uso de fontes públicas com base legal de legítimo interesse.</li>
            <li>• WhatsApp não importa histórico anterior; apenas ações feitas na plataforma são rastreadas.</li>
            <li>• Autonomia para conectar e reconectar contas sem suporte técnico.</li>
          </ul>
        </div>
      </section>

      {/* Final CTA + Login */}
      <section ref={loginRef} className="px-4 py-24" style={{ borderTop: "1px solid #1B1B1B", background: "#0A0A0A" }}>
        <div className="mx-auto max-w-md text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#F2F0EB" }}>
            Mais organização. Mais controle.<br />Mais conversas no timing certo.
          </h2>

          <div className="mt-10 p-6" style={{ background: "#121212", border: "1px solid #222" }}>
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold" style={{ color: "#F2F0EB" }}>ELEV Discover</h3>
              <p className="text-xs mt-1 uppercase tracking-wider" style={{ color: "#666" }}>Agendar demonstração</p>
            </div>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2 rounded-none" style={{ background: "#1B1B1B" }}>
                <TabsTrigger value="login" className="rounded-none text-xs uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Entrar</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-none text-xs uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Cadastrar</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-4">
                  <div className="space-y-2 text-left">
                    <Label htmlFor="login-email" className="text-xs uppercase tracking-wider" style={{ color: "#888" }}>E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "#555" }} />
                      <Input id="login-email" name="email" type="email" required placeholder="seu@email.com" className="rounded-none pl-9 border-[#222] bg-[#0B0B0B] text-[#F2F0EB] placeholder:text-[#444]" />
                    </div>
                  </div>
                  <div className="space-y-2 text-left">
                    <Label htmlFor="login-password" className="text-xs uppercase tracking-wider" style={{ color: "#888" }}>Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "#555" }} />
                      <Input id="login-password" name="password" type="password" required placeholder="••••••••" className="rounded-none pl-9 border-[#222] bg-[#0B0B0B] text-[#F2F0EB] placeholder:text-[#444]" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full rounded-none font-semibold uppercase tracking-wider text-xs" disabled={isSubmitting}>
                    {isSubmitting ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 pt-4">
                  <div className="space-y-2 text-left">
                    <Label htmlFor="signup-name" className="text-xs uppercase tracking-wider" style={{ color: "#888" }}>Nome completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "#555" }} />
                      <Input id="signup-name" name="fullName" required placeholder="Seu nome" className="rounded-none pl-9 border-[#222] bg-[#0B0B0B] text-[#F2F0EB] placeholder:text-[#444]" />
                    </div>
                  </div>
                  <div className="space-y-2 text-left">
                    <Label htmlFor="signup-email" className="text-xs uppercase tracking-wider" style={{ color: "#888" }}>E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "#555" }} />
                      <Input id="signup-email" name="email" type="email" required placeholder="seu@email.com" className="rounded-none pl-9 border-[#222] bg-[#0B0B0B] text-[#F2F0EB] placeholder:text-[#444]" />
                    </div>
                  </div>
                  <div className="space-y-2 text-left">
                    <Label htmlFor="signup-password" className="text-xs uppercase tracking-wider" style={{ color: "#888" }}>Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "#555" }} />
                      <Input id="signup-password" name="password" type="password" required minLength={6} placeholder="Mínimo 6 caracteres" className="rounded-none pl-9 border-[#222] bg-[#0B0B0B] text-[#F2F0EB] placeholder:text-[#444]" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full rounded-none font-semibold uppercase tracking-wider text-xs" disabled={isSubmitting}>
                    {isSubmitting ? "Cadastrando..." : "Cadastrar"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>

          <p className="mt-8 text-xs" style={{ color: "#555" }}>contato@elevsales.com.br</p>
        </div>
      </section>
    </div>
  );
}
