import { useState } from "react";
import { Building2, Users, TrendingUp, Target, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useRealMetrics, useMonthlyChartData, useIndustryChartData } from "@/hooks/useRealMetrics";
import { Skeleton } from "@/components/ui/skeleton";

const Analytics = () => {
  const [period, setPeriod] = useState("7d");
  const { data: metrics, isLoading: metricsLoading } = useRealMetrics();
  const { data: monthlyData, isLoading: monthlyLoading } = useMonthlyChartData();
  const { data: industryData, isLoading: industryLoading } = useIndustryChartData();

  const kpis = [
    { label: "Empresas salvas", value: metrics?.companiesSaved ?? 0, icon: Building2 },
    { label: "Contatos salvos", value: metrics?.contactsSaved ?? 0, icon: Users },
    { label: "Taxa de conversão", value: `${metrics?.conversionRate ?? 0}%`, icon: TrendingUp },
    { label: "Listas ativas", value: metrics?.activeLists ?? 0, icon: Target },
  ];

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe o desempenho das suas prospecções.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="12m">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border border-border shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{kpi.label}</span>
                <kpi.icon className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <div className="mt-2">
                {metricsLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <span className="font-display text-2xl font-bold text-foreground">
                    {kpi.value}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-border shadow-none">
          <CardHeader>
            <CardTitle className="font-display text-base font-semibold">
              Crescimento por período
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : monthlyData && monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Line type="monotone" dataKey="empresas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="contatos" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                Nenhum dado disponível. Salve itens em listas para gerar o gráfico.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-none">
          <CardHeader>
            <CardTitle className="font-display text-base font-semibold">
              Empresas por setor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {industryLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : industryData && industryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={industryData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                Nenhum dado disponível. Salve empresas em listas para gerar o gráfico.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
