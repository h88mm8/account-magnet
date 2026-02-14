import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Campaign = {
  id: string;
  user_id: string;
  name: string;
  channel: "whatsapp" | "email" | "linkedin";
  linkedin_type: "connection_request" | "inmail" | "message" | null;
  status: "draft" | "active" | "paused" | "completed" | "cancelled";
  list_id: string | null;
  subject: string | null;
  message_template: string | null;
  daily_limit: number;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_replied: number;
  total_failed: number;
  total_accepted: number;
  created_at: string;
  updated_at: string;
};

export type CampaignLead = {
  id: string;
  campaign_id: string;
  lead_id: string;
  user_id: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  failed_at: string | null;
  accepted_at: string | null;
  error_message: string | null;
  webhook_data: unknown;
  created_at: string;
  updated_at: string;
};

export function useCampaigns() {
  return useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
  });
}

export function useCampaignLeads(campaignId: string | null) {
  return useQuery({
    queryKey: ["campaign-leads", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from("campaign_leads")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CampaignLead[];
    },
    enabled: !!campaignId,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (campaign: {
      name: string;
      channel: string;
      linkedin_type?: string | null;
      list_id?: string | null;
      subject?: string | null;
      message_template?: string | null;
      daily_limit?: number;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("campaigns")
        .insert({ ...campaign, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-metrics"] });
    },
  });
}

/** Check if user has an active WhatsApp connection */
export async function checkWhatsAppConnection(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("whatsapp_connections")
    .select("status")
    .eq("user_id", userId)
    .eq("status", "connected")
    .single();
  return !!data;
}

export function useActivateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      // Activate the campaign
      const { data, error } = await supabase
        .from("campaigns")
        .update({ status: "active" })
        .eq("id", campaignId)
        .select()
        .single();
      if (error) throw error;

      // Trigger the queue processor
      try {
        await supabase.functions.invoke("process-campaign-queue", {
          body: { campaign_id: campaignId },
        });
      } catch (e) {
        console.error("Queue trigger error (non-blocking):", e);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["real-metrics"] });
    },
  });
}

export function usePauseCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase
        .from("campaigns")
        .update({ status: "paused" })
        .eq("id", campaignId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useCampaignMetrics() {
  return useQuery({
    queryKey: ["campaign-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("status, total_sent, total_delivered, total_opened, total_replied, total_failed, total_accepted, channel");
      if (error) throw error;
      const campaigns = data || [];
      return {
        totalCampaigns: campaigns.length,
        activeCampaigns: campaigns.filter((c) => c.status === "active").length,
        totalSent: campaigns.reduce((s, c) => s + (c.total_sent || 0), 0),
        totalDelivered: campaigns.reduce((s, c) => s + (c.total_delivered || 0), 0),
        totalOpened: campaigns.reduce((s, c) => s + (c.total_opened || 0), 0),
        totalReplied: campaigns.reduce((s, c) => s + (c.total_replied || 0), 0),
        totalFailed: campaigns.reduce((s, c) => s + (c.total_failed || 0), 0),
        totalAccepted: campaigns.reduce((s, c) => s + (c.total_accepted || 0), 0),
        byChannel: {
          whatsapp: campaigns.filter((c) => c.channel === "whatsapp").length,
          email: campaigns.filter((c) => c.channel === "email").length,
          linkedin: campaigns.filter((c) => c.channel === "linkedin").length,
        },
      };
    },
    refetchInterval: 15000,
  });
}

export function useAddLeadsToCampaign() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ campaignId, leadIds }: { campaignId: string; leadIds: string[] }) => {
      if (!user) throw new Error("Not authenticated");
      const rows = leadIds.map((lead_id) => ({
        campaign_id: campaignId,
        lead_id,
        user_id: user.id,
        status: "pending",
      }));
      const { error } = await supabase.from("campaign_leads").insert(rows);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["campaign-leads", vars.campaignId] });
    },
  });
}
