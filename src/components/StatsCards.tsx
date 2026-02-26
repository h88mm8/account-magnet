import { Building2, Users, TrendingUp, Target, Send, Coins, Mail, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useRealMetrics } from "@/hooks/useRealMetrics";
import { useCredits } from "@/hooks/useCredits";
import { Skeleton } from "@/components/ui/skeleton";

export function StatsCards() {
  const { data: metrics, isLoading } = useRealMetrics();
  const { leads, email, phone, isLoading: creditsLoading } = useCredits();

  const stats = [
    {
      label: "Créditos Leads",
      value: leads.toLocaleString("pt-BR"),
      icon: Coins,
    },
    {
      label: "Créditos Email",
      value: email.toLocaleString("pt-BR"),
      icon: Mail,
    },
    {
      label: "Créditos Celular",
      value: phone.toLocaleString("pt-BR"),
      icon: Phone,
    },
    {
      label: "Listas ativas",
      value: metrics?.activeLists ?? 0,
      icon: Target,
    },
    {
      label: "Campanhas ativas",
      value: metrics?.activeCampaigns ?? 0,
      icon: Send,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {stats.map((stat) => (
        <Card key={stat.label} className="border border-border shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <div className="mt-2">
              {(isLoading || creditsLoading) ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <span className="font-display text-2xl font-bold text-foreground">
                  {stat.value}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
