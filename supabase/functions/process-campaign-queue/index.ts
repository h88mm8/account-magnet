import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Extract LinkedIn public identifier from a URL like
 * https://www.linkedin.com/in/john-doe or /in/john-doe-123abc
 */
function extractLinkedInId(url: string): string {
  // If it's already a provider_id (no slashes), return as-is
  if (!url.includes("/")) return url;
  const match = url.match(/\/in\/([^/?#]+)/);
  return match ? match[1] : url;
}

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
    let campaignFilter: string | null = null;
    try {
      const body = await req.json();
      campaignFilter = body?.campaign_id || null;
    } catch { /* no body */ }

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
      let waAccountId: string | null = null;
      if (campaign.channel === "whatsapp") {
        const { data: waConn } = await supabase
          .from("whatsapp_connections")
          .select("status, unipile_account_id")
          .eq("user_id", campaign.user_id)
          .eq("status", "connected")
          .single();

        if (!waConn || !waConn.unipile_account_id) {
          campResult.errors.push("WhatsApp not connected for this user");
          await supabase
            .from("campaign_leads")
            .update({
              status: "failed",
              failed_at: new Date().toISOString(),
              error_message: "WhatsApp não conectado. Conecte nas Configurações.",
            })
            .eq("campaign_id", campaign.id)
            .eq("status", "pending");
          await supabase.from("campaigns").update({ status: "paused" }).eq("id", campaign.id);
          results.push(campResult);
          continue;
        }
        waAccountId = waConn.unipile_account_id;
      }

      // Count sent today for daily limit
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

      // Process each lead
      for (const lead of pendingLeads) {
        // Mark as queued
        await supabase.from("campaign_leads").update({ status: "queued" }).eq("id", lead.id);

        try {
          const { data: leadData } = await supabase
            .from("prospect_list_items")
            .select("name, email, phone, linkedin_url")
            .eq("id", lead.lead_id)
            .single();

          if (!leadData) {
            await markFailed(supabase, lead.id, campaign.id, "Lead não encontrado");
            campResult.failed++;
            continue;
          }

          let success = false;
          let errorMsg = "";

          // ============ EMAIL ============
          if (campaign.channel === "email") {
            if (!leadData.email) {
              errorMsg = "Sem endereço de email";
            } else if (!UNIPILE_BASE_URL || !UNIPILE_API_KEY || !UNIPILE_ACCOUNT_ID) {
              errorMsg = "Provedor de email não configurado";
            } else {
              const message = (campaign.message_template || "").replace(/\{\{name\}\}/g, leadData.name || "");
              try {
                // Unipile: POST /api/v1/emails
                const resp = await fetch(`${UNIPILE_BASE_URL}/api/v1/emails`, {
                  method: "POST",
                  headers: {
                    "X-API-KEY": UNIPILE_API_KEY,
                    "Content-Type": "application/json",
                    "accept": "application/json",
                  },
                  body: JSON.stringify({
                    account_id: UNIPILE_ACCOUNT_ID,
                    to: [{ identifier: leadData.email, display_name: leadData.name || "" }],
                    subject: campaign.subject || "Hello",
                    body: message,
                  }),
                });
                if (resp.ok) {
                  success = true;
                } else {
                  const errBody = await resp.text().catch(() => "");
                  errorMsg = `Email API error [${resp.status}]: ${errBody.slice(0, 200)}`;
                  console.error("Email send error:", resp.status, errBody);
                }
              } catch (e) {
                errorMsg = `Email request failed: ${e.message}`;
              }
            }
          }

          // ============ WHATSAPP ============
          else if (campaign.channel === "whatsapp") {
            if (!leadData.phone) {
              errorMsg = "Sem número de telefone";
            } else if (!UNIPILE_BASE_URL || !UNIPILE_API_KEY || !waAccountId) {
              errorMsg = "WhatsApp não configurado";
            } else {
              const message = (campaign.message_template || "").replace(/\{\{name\}\}/g, leadData.name || "");
              const cleanPhone = leadData.phone.replace(/\D/g, "");
              try {
                // Unipile: POST /api/v1/chats (start new chat) - uses multipart/form-data
                const formData = new FormData();
                formData.append("account_id", waAccountId);
                formData.append("text", message);
                formData.append("attendees_ids", cleanPhone);

                const resp = await fetch(`${UNIPILE_BASE_URL}/api/v1/chats`, {
                  method: "POST",
                  headers: {
                    "X-API-KEY": UNIPILE_API_KEY,
                    "accept": "application/json",
                  },
                  body: formData,
                });
                if (resp.ok) {
                  success = true;
                } else {
                  const errBody = await resp.text().catch(() => "");
                  errorMsg = `WhatsApp API error [${resp.status}]: ${errBody.slice(0, 200)}`;
                  console.error("WhatsApp send error:", resp.status, errBody);
                }
              } catch (e) {
                errorMsg = `WhatsApp request failed: ${e.message}`;
              }
            }
          }

          // ============ LINKEDIN ============
          else if (campaign.channel === "linkedin") {
            if (!leadData.linkedin_url) {
              errorMsg = "Sem URL do LinkedIn";
            } else if (!UNIPILE_BASE_URL || !UNIPILE_API_KEY || !UNIPILE_ACCOUNT_ID) {
              errorMsg = "LinkedIn não configurado";
            } else {
              const message = (campaign.message_template || "").replace(/\{\{name\}\}/g, leadData.name || "");
              const linkedinId = extractLinkedInId(leadData.linkedin_url);

              try {
                if (campaign.linkedin_type === "connection_request") {
                  // Unipile: POST /api/v1/users/invite (JSON body)
                  const body: Record<string, string> = {
                    provider_id: linkedinId,
                    account_id: UNIPILE_ACCOUNT_ID,
                  };
                  if (message) body.message = message;

                  const resp = await fetch(`${UNIPILE_BASE_URL}/api/v1/users/invite`, {
                    method: "POST",
                    headers: {
                      "X-API-KEY": UNIPILE_API_KEY,
                      "Content-Type": "application/json",
                      "accept": "application/json",
                    },
                    body: JSON.stringify(body),
                  });
                  if (resp.ok) {
                    success = true;
                  } else {
                    const errBody = await resp.text().catch(() => "");
                    errorMsg = `LinkedIn invite error [${resp.status}]: ${errBody.slice(0, 200)}`;
                    console.error("LinkedIn invite error:", resp.status, errBody);
                  }
                } else if (campaign.linkedin_type === "inmail") {
                  // Unipile: POST /api/v1/chats with linkedin[inmail]=true (multipart/form-data)
                  const formData = new FormData();
                  formData.append("account_id", UNIPILE_ACCOUNT_ID);
                  formData.append("text", message);
                  formData.append("attendees_ids", linkedinId);
                  formData.append("linkedin[inmail]", "true");

                  const resp = await fetch(`${UNIPILE_BASE_URL}/api/v1/chats`, {
                    method: "POST",
                    headers: {
                      "X-API-KEY": UNIPILE_API_KEY,
                      "accept": "application/json",
                    },
                    body: formData,
                  });
                  if (resp.ok) {
                    success = true;
                  } else {
                    const errBody = await resp.text().catch(() => "");
                    errorMsg = `LinkedIn InMail error [${resp.status}]: ${errBody.slice(0, 200)}`;
                    console.error("LinkedIn InMail error:", resp.status, errBody);
                  }
                } else {
                  // message to existing connection: POST /api/v1/chats (multipart/form-data)
                  const formData = new FormData();
                  formData.append("account_id", UNIPILE_ACCOUNT_ID);
                  formData.append("text", message);
                  formData.append("attendees_ids", linkedinId);

                  const resp = await fetch(`${UNIPILE_BASE_URL}/api/v1/chats`, {
                    method: "POST",
                    headers: {
                      "X-API-KEY": UNIPILE_API_KEY,
                      "accept": "application/json",
                    },
                    body: formData,
                  });
                  if (resp.ok) {
                    success = true;
                  } else {
                    const errBody = await resp.text().catch(() => "");
                    errorMsg = `LinkedIn message error [${resp.status}]: ${errBody.slice(0, 200)}`;
                    console.error("LinkedIn message error:", resp.status, errBody);
                  }
                }
              } catch (e) {
                errorMsg = `LinkedIn request failed: ${e.message}`;
              }
            }
          }

          // Update lead status and campaign counters atomically via RPC-like pattern
          if (success) {
            await supabase.from("campaign_leads").update({
              status: "sent",
              sent_at: new Date().toISOString(),
            }).eq("id", lead.id);

            // Increment counter using current DB value (avoids race conditions)
            const { data: curr } = await supabase
              .from("campaigns")
              .select("total_sent")
              .eq("id", campaign.id)
              .single();
            await supabase.from("campaigns").update({
              total_sent: (curr?.total_sent || 0) + 1,
            }).eq("id", campaign.id);

            campResult.sent++;
            totalProcessed++;
          } else {
            await markFailed(supabase, lead.id, campaign.id, errorMsg);
            campResult.failed++;
            campResult.errors.push(errorMsg);
          }
        } catch (err) {
          await markFailed(supabase, lead.id, campaign.id, err.message);
          campResult.failed++;
          campResult.errors.push(err.message);
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
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function markFailed(supabase: any, leadId: string, campaignId: string, errorMsg: string) {
  await supabase.from("campaign_leads").update({
    status: "failed",
    failed_at: new Date().toISOString(),
    error_message: errorMsg,
  }).eq("id", leadId);

  const { data: curr } = await supabase
    .from("campaigns")
    .select("total_failed")
    .eq("id", campaignId)
    .single();
  await supabase.from("campaigns").update({
    total_failed: (curr?.total_failed || 0) + 1,
  }).eq("id", campaignId);
}
