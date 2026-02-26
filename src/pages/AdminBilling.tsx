import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Save, Shield, CreditCard, Zap } from "lucide-react";

function adminInvoke(action: string, payload: Record<string, unknown> = {}) {
  return supabase.functions.invoke("admin-billing", {
    body: { action, ...payload },
  });
}

// --- Welcome Credits Section ---
function WelcomeCreditsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [leads, setLeads] = useState(50);
  const [email, setEmail] = useState(0);
  const [phone, setPhone] = useState(0);

  const { isLoading } = useQuery({
    queryKey: ["admin-welcome-config"],
    queryFn: async () => {
      const { data, error } = await adminInvoke("get_welcome_config");
      if (error) throw error;
      const cfg = (data as any)?.data;
      if (cfg) {
        setLeads(cfg.leads_credits);
        setEmail(cfg.email_credits);
        setPhone(cfg.phone_credits);
      }
      return cfg;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await adminInvoke("save_welcome_config", {
        leads_credits: leads,
        email_credits: email,
        phone_credits: phone,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Créditos de boas-vindas salvos" });
      qc.invalidateQueries({ queryKey: ["admin-welcome-config"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Créditos de Boas-Vindas
        </CardTitle>
        <CardDescription>Créditos aplicados automaticamente ao criar um novo usuário.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Créditos de Leads</Label>
            <Input type="number" min={0} value={leads} onChange={(e) => setLeads(Number(e.target.value))} disabled={isLoading} />
          </div>
          <div className="space-y-2">
            <Label>Créditos de Email</Label>
            <Input type="number" min={0} value={email} onChange={(e) => setEmail(Number(e.target.value))} disabled={isLoading} />
          </div>
          <div className="space-y-2">
            <Label>Créditos de Celular</Label>
            <Input type="number" min={0} value={phone} onChange={(e) => setPhone(Number(e.target.value))} disabled={isLoading} />
          </div>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {save.isPending ? "Salvando..." : "Salvar Créditos de Boas-Vindas"}
        </Button>
      </CardContent>
    </Card>
  );
}

// --- Products Section ---
type BillingProduct = {
  id: string;
  product_type: string;
  billing_type: string;
  stripe_product_id: string;
  stripe_price_id: string;
  unit_price: number;
  currency: string;
  active: boolean;
};

function ProductRow({ product, onRefresh }: { product: BillingProduct; onRefresh: () => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [newPrice, setNewPrice] = useState(product.unit_price);

  const updatePrice = useMutation({
    mutationFn: async () => {
      const { data, error } = await adminInvoke("update_price", { product_id: product.id, new_price: newPrice });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast({ title: "Preço atualizado com sucesso" });
      setEditing(false);
      onRefresh();
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: async () => {
      const { error } = await adminInvoke("toggle_product", { product_id: product.id, active: !product.active });
      if (error) throw error;
    },
    onSuccess: onRefresh,
  });

  const labelMap: Record<string, string> = {
    leads: "Créditos de Leads",
    phone: "Créditos de Celular",
    email: "Créditos de Email",
    linkedin_license: "Licença LinkedIn",
    whatsapp_license: "Licença WhatsApp",
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border p-4">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{labelMap[product.product_type] || product.product_type}</span>
          <Badge variant={product.active ? "default" : "secondary"}>{product.active ? "Ativo" : "Inativo"}</Badge>
          <Badge variant="outline">{product.billing_type === "subscription" ? "Mensal" : "Avulso"}</Badge>
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div>Product: {product.stripe_product_id || "—"}</div>
          <div>Price: {product.stripe_price_id || "—"}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              className="w-28"
              value={newPrice}
              onChange={(e) => setNewPrice(Number(e.target.value))}
            />
            <span className="text-xs text-muted-foreground">centavos</span>
            <Button size="sm" onClick={() => updatePrice.mutate()} disabled={updatePrice.isPending}>
              {updatePrice.isPending ? "..." : "Salvar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => { setNewPrice(product.unit_price); setEditing(true); }}>
            R$ {(product.unit_price / 100).toFixed(2)} — Editar
          </Button>
        )}

        <Switch checked={product.active} onCheckedChange={() => toggle.mutate()} />
      </div>
    </div>
  );
}

function ProductsSection({ billingType, title, description, icon }: { billingType: string; title: string; description: string; icon: React.ReactNode }) {
  const qc = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-billing-products"],
    queryFn: async () => {
      const { data, error } = await adminInvoke("get_products");
      if (error) throw error;
      return ((data as any)?.data || []) as BillingProduct[];
    },
  });

  const filtered = products.filter((p) => p.billing_type === billingType);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum produto cadastrado. Adicione produtos na tabela billing_products.</p>
        )}
        {filtered.map((p) => (
          <ProductRow key={p.id} product={p} onRefresh={() => qc.invalidateQueries({ queryKey: ["admin-billing-products"] })} />
        ))}
      </CardContent>
    </Card>
  );
}

// --- Main Page ---
export default function AdminBilling() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdminCheck();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  if (authLoading || adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) return <Navigate to="/" replace />;

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await adminInvoke("sync_stripe");
      if (error) throw error;
      const results = (data as any)?.results || [];
      toast({ title: "Sincronização concluída", description: `${results.length} produtos verificados.` });
      qc.invalidateQueries({ queryKey: ["admin-billing-products"] });
    } catch (e: any) {
      toast({ title: "Erro na sincronização", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Configurações de Billing
          </h1>
          <p className="text-sm text-muted-foreground">Controle completo de preços, créditos e licenças.</p>
        </div>
        <Button variant="outline" onClick={handleSync} disabled={syncing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar com Stripe"}
        </Button>
      </div>

      <WelcomeCreditsSection />

      <Separator />

      <ProductsSection
        billingType="one_time"
        title="Preços de Créditos (Compra Avulsa)"
        description="Pacotes de créditos de Leads, Email e Celular com pagamento único."
        icon={<CreditCard className="h-5 w-5 text-primary" />}
      />

      <Separator />

      <ProductsSection
        billingType="subscription"
        title="Licenças Mensais (Subscription)"
        description="Licenças recorrentes para LinkedIn e WhatsApp."
        icon={<RefreshCw className="h-5 w-5 text-primary" />}
      />
    </div>
  );
}
