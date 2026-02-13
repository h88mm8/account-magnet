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

async function fetchMetrics(): Promise<RealMetrics> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { companiesSaved: 0, contactsSaved: 0, activeLists: 0, conversionRate: 0, totalCampaigns: 0, activeCampaigns: 0, totalSent: 0, totalReplied: 0 };

  const [accountItems, leadItems, lists, campaigns] = await Promise.all([
    supabase
      .from("prospect_list_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("item_type", "account"),
    supabase
      .from("prospect_list_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("item_type", "lead"),
    supabase
      .from("prospect_lists")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("campaigns")
      .select("status, total_sent, total_replied")
      .eq("user_id", user.id),
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

export function useRealMetrics() {
  return useQuery({
    queryKey: ["real-metrics"],
    queryFn: fetchMetrics,
    refetchInterval: 30000,
  });
}

export function useMonthlyChartData() {
  return useQuery({
    queryKey: ["monthly-chart-data"],
    queryFn: fetchMonthlyData,
    refetchInterval: 30000,
  });
}

export function useIndustryChartData() {
  return useQuery({
    queryKey: ["industry-chart-data"],
    queryFn: fetchIndustryData,
    refetchInterval: 30000,
  });
}
