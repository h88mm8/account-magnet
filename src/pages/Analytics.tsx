import { useState } from "react";
import { Building2, Users, TrendingUp, Target, Download, Send, Reply, Mail, CheckCircle, XCircle, Filter, Globe, Eye, MousePointerClick, BarChart3, Clock } from "lucide-react";
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
} from "@/hooks/useRealMetrics";
import { useEventLog, useEventTotals, useEventChartData } from "@/hooks/useEventLog";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useProspectLists } from "@/hooks/useProspectLists";
import { useWebTrackingMetrics, useWebTrackingChartData } from "@/hooks/useWebTracking";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  sent: { label: "Enviado", color: "bg-blue-100 text-blue-800" },
  delivered: { label: "Entregue", color: "bg-green-100 text-green-800" },
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
  const [webPeriod, setWebPeriod] = useState("7d");
  const [webListId, setWebListId] = useState("all");

  const { data: metrics, isLoading: metricsLoading } = useRealMetrics();
  const { data: monthlyData, isLoading: monthlyLoading } = useMonthlyChartData();
  const { data: industryData, isLoading: industryLoading } = useIndustryChartData();
  const { data: campaigns } = useCampaigns();
  const { lists } = useProspectLists();

  const eventFilters = {
    period: eventPeriod,
    campaignId: eventCampaign !== "all" ? eventCampaign : undefined,
    eventType: eventType !== "all" ? eventType : undefined,
  };
  const { data: eventLog, isLoading: eventsLoading } = useEventLog(eventFilters);
  const { data: eventTotals, isLoading: totalsLoading } = useEventTotals(eventPeriod);
  const { data: eventChartData, isLoading: eventChartLoading } = useEventChartData(eventPeriod);

  // Web tracking
  const webFilters = { period: webPeriod, listId: webListId !== "all" ? webListId : undefined };
  const { data: webMetrics, isLoading: webMetricsLoading } = useWebTrackingMetrics(webFilters);
  const { data: webChartData, isLoading: webChartLoading } = useWebTrackingChartData(webPeriod);

  const kpis = [
    { label: "Empresas salvas", value: metrics?.companiesSaved ?? 0, icon: Building2 },
    { label: "Contatos salvos", value: metrics?.contactsSaved ?? 0, icon: Users },
    { label: "Taxa de conversão", value: `${metrics?.conversionRate ?? 0}%`, icon: TrendingUp },
    { label: "Listas ativas", value: metrics?.activeLists ?? 0, icon: Target },
    { label: "Campanhas ativas", value: metrics?.activeCampaigns ?? 0, icon: Mail },
    { label: "Total enviados", value: metrics?.totalSent ?? 0, icon: Send },
    { label: "Total respondidos", value: metrics?.totalReplied ?? 0, icon: Reply },
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
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

      {/* Tabs: Overview + Events + Web Tracking */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="web-tracking" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Tracking Web
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
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
          <div className="grid gap-4 sm:grid-cols-2">
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
                  <span className="text-sm text-muted-foreground">Falhas</span>
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
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="15d">Últimos 15 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Select value={eventCampaign} onValueChange={setEventCampaign}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Campanha" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas campanhas</SelectItem>
                {(campaigns || []).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="delivered">Entregue</SelectItem>
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

        {/* Web Tracking Tab */}
        <TabsContent value="web-tracking" className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={webPeriod} onValueChange={setWebPeriod}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Select value={webListId} onValueChange={setWebListId}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Lista" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as listas</SelectItem>
                {(lists || []).map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border border-border shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total de visitas</span>
                  <Eye className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <div className="mt-2">
                  {webMetricsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <span className="font-display text-2xl font-bold text-foreground">{webMetrics?.totalVisits ?? 0}</span>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sessões</span>
                  <Globe className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <div className="mt-2">
                  {webMetricsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <span className="font-display text-2xl font-bold text-foreground">{webMetrics?.totalSessions ?? 0}</span>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tempo médio (seg)</span>
                  <Clock className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <div className="mt-2">
                  {webMetricsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <span className="font-display text-2xl font-bold text-foreground">{webMetrics?.avgTimeOnPage ?? 0}s</span>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Scroll médio</span>
                  <BarChart3 className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <div className="mt-2">
                  {webMetricsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <span className="font-display text-2xl font-bold text-foreground">{webMetrics?.avgScrollDepth ?? 0}%</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card className="border border-border shadow-none">
            <CardHeader>
              <CardTitle className="font-display text-base font-semibold">Eventos web por dia</CardTitle>
            </CardHeader>
            <CardContent>
              {webChartLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : webChartData && webChartData.some(d => d.eventos > 0) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={webChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", color: "hsl(var(--foreground))" }} />
                    <Line type="monotone" dataKey="eventos" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                  Nenhum evento de tracking no período.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Pages */}
            <Card className="border border-border shadow-none">
              <CardHeader>
                <CardTitle className="font-display text-base font-semibold">Páginas mais visitadas</CardTitle>
              </CardHeader>
              <CardContent>
                {webMetricsLoading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : webMetrics?.topPages && webMetrics.topPages.length > 0 ? (
                  <div className="space-y-2">
                    {webMetrics.topPages.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-foreground truncate max-w-[250px]" title={p.url}>{p.url}</span>
                        <Badge variant="secondary">{p.count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma visita registrada.</p>
                )}
              </CardContent>
            </Card>

            {/* Top CTAs */}
            <Card className="border border-border shadow-none">
              <CardHeader>
                <CardTitle className="font-display text-base font-semibold">CTAs mais clicados</CardTitle>
              </CardHeader>
              <CardContent>
                {webMetricsLoading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : webMetrics?.topCTAs && webMetrics.topCTAs.length > 0 ? (
                  <div className="space-y-2">
                    {webMetrics.topCTAs.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-foreground truncate max-w-[250px]">{c.ctaId}</span>
                        <Badge variant="secondary">{c.count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum clique em CTA registrado.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Engaged Contacts */}
          <Card className="border border-border shadow-none">
            <CardHeader>
              <CardTitle className="font-display text-base font-semibold">Contatos mais engajados</CardTitle>
            </CardHeader>
            <CardContent>
              {webMetricsLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : webMetrics?.topContacts && webMetrics.topContacts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contato</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-right">Eventos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webMetrics.topContacts.map((c) => (
                      <TableRow key={c.contactId}>
                        <TableCell className="text-sm font-medium text-foreground">{c.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.company || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{c.eventCount}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum contato com atividade web.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;
