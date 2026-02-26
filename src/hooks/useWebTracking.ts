import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Settings ──
export interface WebTrackingSettings {
  id: string;
  user_id: string;
  site_url: string | null;
  gtm_id: string | null;
  org_token: string;
}

export function useWebTrackingSettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["web-tracking-settings"],
    queryFn: async (): Promise<WebTrackingSettings | null> => {
      if (!user) return null;
      const { data } = await supabase
        .from("web_tracking_settings" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user,
  });
}

// ── Contact web activity ──
export interface WebActivityEvent {
  id: string;
  event_type: string;
  metadata: Record<string, any>;
  created_at: string;
}

export function useContactWebActivity(contactId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["contact-web-activity", contactId],
    queryFn: async (): Promise<WebActivityEvent[]> => {
      if (!contactId) return [];
      const { data, error } = await supabase
        .from("events" as any)
        .select("id, event_type, metadata, created_at")
        .eq("contact_id", contactId)
        .eq("channel", "site")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!contactId && !!user,
    refetchInterval: 15000,
  });
}

// ── Analytics: web tracking metrics ──
export interface WebTrackingMetrics {
  totalVisits: number;
  totalSessions: number;
  topPages: { url: string; count: number }[];
  avgTimeOnPage: number;
  topContacts: { contactId: string; name: string; company: string | null; eventCount: number }[];
  avgScrollDepth: number;
  topCTAs: { ctaId: string; count: number }[];
}

export function useWebTrackingMetrics(filters: { period: string; listId?: string }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["web-tracking-metrics", filters],
    queryFn: async (): Promise<WebTrackingMetrics> => {
      if (!user) return emptyMetrics();

      const daysBack = filters.period === "30d" ? 30 : filters.period === "90d" ? 90 : 7;
      const since = new Date(Date.now() - daysBack * 86400000).toISOString();

      let query = supabase
        .from("events" as any)
        .select("id, event_type, metadata, contact_id, created_at")
        .eq("user_id", user.id)
        .eq("channel", "site")
        .gte("created_at", since)
        .limit(1000);

      const { data, error } = await query;
      if (error) throw error;
      const events = (data || []) as any[];

      // Filter by list if needed
      let filteredEvents = events;
      if (filters.listId) {
        const { data: listItems } = await supabase
          .from("prospect_list_items")
          .select("id")
          .eq("list_id", filters.listId)
          .eq("user_id", user.id);
        const contactIds = new Set((listItems || []).map((i: any) => i.id));
        filteredEvents = events.filter(e => e.contact_id && contactIds.has(e.contact_id));
      }

      const visits = filteredEvents.filter(e => e.event_type === "page_visit");
      const scrolls = filteredEvents.filter(e => e.event_type === "scroll_depth");
      const ctaClicks = filteredEvents.filter(e => e.event_type === "cta_click");

      // Sessions
      const sessions = new Set(filteredEvents.map(e => e.metadata?.session_id).filter(Boolean));

      // Top pages
      const pageCounts: Record<string, number> = {};
      for (const v of visits) {
        const url = v.metadata?.url || "unknown";
        pageCounts[url] = (pageCounts[url] || 0) + 1;
      }
      const topPages = Object.entries(pageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([url, count]) => ({ url, count }));

      // Avg time on page
      const times = visits.map(v => v.metadata?.time_on_page || v.metadata?.duration_ms).filter(Boolean);
      const avgTimeOnPage = times.length > 0 ? Math.round(times.reduce((a: number, b: number) => a + b, 0) / times.length / 1000) : 0;

      // Top contacts
      const contactCounts: Record<string, number> = {};
      for (const e of filteredEvents) {
        if (e.contact_id) contactCounts[e.contact_id] = (contactCounts[e.contact_id] || 0) + 1;
      }
      const topContactIds = Object.entries(contactCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

      let topContacts: { contactId: string; name: string; company: string | null; eventCount: number }[] = [];
      if (topContactIds.length > 0) {
        const { data: contacts } = await supabase
          .from("prospect_list_items")
          .select("id, name, company")
          .in("id", topContactIds.map(c => c[0]));
        const contactMap = new Map((contacts || []).map((c: any) => [c.id, c]));
        topContacts = topContactIds.map(([id, count]) => {
          const c = contactMap.get(id);
          return { contactId: id, name: c?.name || "Desconhecido", company: c?.company || null, eventCount: count };
        });
      }

      // Avg scroll depth
      const scrollPercents = scrolls.map(s => s.metadata?.scroll_percent).filter((v: any) => typeof v === "number");
      const avgScrollDepth = scrollPercents.length > 0 ? Math.round(scrollPercents.reduce((a: number, b: number) => a + b, 0) / scrollPercents.length) : 0;

      // Top CTAs
      const ctaCounts: Record<string, number> = {};
      for (const c of ctaClicks) {
        const id = c.metadata?.cta_id || c.metadata?.cta_text || "unknown";
        ctaCounts[id] = (ctaCounts[id] || 0) + 1;
      }
      const topCTAs = Object.entries(ctaCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([ctaId, count]) => ({ ctaId, count }));

      return {
        totalVisits: visits.length,
        totalSessions: sessions.size,
        topPages,
        avgTimeOnPage,
        topContacts,
        avgScrollDepth,
        topCTAs,
      };
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
}

export function useWebTrackingChartData(period: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["web-tracking-chart", period],
    queryFn: async (): Promise<{ date: string; eventos: number }[]> => {
      if (!user) return [];
      const daysBack = period === "30d" ? 30 : period === "90d" ? 90 : 7;
      const since = new Date(Date.now() - daysBack * 86400000).toISOString();

      const { data } = await supabase
        .from("events" as any)
        .select("created_at")
        .eq("user_id", user.id)
        .eq("channel", "site")
        .gte("created_at", since);

      const days: Record<string, number> = {};
      for (const row of (data || []) as any[]) {
        const key = new Date(row.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        days[key] = (days[key] || 0) + 1;
      }

      const now = new Date();
      const result: { date: string; eventos: number }[] = [];
      for (let i = daysBack - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        result.push({ date: key, eventos: days[key] || 0 });
      }
      return result;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
}

function emptyMetrics(): WebTrackingMetrics {
  return { totalVisits: 0, totalSessions: 0, topPages: [], avgTimeOnPage: 0, topContacts: [], avgScrollDepth: 0, topCTAs: [] };
}
