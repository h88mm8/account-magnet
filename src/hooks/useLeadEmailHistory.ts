import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LeadEmailEvent = {
  id: string;
  campaign_name: string;
  campaign_channel: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  replied_at: string | null;
  failed_at: string | null;
  accepted_at: string | null;
  click_count: number;
  message_content: string | null;
};

async function fetchLeadEmailHistory(leadId: string): Promise<LeadEmailEvent[]> {
  const { data: clRows } = await supabase
    .from("campaign_leads")
    .select("id, campaign_id, status, sent_at, delivered_at, replied_at, failed_at, accepted_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!clRows || clRows.length === 0) return [];

  const campaignIds = [...new Set(clRows.map(r => r.campaign_id))];
  const [campaignsRes, clicksRes] = await Promise.all([
    supabase.from("campaigns").select("id, name, channel, message_template").in("id", campaignIds),
    supabase.from("link_clicks").select("lead_id, id").eq("lead_id", leadId).eq("is_unique", true),
  ]);

  const campMap = new Map((campaignsRes.data || []).map(c => [c.id, c]));
  const clickCount = clicksRes.data?.length ?? 0;

  return clRows.map(cl => {
    const camp = campMap.get(cl.campaign_id);
    return {
      id: cl.id,
      campaign_name: camp?.name || "—",
      campaign_channel: camp?.channel || "email",
      status: cl.status,
      sent_at: cl.sent_at,
      delivered_at: cl.delivered_at,
      replied_at: cl.replied_at,
      failed_at: cl.failed_at,
      accepted_at: cl.accepted_at,
      click_count: clickCount,
      message_content: camp?.message_template || null,
    };
  });
}

export function useLeadEmailHistory(leadId: string | null) {
  return useQuery({
    queryKey: ["lead-email-history", leadId],
    queryFn: () => fetchLeadEmailHistory(leadId!),
    enabled: !!leadId,
  });
}
