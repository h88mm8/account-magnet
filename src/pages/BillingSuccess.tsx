import { useEffect } from "react";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useCredits } from "@/hooks/useCredits";

export default function BillingSuccess() {
  const navigate = useNavigate();
  const { refetch: refetchSubscription } = useSubscription();
  const { refetch: refetchCredits } = useCredits();

  // FIX #5: Force refetch on mount + poll a few times to catch webhook delay
  useEffect(() => {
    refetchSubscription();
    refetchCredits();

    const interval = setInterval(() => {
      refetchSubscription();
      refetchCredits();
    }, 3000);

    // Stop polling after 30s
    const timeout = setTimeout(() => clearInterval(interval), 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [refetchSubscription, refetchCredits]);

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-emerald-500" />
          <h1 className="text-2xl font-bold">Pagamento Confirmado!</h1>
          <p className="text-muted-foreground">
            Seus créditos foram adicionados à sua conta e o saldo será atualizado automaticamente.
          </p>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => navigate("/billing")}>
              Comprar mais
            </Button>
            <Button onClick={() => navigate("/")}>
              Ir para o painel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
