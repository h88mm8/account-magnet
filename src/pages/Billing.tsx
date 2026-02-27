import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Phone, Mail, CreditCard, Loader2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

interface UnitPrice {
  credit_type: string;
  unit_price_cents: number;
}

export default function Billing() {
  const { credits } = useSubscription();
  const [phoneCredits, setPhoneCredits] = useState(100);
  const [emailCredits, setEmailCredits] = useState(1000);
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({ phone: 50, email: 10 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("credit_unit_prices")
      .select("credit_type, unit_price_cents")
      .then(({ data }) => {
        if (data) {
          const map: Record<string, number> = {};
          data.forEach((p: UnitPrice) => { map[p.credit_type] = p.unit_price_cents; });
          setUnitPrices(map);
        }
      });
  }, []);

  const phoneTotal = (phoneCredits * (unitPrices.phone || 50)) / 100;
  const emailTotal = (emailCredits * (unitPrices.email || 10)) / 100;
  const grandTotal = phoneTotal + emailTotal;

  const handleCheckout = async () => {
    if (phoneCredits <= 0 && emailCredits <= 0) {
      toast.error("Selecione pelo menos um tipo de crédito");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-dynamic-checkout", {
        body: { phone_credits: phoneCredits, email_credits: emailCredits },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar sessão de pagamento");
    } finally {
      setLoading(false);
    }
  };

  const formatBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="flex-1 p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comprar Créditos</h1>
        <p className="text-muted-foreground">Escolha a quantidade de créditos que deseja adquirir</p>
      </div>

      {/* Current balance */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Phone className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-sm text-muted-foreground">Saldo Telefone</p>
              <p className="text-xl font-bold">{credits.phone}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Mail className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Saldo Email</p>
              <p className="text-xl font-bold">{credits.email}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Phone slider */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="h-5 w-5 text-emerald-500" />
            Créditos de Telefone
          </CardTitle>
          <CardDescription>
            {formatBRL((unitPrices.phone || 50) / 100)} por crédito
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Slider
            value={[phoneCredits]}
            onValueChange={(v) => setPhoneCredits(v[0])}
            min={0}
            max={5000}
            step={50}
          />
          <div className="flex justify-between items-center">
            <Badge variant="secondary">{phoneCredits} créditos</Badge>
            <span className="font-semibold">{formatBRL(phoneTotal)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Email slider */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-blue-500" />
            Créditos de Email
          </CardTitle>
          <CardDescription>
            {formatBRL((unitPrices.email || 10) / 100)} por crédito
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Slider
            value={[emailCredits]}
            onValueChange={(v) => setEmailCredits(v[0])}
            min={0}
            max={50000}
            step={500}
          />
          <div className="flex justify-between items-center">
            <Badge variant="secondary">{emailCredits.toLocaleString()} créditos</Badge>
            <span className="font-semibold">{formatBRL(emailTotal)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span>Telefone ({phoneCredits} × {formatBRL((unitPrices.phone || 50) / 100)})</span>
            <span>{formatBRL(phoneTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Email ({emailCredits.toLocaleString()} × {formatBRL((unitPrices.email || 10) / 100)})</span>
            <span>{formatBRL(emailTotal)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>{formatBRL(grandTotal)}</span>
          </div>
          <Button
            className="w-full mt-2"
            size="lg"
            onClick={handleCheckout}
            disabled={loading || grandTotal === 0}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CreditCard className="h-4 w-4 mr-2" />
            )}
            Pagar {formatBRL(grandTotal)}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
