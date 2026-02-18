import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RealMetrics = {
  companiesSaved: number;
  contactsSaved: number;
  activeLists: number;
  conversionRate: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalSent: number;
  totalReplied: number;
  totalLinkClicks: number;
};

export type MonthlyData = {
  month: string;
  empresas: number;
  contatos: number;
};

export type IndustryData = {
  name: string;
  value: number;
};

export type ClicksChartData = {
  date: string;
  cliques: number;
};

export type TopLeadClick = {
  lead_id: string;
  name: string;
  company: string | null;
  link_clicks_count: number;
};

async function fetchMetrics(): Promise<RealMetrics> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { companiesSaved: 0, contactsSaved: 0, activeLists: 0, conversionRate: 0, totalCampaigns: 0, activeCampaigns: 0, totalSent: 0, totalReplied: 0, totalLinkClicks: 0 };

  const [accountItems, leadItems, lists, campaigns, linkClicks] = await Promise.all([
    supabase.from("prospect_list_items").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("item_type", "account"),
    supabase.from("prospect_list_items").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("item_type", "lead"),
    supabase.from("prospect_lists").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("campaigns").select("status, total_sent, total_replied").eq("user_id", user.id),
    supabase.from("link_clicks").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_unique", true),
  ]);

  const companies = accountItems.count ?? 0;
  const contacts = leadItems.count ?? 0;
  const totalItems = companies + contacts;
  const conversionRate = totalItems > 0 ? (contacts / totalItems) * 100 : 0;
  const campaignList = campaigns.data || [];

  return {
    companiesSaved: companies,
    contactsSaved: contacts,
    activeLists: lists.count ?? 0,
    conversionRate: Math.round(conversionRate * 10) / 10,
    totalCampaigns: campaignList.length,
    activeCampaigns: campaignList.filter((c) => c.status === "active").length,
    totalSent: campaignList.reduce((s, c) => s + (c.total_sent || 0), 0),
    totalReplied: campaignList.reduce((s, c) => s + (c.total_replied || 0), 0),
    totalLinkClicks: linkClicks.count ?? 0,
  };
}

async function fetchMonthlyData(): Promise<MonthlyData[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: items } = await supabase
    .from("prospect_list_items")
    .select("created_at, item_type")
    .eq("user_id", user.id)
    .gte("created_at", sixMonthsAgo.toISOString())
    .order("created_at", { ascending: true });

  if (!items || items.length === 0) return [];

  const months: Record<string, { empresas: number; contatos: number }> = {};
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  for (const item of items) {
    const d = new Date(item.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!months[key]) months[key] = { empresas: 0, contatos: 0 };
    if (item.item_type === "account") months[key].empresas++;
    else months[key].contatos++;
  }

  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      month: monthNames[parseInt(key.split("-")[1])],
      ...val,
    }));
}

async function fetchIndustryData(): Promise<IndustryData[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: items } = await supabase
    .from("prospect_list_items")
    .select("industry")
    .eq("user_id", user.id)
    .eq("item_type", "account")
    .not("industry", "is", null);

  if (!items || items.length === 0) return [];

  const counts: Record<string, number> = {};
  for (const item of items) {
    const ind = item.industry || "Outros";
    counts[ind] = (counts[ind] || 0) + 1;
  }

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));
}

async function fetchClicksChartData(period: string): Promise<ClicksChartData[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const now = new Date();
  let daysBack = 7;
  if (period === "30d") daysBack = 30;
  else if (period === "90d") daysBack = 90;
  else if (period === "12m") daysBack = 365;

  const since = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const { data: clicks } = await supabase
    .from("link_clicks")
    .select("clicked_at")
    .eq("user_id", user.id)
    .eq("is_unique", true)
    .gte("clicked_at", since.toISOString())
    .order("clicked_at", { ascending: true });

  if (!clicks) return [];

  const days: Record<string, number> = {};
  for (const click of clicks) {
    const d = new Date(click.clicked_at);
    const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    days[key] = (days[key] || 0) + 1;
  }

  const result: ClicksChartData[] = [];
  const displayDays = Math.min(daysBack, 30);
  for (let i = displayDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    result.push({ date: key, cliques: days[key] || 0 });
  }

  return result;
}

async function fetchTopLeadsByClicks(): Promise<TopLeadClick[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("prospect_list_items")
    .select("id, name, company, link_clicks_count")
    .eq("user_id", user.id)
    .gt("link_clicks_count", 0)
    .order("link_clicks_count", { ascending: false })
    .limit(10);

  if (!data) return [];
  return data.map((d) => ({
    lead_id: d.id,
    name: d.name,
    company: d.company,
    link_clicks_count: d.link_clicks_count,
  }));
}

export function useRealMetrics() {
  return useQuery({ queryKey: ["real-metrics"], queryFn: fetchMetrics, refetchInterval: 30000 });
}

export function useMonthlyChartData() {
  return useQuery({ queryKey: ["monthly-chart-data"], queryFn: fetchMonthlyData, refetchInterval: 30000 });
}

export function useIndustryChartData() {
  return useQuery({ queryKey: ["industry-chart-data"], queryFn: fetchIndustryData, refetchInterval: 30000 });
}

export function useClicksChartData(period: string) {
  return useQuery({ queryKey: ["clicks-chart-data", period], queryFn: () => fetchClicksChartData(period), refetchInterval: 30000 });
}

export function useTopLeadsByClicks() {
  return useQuery({ queryKey: ["top-leads-clicks"], queryFn: fetchTopLeadsByClicks, refetchInterval: 30000 });
}
