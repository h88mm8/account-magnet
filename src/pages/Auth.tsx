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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="flex min-h-[85vh] flex-col items-center justify-center px-4 text-center">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Search className="h-6 w-6 text-primary-foreground" />
        </div>
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">ELEV Discover</p>
        <h1 className="mx-auto max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
          Prospecção B2B organizada em um único lugar.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
          Encontre decisores, organize listas e execute campanhas por WhatsApp, LinkedIn e Email — com alertas em tempo real quando o lead demonstra interesse.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={() => scrollTo(loginRef)}>Solicitar demonstração</Button>
          <Button size="lg" variant="outline" onClick={() => scrollTo(flowRef)}>
            Ver o fluxo <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Problema */}
      <section className="border-t border-border px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Estrutura vence improviso.</h2>
          <p className="mt-6 text-muted-foreground leading-relaxed">
            Hoje a prospecção é fragmentada. Você busca em um lugar, dispara em outro e não sabe quando o lead realmente está interessado. Isso gera abordagem fora de hora.
          </p>
          <p className="mt-4 font-medium">ELEV Discover organiza tudo em um único fluxo.</p>
        </div>
      </section>

      {/* O Fluxo */}
      <section ref={flowRef} className="border-t border-border px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-2xl font-bold sm:text-3xl">O Fluxo</h2>
          <div className="grid gap-8 sm:grid-cols-2">
            {steps.map((s) => (
              <div key={s.num} className="rounded-xl border border-border bg-card p-6">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <s.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.num} — {s.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
          {/* Timeline strip */}
          <div className="mt-10 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
            {["Encontrar", "Organizar", "Executar", "Agir"].map((label, i) => (
              <span key={label} className="flex items-center gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">{label}</span>
                {i < 3 && <ArrowRight className="h-3 w-3" />}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Comparativo */}
      <section className="border-t border-border px-4 py-20">
        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-8">
            <h3 className="mb-4 text-lg font-bold">Ferramentas separadas</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>CRM organiza pipeline.</li>
              <li>Ferramentas de email apenas disparam.</li>
              <li>Extensões apenas buscam contatos.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-primary bg-card p-8">
            <h3 className="mb-4 text-lg font-bold text-primary">ELEV Discover</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Fluxo único.</li>
              <li>Execução multicanal integrada.</li>
              <li>Alertas em tempo real.</li>
              <li>Abordagem no momento certo.</li>
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-10 max-w-lg text-center text-base font-medium italic text-muted-foreground">
          O valor não é disparar mais.<br />É abordar quando existe intenção.
        </p>
      </section>

      {/* Privacidade */}
      <section className="border-t border-border px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-2xl font-bold sm:text-3xl">Privacidade & LGPD</h2>
          <ul className="mt-6 space-y-3 text-sm text-muted-foreground text-left max-w-lg mx-auto">
            <li>• Uso de fontes públicas com base legal de legítimo interesse.</li>
            <li>• WhatsApp não importa histórico anterior; apenas ações feitas na plataforma são rastreadas.</li>
            <li>• Autonomia para conectar e reconectar contas sem suporte técnico.</li>
          </ul>
        </div>
      </section>

      {/* Final CTA + Login */}
      <section ref={loginRef} className="border-t border-border px-4 py-20">
        <div className="mx-auto max-w-md text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Mais organização. Mais controle.<br />Mais conversas no timing certo.
          </h2>

          <Card className="mt-10 border-border">
            <CardHeader className="text-center">
              <CardTitle className="font-display text-xl">ELEV Discover</CardTitle>
              <CardDescription>Agendar demonstração</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Entrar</TabsTrigger>
                  <TabsTrigger value="signup">Cadastrar</TabsTrigger>
                </TabsList>
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">E-mail</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="login-email" name="email" type="email" required placeholder="seu@email.com" className="pl-9" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="login-password" name="password" type="password" required placeholder="••••••••" className="pl-9" />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? "Entrando..." : "Entrar"}
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="signup">
                  <form onSubmit={handleSignup} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Nome completo</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="signup-name" name="fullName" required placeholder="Seu nome" className="pl-9" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">E-mail</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="signup-email" name="email" type="email" required placeholder="seu@email.com" className="pl-9" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="signup-password" name="password" type="password" required minLength={6} placeholder="Mínimo 6 caracteres" className="pl-9" />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? "Cadastrando..." : "Cadastrar"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="mt-6 text-xs text-muted-foreground">contato@elevsales.com.br</p>
        </div>
      </section>
    </div>
  );
}
