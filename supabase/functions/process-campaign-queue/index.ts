import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    // Get all active campaigns
    const { data: campaigns, error: campErr } = await supabase
      .from("campaigns")
      .select("*")
      .eq("status", "active");

    if (campErr) throw campErr;
    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalProcessed = 0;

    for (const campaign of campaigns) {
      // Count how many were sent today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count: sentToday } = await supabase
        .from("campaign_leads")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .gte("sent_at", todayStart.toISOString());

      const remaining = campaign.daily_limit - (sentToday || 0);
      if (remaining <= 0) continue;

      // Get pending leads up to remaining limit
      const { data: pendingLeads, error: leadErr } = await supabase
        .from("campaign_leads")
        .select("id, lead_id")
        .eq("campaign_id", campaign.id)
        .eq("status", "pending")
        .limit(remaining);

      if (leadErr) throw leadErr;
      if (!pendingLeads || pendingLeads.length === 0) {
        // Check if all leads are processed - mark campaign complete
        const { count: pendingCount } = await supabase
          .from("campaign_leads")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaign.id)
          .in("status", ["pending", "queued"]);

        if (pendingCount === 0) {
          await supabase
            .from("campaigns")
            .update({ status: "completed" })
            .eq("id", campaign.id);
        }
        continue;
      }

      // Move to queued then process based on channel
      const leadIds = pendingLeads.map((l) => l.id);
      await supabase
        .from("campaign_leads")
        .update({ status: "queued" })
        .in("id", leadIds);

      // Channel-specific processing
      for (const lead of pendingLeads) {
        try {
          // Get lead data
          const { data: leadData } = await supabase
            .from("prospect_list_items")
            .select("name, email, phone, linkedin_url")
            .eq("id", lead.lead_id)
            .single();

          if (!leadData) {
            await supabase
              .from("campaign_leads")
              .update({ status: "failed", failed_at: new Date().toISOString(), error_message: "Lead not found" })
              .eq("id", lead.id);
            continue;
          }

          let success = false;
          let errorMsg = "";

          if (campaign.channel === "email") {
            // Email sending via Unipile
            if (!leadData.email) {
              errorMsg = "No email address";
            } else {
              const message = (campaign.message_template || "").replace(
                /\{\{name\}\}/g,
                leadData.name || ""
              );

              const unipileBaseUrl = Deno.env.get("UNIPILE_BASE_URL");
              const unipileApiKey = Deno.env.get("UNIPILE_API_KEY");

              if (unipileBaseUrl && unipileApiKey) {
                const resp = await fetch(`${unipileBaseUrl}/api/v1/emails`, {
                  method: "POST",
                  headers: {
                    "X-API-KEY": unipileApiKey,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    to: leadData.email,
                    subject: campaign.subject || "Hello",
                    body: message,
                  }),
                });

                if (resp.ok) {
                  success = true;
                } else {
                  errorMsg = `Email API error: ${resp.status}`;
                }
              } else {
                errorMsg = "Email provider not configured";
              }
            }
          } else if (campaign.channel === "whatsapp") {
            if (!leadData.phone) {
              errorMsg = "No phone number";
            } else {
              const message = (campaign.message_template || "").replace(
                /\{\{name\}\}/g,
                leadData.name || ""
              );

              const unipileBaseUrl = Deno.env.get("UNIPILE_BASE_URL");
              const unipileApiKey = Deno.env.get("UNIPILE_API_KEY");

              if (unipileBaseUrl && unipileApiKey) {
                const resp = await fetch(`${unipileBaseUrl}/api/v1/messages`, {
                  method: "POST",
                  headers: {
                    "X-API-KEY": unipileApiKey,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    attendee_provider_id: leadData.phone.replace(/\D/g, ""),
                    text: message,
                    provider: "WHATSAPP",
                  }),
                });

                if (resp.ok) {
                  success = true;
                } else {
                  errorMsg = `WhatsApp API error: ${resp.status}`;
                }
              } else {
                errorMsg = "WhatsApp provider not configured";
              }
            }
          } else if (campaign.channel === "linkedin") {
            const unipileBaseUrl = Deno.env.get("UNIPILE_BASE_URL");
            const unipileApiKey = Deno.env.get("UNIPILE_API_KEY");
            const unipileAccountId = Deno.env.get("UNIPILE_ACCOUNT_ID");

            if (!unipileBaseUrl || !unipileApiKey) {
              errorMsg = "LinkedIn provider not configured";
            } else if (!leadData.linkedin_url) {
              errorMsg = "No LinkedIn URL";
            } else {
              const message = (campaign.message_template || "").replace(
                /\{\{name\}\}/g,
                leadData.name || ""
              );

              if (campaign.linkedin_type === "connection_request") {
                const resp = await fetch(
                  `${unipileBaseUrl}/api/v1/users/invite`,
                  {
                    method: "POST",
                    headers: {
                      "X-API-KEY": unipileApiKey,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      provider_id: leadData.linkedin_url,
                      account_id: unipileAccountId,
                      message: message || undefined,
                    }),
                  }
                );
                success = resp.ok;
                if (!resp.ok) errorMsg = `LinkedIn invite error: ${resp.status}`;
              } else {
                // inmail or message
                const resp = await fetch(
                  `${unipileBaseUrl}/api/v1/messages`,
                  {
                    method: "POST",
                    headers: {
                      "X-API-KEY": unipileApiKey,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      attendee_provider_id: leadData.linkedin_url,
                      text: message,
                      account_id: unipileAccountId,
                      provider: "LINKEDIN",
                    }),
                  }
                );
                success = resp.ok;
                if (!resp.ok) errorMsg = `LinkedIn message error: ${resp.status}`;
              }
            }
          }

          // Update lead status
          if (success) {
            await supabase
              .from("campaign_leads")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", lead.id);

            // Increment campaign counter
            await supabase.rpc("increment_campaign_counter" as any, {
              p_campaign_id: campaign.id,
              p_field: "total_sent",
            }).catch(() => {
              // fallback: direct update
              supabase
                .from("campaigns")
                .update({ total_sent: campaign.total_sent + 1 })
                .eq("id", campaign.id);
            });

            totalProcessed++;
          } else {
            await supabase
              .from("campaign_leads")
              .update({
                status: "failed",
                failed_at: new Date().toISOString(),
                error_message: errorMsg,
              })
              .eq("id", lead.id);
          }
        } catch (err) {
          await supabase
            .from("campaign_leads")
            .update({
              status: "failed",
              failed_at: new Date().toISOString(),
              error_message: err.message,
            })
            .eq("id", lead.id);
        }
      }
    }

    return new Response(JSON.stringify({ processed: totalProcessed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
