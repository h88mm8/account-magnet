import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EventLogEntry = {
  id: string;
  lead_name: string;
  lead_company: string | null;
  campaign_name: string;
  campaign_channel: string;
  event_type: "sent" | "delivered" | "replied" | "failed" | "bounced" | "accepted";
  event_at: string;
};

export type EventTotals = {
  delivered: number;
  bounced: number;
};

export type EventFilters = {
  period: string;
  campaignId?: string;
  eventType?: string;
};

async function fetchEventLog(filters: EventFilters): Promise<EventLogEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const now = new Date();
  let daysBack = 7;
  if (filters.period === "15d") daysBack = 15;
  else if (filters.period === "30d") daysBack = 30;
  const since = new Date(now.getTime() - daysBack * 86400000).toISOString();

  // Fetch campaign_leads with campaign info
  let query = supabase
    .from("campaign_leads")
    .select("id, lead_id, campaign_id, status, sent_at, delivered_at, replied_at, failed_at, accepted_at")
    .eq("user_id", user.id)
    .neq("status", "pending")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  if (filters.campaignId) {
    query = query.eq("campaign_id", filters.campaignId);
  }

  const { data: clRows } = await query;
  if (!clRows || clRows.length === 0) return [];

  // Get campaign names
  const campaignIds = [...new Set(clRows.map(r => r.campaign_id))];
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, channel")
    .in("id", campaignIds);
  const campMap = new Map((campaigns || []).map(c => [c.id, c]));

  // Get lead names
  const leadIds = [...new Set(clRows.map(r => r.lead_id))];
  const { data: leads } = await supabase
    .from("prospect_list_items")
    .select("id, name, company")
    .in("id", leadIds);
  const leadMap = new Map((leads || []).map(l => [l.id, l]));

  const events: EventLogEntry[] = [];

  for (const cl of clRows) {
    const camp = campMap.get(cl.campaign_id);
    const lead = leadMap.get(cl.lead_id);
    if (!camp || !lead) continue;

    const base = {
      lead_name: lead.name,
      lead_company: lead.company,
      campaign_name: camp.name,
      campaign_channel: camp.channel,
    };

    if (cl.sent_at) events.push({ ...base, id: `${cl.id}-sent`, event_type: "sent", event_at: cl.sent_at });
    if (cl.delivered_at) events.push({ ...base, id: `${cl.id}-delivered`, event_type: "delivered", event_at: cl.delivered_at });
    if (cl.replied_at) events.push({ ...base, id: `${cl.id}-replied`, event_type: "replied", event_at: cl.replied_at });
    if (cl.accepted_at) events.push({ ...base, id: `${cl.id}-accepted`, event_type: "accepted", event_at: cl.accepted_at });
    if (cl.failed_at) events.push({ ...base, id: `${cl.id}-failed`, event_type: cl.status === "bounced" ? "bounced" : "failed", event_at: cl.failed_at });
  }

  // Filter by event type
  let filtered = events;
  if (filters.eventType && filters.eventType !== "all") {
    filtered = events.filter(e => e.event_type === filters.eventType);
  }

  return filtered.sort((a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime());
}

async function fetchEventTotals(period: string): Promise<EventTotals> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { delivered: 0, bounced: 0 };

  const now = new Date();
  let daysBack = 7;
  if (period === "15d") daysBack = 15;
  else if (period === "30d") daysBack = 30;
  const since = new Date(now.getTime() - daysBack * 86400000).toISOString();

  const [deliveredRes, failedRes] = await Promise.all([
    supabase.from("campaign_leads").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("delivered_at", "is", null).gte("created_at", since),
    supabase.from("campaign_leads").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("failed_at", "is", null).gte("created_at", since),
  ]);

  return {
    delivered: deliveredRes.count ?? 0,
    bounced: failedRes.count ?? 0,
  };
}

async function fetchEventChartData(period: string): Promise<{ date: string; eventos: number }[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const now = new Date();
  let daysBack = 7;
  if (period === "15d") daysBack = 15;
  else if (period === "30d") daysBack = 30;
  const since = new Date(now.getTime() - daysBack * 86400000).toISOString();

  const { data: clRows } = await supabase
    .from("campaign_leads")
    .select("sent_at, delivered_at, replied_at, failed_at, accepted_at")
    .eq("user_id", user.id)
    .neq("status", "pending")
    .gte("created_at", since);

  const days: Record<string, number> = {};
  for (const row of (clRows || [])) {
    for (const ts of [row.sent_at, row.delivered_at, row.replied_at, row.failed_at, row.accepted_at]) {
      if (!ts) continue;
      const key = new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      days[key] = (days[key] || 0) + 1;
    }
  }

  const result: { date: string; eventos: number }[] = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    result.push({ date: key, eventos: days[key] || 0 });
  }
  return result;
}

export function useEventLog(filters: EventFilters) {
  return useQuery({
    queryKey: ["event-log", filters],
    queryFn: () => fetchEventLog(filters),
    refetchInterval: 30000,
  });
}

export function useEventTotals(period: string) {
  return useQuery({
    queryKey: ["event-totals", period],
    queryFn: () => fetchEventTotals(period),
    refetchInterval: 30000,
  });
}

export function useEventChartData(period: string) {
  return useQuery({
    queryKey: ["event-chart-data", period],
    queryFn: () => fetchEventChartData(period),
    refetchInterval: 30000,
  });
}
