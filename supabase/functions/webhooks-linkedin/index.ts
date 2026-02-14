import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    console.log("LinkedIn webhook received:", JSON.stringify(body));

    const event = body.event || body.type || "";
    const data = body.data || body;

    // Handle connection accepted events
    if (event === "connection_accepted" || event === "invitation_accepted") {
      const linkedinId = data.provider_id || data.public_identifier || data.linkedin_url || data.profile_url;

      if (linkedinId) {
        // Find leads matching this linkedin identifier (by URL or provider_id)
        const { data: leads } = await supabase
          .from("prospect_list_items")
          .select("id, linkedin_url");

        // Match by provider_id or URL containing the identifier
        const matchedLeads = (leads || []).filter((l) => {
          if (!l.linkedin_url) return false;
          return l.linkedin_url === linkedinId || l.linkedin_url.includes(linkedinId) || linkedinId.includes(l.linkedin_url.split("/in/")[1]?.split("?")[0] || "___none___");
        });

        if (matchedLeads.length > 0) {
          const leadIds = matchedLeads.map((l) => l.id);

          const { data: updatedLeads } = await supabase
            .from("campaign_leads")
            .update({
              status: "accepted",
              accepted_at: new Date().toISOString(),
              webhook_data: body,
            })
            .in("lead_id", leadIds)
            .eq("status", "sent")
            .select("campaign_id");

          // Update campaign counters
          if (updatedLeads && updatedLeads.length > 0) {
            const campaignIds = [...new Set(updatedLeads.map((l) => l.campaign_id))];
            for (const cid of campaignIds) {
              const count = updatedLeads.filter((l) => l.campaign_id === cid).length;
              const { data: campaign } = await supabase
                .from("campaigns")
                .select("total_accepted")
                .eq("id", cid)
                .single();
              if (campaign) {
                await supabase
                  .from("campaigns")
                  .update({ total_accepted: (campaign.total_accepted || 0) + count })
                  .eq("id", cid);
              }
            }
          }
        }
      }
    }

    // Handle message delivered
    if (event === "message_delivered" || event === "delivered") {
      const linkedinId = data.provider_id || data.attendee_provider_id;
      if (linkedinId) {
        const { data: leads } = await supabase
          .from("prospect_list_items")
          .select("id, linkedin_url");

        const matchedLeads = (leads || []).filter((l) =>
          l.linkedin_url && (l.linkedin_url.includes(linkedinId) || linkedinId === l.linkedin_url)
        );

        if (matchedLeads.length > 0) {
          const leadIds = matchedLeads.map((l) => l.id);
          const { data: updated } = await supabase
            .from("campaign_leads")
            .update({
              status: "delivered",
              delivered_at: new Date().toISOString(),
              webhook_data: body,
            })
            .in("lead_id", leadIds)
            .eq("status", "sent")
            .select("campaign_id");

          if (updated && updated.length > 0) {
            const campaignIds = [...new Set(updated.map((l) => l.campaign_id))];
            for (const cid of campaignIds) {
              const count = updated.filter((l) => l.campaign_id === cid).length;
              const { data: campaign } = await supabase
                .from("campaigns")
                .select("total_delivered")
                .eq("id", cid)
                .single();
              if (campaign) {
                await supabase
                  .from("campaigns")
                  .update({ total_delivered: (campaign.total_delivered || 0) + count })
                  .eq("id", cid);
              }
            }
          }
        }
      }
    }

    // Handle reply
    if (event === "message_reply" || event === "reply" || event === "new_message") {
      const linkedinId = data.provider_id || data.sender_provider_id;
      if (linkedinId) {
        const { data: leads } = await supabase
          .from("prospect_list_items")
          .select("id, linkedin_url");

        const matchedLeads = (leads || []).filter((l) =>
          l.linkedin_url && (l.linkedin_url.includes(linkedinId) || linkedinId === l.linkedin_url)
        );

        if (matchedLeads.length > 0) {
          const leadIds = matchedLeads.map((l) => l.id);
          const { data: updated } = await supabase
            .from("campaign_leads")
            .update({
              status: "replied",
              replied_at: new Date().toISOString(),
              webhook_data: body,
            })
            .in("lead_id", leadIds)
            .in("status", ["sent", "delivered", "accepted"])
            .select("campaign_id");

          if (updated && updated.length > 0) {
            const campaignIds = [...new Set(updated.map((l) => l.campaign_id))];
            for (const cid of campaignIds) {
              const count = updated.filter((l) => l.campaign_id === cid).length;
              const { data: campaign } = await supabase
                .from("campaigns")
                .select("total_replied")
                .eq("id", cid)
                .single();
              if (campaign) {
                await supabase
                  .from("campaigns")
                  .update({ total_replied: (campaign.total_replied || 0) + count })
                  .eq("id", cid);
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("LinkedIn webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
