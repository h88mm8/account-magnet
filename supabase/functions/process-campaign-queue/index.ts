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

  const UNIPILE_BASE_URL = Deno.env.get("UNIPILE_BASE_URL");
  const UNIPILE_API_KEY = Deno.env.get("UNIPILE_API_KEY");
  const UNIPILE_ACCOUNT_ID = Deno.env.get("UNIPILE_ACCOUNT_ID");

  try {
    // Optionally filter by a single campaign
    let campaignFilter: string | null = null;
    try {
      const body = await req.json();
      campaignFilter = body?.campaign_id || null;
    } catch { /* no body */ }

    // Get active campaigns
    let query = supabase.from("campaigns").select("*").eq("status", "active");
    if (campaignFilter) query = query.eq("id", campaignFilter);

    const { data: campaigns, error: campErr } = await query;
    if (campErr) throw campErr;
    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No active campaigns" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalProcessed = 0;
    const results: Array<{ campaign_id: string; sent: number; failed: number; errors: string[] }> = [];

    for (const campaign of campaigns) {
      const campResult = { campaign_id: campaign.id, sent: 0, failed: 0, errors: [] as string[] };

      // WhatsApp: validate user has active connection
      if (campaign.channel === "whatsapp") {
        const { data: waConn } = await supabase
          .from("whatsapp_connections")
          .select("status, unipile_account_id")
          .eq("user_id", campaign.user_id)
          .eq("status", "connected")
          .single();

        if (!waConn || !waConn.unipile_account_id) {
          campResult.errors.push("WhatsApp not connected for this user");
          // Mark all pending leads as failed with connection error
          await supabase
            .from("campaign_leads")
            .update({
              status: "failed",
              failed_at: new Date().toISOString(),
              error_message: "WhatsApp não conectado. Conecte nas Configurações.",
            })
            .eq("campaign_id", campaign.id)
            .eq("status", "pending");

          // Pause the campaign
          await supabase
            .from("campaigns")
            .update({ status: "paused" })
            .eq("id", campaign.id);

          results.push(campResult);
          continue;
        }
      }

      // Count sent today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: sentToday } = await supabase
        .from("campaign_leads")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .gte("sent_at", todayStart.toISOString());

      const remaining = campaign.daily_limit - (sentToday || 0);
      if (remaining <= 0) {
        campResult.errors.push("Daily limit reached");
        results.push(campResult);
        continue;
      }

      // Get pending leads
      const { data: pendingLeads } = await supabase
        .from("campaign_leads")
        .select("id, lead_id")
        .eq("campaign_id", campaign.id)
        .eq("status", "pending")
        .limit(remaining);

      if (!pendingLeads || pendingLeads.length === 0) {
        // Check if campaign is complete
        const { count: pendingCount } = await supabase
          .from("campaign_leads")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaign.id)
          .in("status", ["pending", "queued"]);

        if (pendingCount === 0) {
          await supabase.from("campaigns").update({ status: "completed" }).eq("id", campaign.id);
        }
        results.push(campResult);
        continue;
      }

      // Move to queued
      const leadIds = pendingLeads.map((l) => l.id);
      await supabase.from("campaign_leads").update({ status: "queued" }).in("id", leadIds);

      // Get WhatsApp account_id for WhatsApp campaigns
      let waAccountId: string | null = null;
      if (campaign.channel === "whatsapp") {
        const { data: waConn } = await supabase
          .from("whatsapp_connections")
          .select("unipile_account_id")
          .eq("user_id", campaign.user_id)
          .eq("status", "connected")
          .single();
        waAccountId = waConn?.unipile_account_id || null;
      }

      // Process each lead
      for (const lead of pendingLeads) {
        try {
          const { data: leadData } = await supabase
            .from("prospect_list_items")
            .select("name, email, phone, linkedin_url")
            .eq("id", lead.lead_id)
            .single();

          if (!leadData) {
            await supabase.from("campaign_leads").update({
              status: "failed", failed_at: new Date().toISOString(), error_message: "Lead not found",
            }).eq("id", lead.id);
            campResult.failed++;
            continue;
          }

          let success = false;
          let errorMsg = "";

          if (campaign.channel === "email") {
            if (!leadData.email) {
              errorMsg = "Sem endereço de email";
            } else if (!UNIPILE_BASE_URL || !UNIPILE_API_KEY) {
              errorMsg = "Provedor de email não configurado";
            } else {
              const message = (campaign.message_template || "").replace(/\{\{name\}\}/g, leadData.name || "");
              const resp = await fetch(`${UNIPILE_BASE_URL}/api/v1/emails`, {
                method: "POST",
                headers: { "X-API-KEY": UNIPILE_API_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({
                  to: leadData.email,
                  subject: campaign.subject || "Hello",
                  body: message,
                }),
              });
              if (resp.ok) {
                success = true;
              } else {
                const errBody = await resp.text().catch(() => "");
                errorMsg = `Email API error: ${resp.status} - ${errBody.slice(0, 200)}`;
              }
            }
          } else if (campaign.channel === "whatsapp") {
            if (!leadData.phone) {
              errorMsg = "Sem número de telefone";
            } else if (!UNIPILE_BASE_URL || !UNIPILE_API_KEY || !waAccountId) {
              errorMsg = "WhatsApp não configurado";
            } else {
              const message = (campaign.message_template || "").replace(/\{\{name\}\}/g, leadData.name || "");
              const resp = await fetch(`${UNIPILE_BASE_URL}/api/v1/messages`, {
                method: "POST",
                headers: { "X-API-KEY": UNIPILE_API_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({
                  attendee_provider_id: leadData.phone.replace(/\D/g, ""),
                  text: message,
                  account_id: waAccountId,
                  provider: "WHATSAPP",
                }),
              });
              if (resp.ok) {
                success = true;
              } else {
                const errBody = await resp.text().catch(() => "");
                errorMsg = `WhatsApp API error: ${resp.status} - ${errBody.slice(0, 200)}`;
                console.error("WhatsApp send error:", resp.status, errBody);
              }
            }
          } else if (campaign.channel === "linkedin") {
            if (!leadData.linkedin_url) {
              errorMsg = "Sem URL do LinkedIn";
            } else if (!UNIPILE_BASE_URL || !UNIPILE_API_KEY) {
              errorMsg = "LinkedIn não configurado";
            } else {
              const message = (campaign.message_template || "").replace(/\{\{name\}\}/g, leadData.name || "");
              if (campaign.linkedin_type === "connection_request") {
                const resp = await fetch(`${UNIPILE_BASE_URL}/api/v1/users/invite`, {
                  method: "POST",
                  headers: { "X-API-KEY": UNIPILE_API_KEY, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    provider_id: leadData.linkedin_url,
                    account_id: UNIPILE_ACCOUNT_ID,
                    message: message || undefined,
                  }),
                });
                if (resp.ok) { success = true; } else {
                  const errBody = await resp.text().catch(() => "");
                  errorMsg = `LinkedIn invite error: ${resp.status} - ${errBody.slice(0, 200)}`;
                }
              } else {
                const resp = await fetch(`${UNIPILE_BASE_URL}/api/v1/messages`, {
                  method: "POST",
                  headers: { "X-API-KEY": UNIPILE_API_KEY, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    attendee_provider_id: leadData.linkedin_url,
                    text: message,
                    account_id: UNIPILE_ACCOUNT_ID,
                    provider: "LINKEDIN",
                  }),
                });
                if (resp.ok) { success = true; } else {
                  const errBody = await resp.text().catch(() => "");
                  errorMsg = `LinkedIn message error: ${resp.status} - ${errBody.slice(0, 200)}`;
                }
              }
            }
          }

          if (success) {
            await supabase.from("campaign_leads").update({
              status: "sent", sent_at: new Date().toISOString(),
            }).eq("id", lead.id);

            // Update campaign counters directly
            await supabase.from("campaigns").update({
              total_sent: (campaign.total_sent || 0) + campResult.sent + 1,
            }).eq("id", campaign.id);

            campResult.sent++;
            totalProcessed++;
          } else {
            await supabase.from("campaign_leads").update({
              status: "failed", failed_at: new Date().toISOString(), error_message: errorMsg,
            }).eq("id", lead.id);

            await supabase.from("campaigns").update({
              total_failed: (campaign.total_failed || 0) + campResult.failed + 1,
            }).eq("id", campaign.id);

            campResult.failed++;
            campResult.errors.push(errorMsg);
          }
        } catch (err) {
          await supabase.from("campaign_leads").update({
            status: "failed", failed_at: new Date().toISOString(), error_message: err.message,
          }).eq("id", lead.id);
          campResult.failed++;
        }
      }

      results.push(campResult);
    }

    return new Response(JSON.stringify({ processed: totalProcessed, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("process-campaign-queue error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
