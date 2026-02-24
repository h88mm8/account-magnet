import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface WorkflowEventMetrics {
  email: { sent: number; delivered: number; replied: number; bounced: number; spam: number };
  linkedin: { sent: number; accepted: number; delivered: number; replied: number };
  whatsapp: { sent: number; delivered: number; replied: number };
  site: { page_visit: number; scroll_depth: number; cta_click: number };
}

export interface WorkflowEventEntry {
  id: string;
  contact_id: string | null;
  channel: string;
  event_type: string;
  metadata: Record<string, any>;
  created_at: string;
  contact_name?: string;
  contact_company?: string;
}

export function useWorkflowEvents(workflowId: string | null) {
  const { user } = useAuth();

  const metricsQuery = useQuery({
    queryKey: ["workflow-events-metrics", workflowId],
    queryFn: async (): Promise<WorkflowEventMetrics> => {
      if (!workflowId) {
        return {
          email: { sent: 0, delivered: 0, replied: 0, bounced: 0, spam: 0 },
          linkedin: { sent: 0, accepted: 0, delivered: 0, replied: 0 },
          whatsapp: { sent: 0, delivered: 0, replied: 0 },
          site: { page_visit: 0, scroll_depth: 0, cta_click: 0 },
        };
      }

      const { data, error } = await supabase
        .from("events" as any)
        .select("channel, event_type")
        .eq("workflow_id", workflowId);

      if (error) throw error;

      const events = (data || []) as any[];
      const count = (ch: string, et: string) => events.filter((e) => e.channel === ch && e.event_type === et).length;

      return {
        email: { sent: count("email", "sent"), delivered: count("email", "delivered"), replied: count("email", "replied"), bounced: count("email", "bounced"), spam: count("email", "spam") },
        linkedin: { sent: count("linkedin", "sent"), accepted: count("linkedin", "accepted"), delivered: count("linkedin", "delivered"), replied: count("linkedin", "replied") },
        whatsapp: { sent: count("whatsapp", "sent"), delivered: count("whatsapp", "delivered"), replied: count("whatsapp", "replied") },
        site: { page_visit: count("site", "page_visit"), scroll_depth: count("site", "scroll_depth"), cta_click: count("site", "cta_click") },
      };
    },
    enabled: !!workflowId && !!user,
    refetchInterval: 15000,
  });

  const logQuery = useQuery({
    queryKey: ["workflow-events-log", workflowId],
    queryFn: async (): Promise<WorkflowEventEntry[]> => {
      if (!workflowId) return [];

      const { data, error } = await supabase
        .from("events" as any)
        .select("id, contact_id, channel, event_type, metadata, created_at, prospect_list_items(name, company)")
        .eq("workflow_id", workflowId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      return ((data || []) as any[]).map((e: any) => ({
        id: e.id,
        contact_id: e.contact_id,
        channel: e.channel,
        event_type: e.event_type,
        metadata: e.metadata || {},
        created_at: e.created_at,
        contact_name: e.prospect_list_items?.name,
        contact_company: e.prospect_list_items?.company,
      }));
    },
    enabled: !!workflowId && !!user,
    refetchInterval: 15000,
  });

  return {
    metrics: metricsQuery.data,
    metricsLoading: metricsQuery.isLoading,
    eventLog: logQuery.data,
    eventLogLoading: logQuery.isLoading,
  };
}

// Global events hook (not workflow-specific)
export function useGlobalEventMetrics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["global-events-metrics"],
    queryFn: async (): Promise<WorkflowEventMetrics> => {
      const { data, error } = await supabase
        .from("events" as any)
        .select("channel, event_type");

      if (error) throw error;

      const events = (data || []) as any[];
      const count = (ch: string, et: string) => events.filter((e) => e.channel === ch && e.event_type === et).length;

      return {
        email: { sent: count("email", "sent"), delivered: count("email", "delivered"), replied: count("email", "replied"), bounced: count("email", "bounced"), spam: count("email", "spam") },
        linkedin: { sent: count("linkedin", "sent"), accepted: count("linkedin", "accepted"), delivered: count("linkedin", "delivered"), replied: count("linkedin", "replied") },
        whatsapp: { sent: count("whatsapp", "sent"), delivered: count("whatsapp", "delivered"), replied: count("whatsapp", "replied") },
        site: { page_visit: count("site", "page_visit"), scroll_depth: count("site", "scroll_depth"), cta_click: count("site", "cta_click") },
      };
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
}
