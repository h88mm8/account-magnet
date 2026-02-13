import { Building2, Users, TrendingUp, Target, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useRealMetrics } from "@/hooks/useRealMetrics";
import { Skeleton } from "@/components/ui/skeleton";

export function StatsCards() {
  const { data: metrics, isLoading } = useRealMetrics();

  const stats = [
    {
      label: "Empresas salvas",
      value: metrics?.companiesSaved ?? 0,
      icon: Building2,
    },
    {
      label: "Contatos salvos",
      value: metrics?.contactsSaved ?? 0,
      icon: Users,
    },
    {
      label: "Taxa de conversão",
      value: `${metrics?.conversionRate ?? 0}%`,
      icon: TrendingUp,
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
              {isLoading ? (
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
