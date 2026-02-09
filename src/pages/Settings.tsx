import { User, Link2, Bell, CreditCard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const Settings = () => {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie sua conta, integrações e preferências.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Link2 className="h-4 w-4" />
            Integrações
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Assinatura
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
              <CardDescription>Conecte ferramentas externas à sua conta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Link2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Unipile</p>
                    <p className="text-xs text-muted-foreground">API de busca LinkedIn Sales Navigator</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-primary/30 text-primary">Conectado</Badge>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Link2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">LinkedIn</p>
                    <p className="text-xs text-muted-foreground">Conta do Sales Navigator</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Conectar</Button>
              </div>
            </CardContent>
          </Card>
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
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Buscas realizadas este mês</span>
                  <span className="font-medium text-foreground">127 / 500</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: "25.4%" }} />
                </div>
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
      </Tabs>
    </div>
  );
};

export default Settings;
