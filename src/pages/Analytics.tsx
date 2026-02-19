import { useState } from "react";
import { Building2, Users, TrendingUp, Target, Download, Send, Reply, Mail, MousePointerClick, ExternalLink, CheckCircle, XCircle, Filter } from "lucide-react";
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
import {
  useRealMetrics,
  useMonthlyChartData,
  useIndustryChartData,
  useClicksChartData,
  useTopLeadsByClicks,
} from "@/hooks/useRealMetrics";
import { useEventLog, useEventTotals, useEventChartData } from "@/hooks/useEventLog";
import { useCampaigns } from "@/hooks/useCampaigns";
import { Skeleton } from "@/components/ui/skeleton";
import { EngagedLeadsModal } from "@/components/EngagedLeadsModal";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  sent: { label: "Enviado", color: "bg-blue-100 text-blue-800" },
  delivered: { label: "Entregue", color: "bg-green-100 text-green-800" },
  clicked: { label: "Clicado", color: "bg-purple-100 text-purple-800" },
  replied: { label: "Respondido", color: "bg-emerald-100 text-emerald-800" },
  accepted: { label: "Aceito", color: "bg-teal-100 text-teal-800" },
  failed: { label: "Falha", color: "bg-red-100 text-red-800" },
  bounced: { label: "Bounce", color: "bg-orange-100 text-orange-800" },
};

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
};

const Analytics = () => {
  const [period, setPeriod] = useState("7d");
  const [eventPeriod, setEventPeriod] = useState("7d");
  const [eventCampaign, setEventCampaign] = useState("all");
  const [eventType, setEventType] = useState("all");
  const [engagedOpen, setEngagedOpen] = useState(false);

  const { data: metrics, isLoading: metricsLoading } = useRealMetrics();
  const { data: monthlyData, isLoading: monthlyLoading } = useMonthlyChartData();
  const { data: industryData, isLoading: industryLoading } = useIndustryChartData();
  const { data: clicksData, isLoading: clicksLoading } = useClicksChartData(period);
  const { data: topLeads, isLoading: topLeadsLoading } = useTopLeadsByClicks();
  const { data: campaigns } = useCampaigns();

  const eventFilters = {
    period: eventPeriod,
    campaignId: eventCampaign !== "all" ? eventCampaign : undefined,
    eventType: eventType !== "all" ? eventType : undefined,
  };
  const { data: eventLog, isLoading: eventsLoading } = useEventLog(eventFilters);
  const { data: eventTotals, isLoading: totalsLoading } = useEventTotals(eventPeriod);
  const { data: eventChartData, isLoading: eventChartLoading } = useEventChartData(eventPeriod);

  const kpis = [
    { label: "Empresas salvas", value: metrics?.companiesSaved ?? 0, icon: Building2 },
    { label: "Contatos salvos", value: metrics?.contactsSaved ?? 0, icon: Users },
    { label: "Taxa de conversão", value: `${metrics?.conversionRate ?? 0}%`, icon: TrendingUp },
    { label: "Listas ativas", value: metrics?.activeLists ?? 0, icon: Target },
    { label: "Campanhas ativas", value: metrics?.activeCampaigns ?? 0, icon: Mail },
    { label: "Total enviados", value: metrics?.totalSent ?? 0, icon: Send },
    { label: "Total respondidos", value: metrics?.totalReplied ?? 0, icon: Reply },
    { label: "Cliques únicos", value: metrics?.totalLinkClicks ?? 0, icon: MousePointerClick },
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
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

      {/* Tabs: Overview + Events */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Link Clicks Chart + Top Leads */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border border-border shadow-none lg:col-span-2">
              <CardHeader>
                <CardTitle className="font-display text-base font-semibold flex items-center gap-2">
                  <MousePointerClick className="h-4 w-4 text-primary" />
                  Cliques em links por período
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clicksLoading ? (
                  <Skeleton className="h-[240px] w-full" />
                ) : clicksData && clicksData.length > 0 && clicksData.some((d) => d.cliques > 0) ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={clicksData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", color: "hsl(var(--foreground))" }} formatter={(v: number) => [v, "Cliques únicos"]} />
                      <Bar dataKey="cliques" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                    Nenhum clique registrado no período.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-border shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="font-display text-base font-semibold">Leads mais engajados</CardTitle>
                {topLeads && topLeads.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-primary" onClick={() => setEngagedOpen(true)}>
                    <ExternalLink className="h-3 w-3" /> Ver todos
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {topLeadsLoading ? (
                  <Skeleton className="h-[240px] w-full" />
                ) : topLeads && topLeads.length > 0 ? (
                  <div className="space-y-3">
                    {topLeads.slice(0, 5).map((lead, i) => (
                      <div key={lead.lead_id} className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{lead.name}</p>
                          {lead.company && <p className="truncate text-xs text-muted-foreground">{lead.company}</p>}
                        </div>
                        <span className="flex items-center gap-1 text-sm font-semibold text-primary">
                          <MousePointerClick className="h-3 w-3" /> {lead.link_clicks_count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground text-center px-4">
                    Nenhum lead clicou em links ainda.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Existing Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border border-border shadow-none">
              <CardHeader>
                <CardTitle className="font-display text-base font-semibold">Crescimento por período</CardTitle>
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
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", color: "hsl(var(--foreground))" }} />
                      <Line type="monotone" dataKey="empresas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="contatos" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                    Nenhum dado disponível.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-border shadow-none">
              <CardHeader>
                <CardTitle className="font-display text-base font-semibold">Empresas por setor</CardTitle>
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
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", color: "hsl(var(--foreground))" }} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                    Nenhum dado disponível.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          {/* Event Totals Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border border-border shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Entregas</span>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div className="mt-2">
                  {totalsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <span className="font-display text-2xl font-bold text-foreground">{eventTotals?.delivered ?? 0}</span>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cliques</span>
                  <MousePointerClick className="h-4 w-4 text-purple-500" />
                </div>
                <div className="mt-2">
                  {totalsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <span className="font-display text-2xl font-bold text-foreground">{eventTotals?.clicked ?? 0}</span>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Bounces</span>
                  <XCircle className="h-4 w-4 text-red-500" />
                </div>
                <div className="mt-2">
                  {totalsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <span className="font-display text-2xl font-bold text-foreground">{eventTotals?.bounced ?? 0}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Event Chart */}
          <Card className="border border-border shadow-none">
            <CardHeader>
              <CardTitle className="font-display text-base font-semibold">Eventos por dia</CardTitle>
            </CardHeader>
            <CardContent>
              {eventChartLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : eventChartData && eventChartData.some(d => d.eventos > 0) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={eventChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", color: "hsl(var(--foreground))" }} />
                    <Line type="monotone" dataKey="eventos" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                  Nenhum evento no período.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={eventPeriod} onValueChange={setEventPeriod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="15d">Últimos 15 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Select value={eventCampaign} onValueChange={setEventCampaign}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Campanha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas campanhas</SelectItem>
                {(campaigns || []).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="delivered">Entregue</SelectItem>
                <SelectItem value="clicked">Clicado</SelectItem>
                <SelectItem value="replied">Respondido</SelectItem>
                <SelectItem value="accepted">Aceito</SelectItem>
                <SelectItem value="failed">Falha</SelectItem>
                <SelectItem value="bounced">Bounce</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Events Table */}
          <Card className="border border-border shadow-none">
            <CardContent className="p-0">
              {eventsLoading ? (
                <div className="p-6"><Skeleton className="h-[300px] w-full" /></div>
              ) : eventLog && eventLog.length > 0 ? (
                <div className="relative w-full overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contato</TableHead>
                        <TableHead>Campanha</TableHead>
                        <TableHead>Canal</TableHead>
                        <TableHead>Evento</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eventLog.map((ev) => {
                        const evInfo = EVENT_LABELS[ev.event_type] || { label: ev.event_type, color: "bg-muted text-muted-foreground" };
                        return (
                          <TableRow key={ev.id}>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium text-foreground">{ev.lead_name}</p>
                                {ev.lead_company && <p className="text-xs text-muted-foreground">{ev.lead_company}</p>}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-foreground">{ev.campaign_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{CHANNEL_LABELS[ev.campaign_channel] || ev.campaign_channel}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-xs ${evInfo.color}`}>{evInfo.label}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {new Date(ev.event_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}{" "}
                              {new Date(ev.event_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                  Nenhum evento encontrado no período selecionado.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EngagedLeadsModal open={engagedOpen} onOpenChange={setEngagedOpen} />
    </div>
  );
};

export default Analytics;
