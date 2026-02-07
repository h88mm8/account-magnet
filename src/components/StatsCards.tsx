import { Building2, Users, TrendingUp, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const stats = [
  {
    label: "Empresas encontradas",
    value: "2,847",
    change: "+12.5%",
    icon: Building2,
    positive: true,
  },
  {
    label: "Contatos salvos",
    value: "1,234",
    change: "+8.2%",
    icon: Users,
    positive: true,
  },
  {
    label: "Taxa de conversão",
    value: "3.2%",
    change: "+0.4%",
    icon: TrendingUp,
    positive: true,
  },
  {
    label: "Listas ativas",
    value: "12",
    change: "—",
    icon: Target,
    positive: false,
  },
];

export function StatsCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border border-border shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-foreground">{stat.value}</span>
              {stat.change !== "—" && (
                <span className="text-xs font-medium text-primary">{stat.change}</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
