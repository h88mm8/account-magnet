import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ──────────────────────────────────────────────
// URL Tracking helpers
// ──────────────────────────────────────────────
function generateShortCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function wrapUrlsInMessage(
  supabase: ReturnType<typeof createClient>,
  message: string,
  userId: string,
  leadId: string,
  campaignLeadId: string,
  supabaseProjectId: string
): Promise<string> {
  const URL_REGEX = /(https?:\/\/[^\s]+)/gi;
  const urls = message.match(URL_REGEX);
  if (!urls || urls.length === 0) return message;

  let result = message;
  for (const originalUrl of urls) {
    // Generate unique short code with collision retry
    let shortCode = generateShortCode();
    let attempts = 0;
    while (attempts < 5) {
      const { count } = await supabase
        .from("link_tracking")
        .select("id", { count: "exact", head: true })
        .eq("short_code", shortCode);
      if ((count ?? 0) === 0) break;
      shortCode = generateShortCode();
      attempts++;
    }

    const { error } = await supabase.from("link_tracking").insert({
      user_id: userId,
      lead_id: leadId,
      campaign_lead_id: campaignLeadId,
      original_url: originalUrl,
      short_code: shortCode,
    });

    if (error) {
      console.error(`[TRACKING] Failed to insert tracking for ${originalUrl}:`, error.message);
      continue; // keep original URL if tracking insert fails
    }

    const trackingUrl = `https://${supabaseProjectId}.supabase.co/functions/v1/redirect-link/r/${shortCode}`;
    result = result.replace(originalUrl, trackingUrl);
    console.log(`[TRACKING] Wrapped URL: ${originalUrl} -> ${trackingUrl}`);
  }
  return result;
}


function extractLinkedInId(url: string): string {
  if (!url.includes("/")) return url;
  // Sales Navigator lead ID
  const salesMatch = url.match(/\/sales\/lead\/([^,/?#]+)/);
  if (salesMatch) return salesMatch[1];
  // Standard profile
  const match = url.match(/\/in\/([^/?#]+)/);
  return match ? match[1] : url;
}

/**
 * Resolve LinkedIn provider_id via Unipile user lookup
 */
async function resolveLinkedInProviderId(
  linkedinIdentifier: string,
  baseUrl: string,
  apiKey: string,
  accountId: string
): Promise<string | null> {
  try {
    console.log(`[RESOLVE] Looking up provider_id for: ${linkedinIdentifier}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(
      `${baseUrl}/api/v1/users/${encodeURIComponent(linkedinIdentifier)}?account_id=${accountId}`,
      {
        method: "GET",
        headers: {
          "X-API-KEY": apiKey,
          "accept": "application/json",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      console.error(`[RESOLVE_FAIL] Lookup failed [${resp.status}]: ${errBody.slice(0, 200)}`);
      return null;
    }

    const data = await resp.json();
    const providerId = data.provider_id || data.id || null;
    console.log(`[RESOLVE] Got provider_id: ${providerId}`);
    return providerId;
  } catch (e) {
    console.error(`[RESOLVE_FAIL] ${e.message}`);
    return null;
  }
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
  const UNIPILE_ACCOUNT_ID = Deno.env.get("UNIPILE_ACCOUNT_ID"); // fallback for search, not campaigns
  const SUPABASE_PROJECT_ID = Deno.env.get("SUPABASE_URL")?.match(/https:\/\/([^.]+)\./)?.[1] ?? "";

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
    const results: Array<{ campaign_id: string; sent: number; failed: number; invalid: number; errors: string[] }> = [];

    for (const campaign of campaigns) {
      const campResult = { campaign_id: campaign.id, sent: 0, failed: 0, invalid: 0, errors: [] as string[] };

      // ---- Resolve per-user account IDs for each channel ----
      let channelAccountId: string | null = null;

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
        channelAccountId = waConn.unipile_account_id;
      } else if (campaign.channel === "linkedin" || campaign.channel === "email") {
        // Use per-user integration account
        const { data: integration } = await supabase
          .from("user_integrations")
          .select("status, unipile_account_id")
          .eq("user_id", campaign.user_id)
          .eq("provider", campaign.channel)
          .eq("status", "connected")
          .single();

        if (!integration || !integration.unipile_account_id) {
          const label = campaign.channel === "linkedin" ? "LinkedIn" : "Email";
          campResult.errors.push(`${label} not connected for this user`);
          await supabase
            .from("campaign_leads")
            .update({
              status: "failed",
              failed_at: new Date().toISOString(),
              error_message: `${label} não conectado. Conecte nas Configurações.`,
            })
            .eq("campaign_id", campaign.id)
            .eq("status", "pending");
          await supabase.from("campaigns").update({ status: "paused" }).eq("id", campaign.id);
          results.push(campResult);
          continue;
        }
        channelAccountId = integration.unipile_account_id;
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
        await supabase.from("campaign_leads").update({ status: "queued" }).eq("id", lead.id);

        try {
          const { data: leadData } = await supabase
            .from("prospect_list_items")
            .select("name, email, phone, linkedin_url, provider_id")
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
            } else if (!UNIPILE_BASE_URL || !UNIPILE_API_KEY || !channelAccountId) {
              errorMsg = "Provedor de email não configurado";
            } else {
              // Personalise template variables
              let rawMessage = (campaign.message_template || "")
                .replace(/\{\{FIRST_NAME\}\}/gi, (leadData.name || "").split(" ")[0] || "")
                .replace(/\{\{LAST_NAME\}\}/gi, (leadData.name || "").split(" ").slice(1).join(" ") || "")
                .replace(/\{\{NAME\}\}/gi, leadData.name || "")
                .replace(/\{\{name\}\}/gi, leadData.name || "")
                .replace(/\{\{EMAIL\}\}/gi, leadData.email || "")
                .replace(/\{\{COMPANY\}\}/gi, leadData.company || "");

              // Replace {{TRACKING_URL}} token with site URL + contact_id
              const siteBase = Deno.env.get("TRACKING_SITE_URL") || "https://account-magnet.lovable.app";
              const trackingUrlForLead = `${siteBase}/?contact_id=${lead.lead_id}`;
              rawMessage = rawMessage.replace(/\{\{TRACKING_URL\}\}/g, trackingUrlForLead);

              // Inject contact_id into ALL external links (except mailto: and anchors)
              rawMessage = rawMessage.replace(
                /href="(https?:\/\/[^"]+)"/gi,
                (match, url) => {
                  // Skip already-processed tracking URLs and supabase redirect URLs
                  if (url.includes("contact_id=") || url.includes("supabase.co/functions")) return match;
                  try {
                    const parsed = new URL(url);
                    parsed.searchParams.set("contact_id", lead.lead_id);
                    return `href="${parsed.toString()}"`;
                  } catch {
                    return match;
                  }
                }
              );

              // Wrap all URLs in message with short tracking codes
              const message = await wrapUrlsInMessage(supabase, rawMessage, campaign.user_id, lead.lead_id, lead.id, SUPABASE_PROJECT_ID);

              // Append email signature if configured
              const { data: emailSettings } = await supabase
                .from("email_settings" as any)
                .select("email_signature")
                .eq("user_id", campaign.user_id)
                .single();
              const signature = (emailSettings as any)?.email_signature;
              const finalBody = signature
                ? `${message}\n\n<br/><br/><div style="border-top:1px solid #e2e8f0;padding-top:12px;color:#64748b;font-size:13px;">${signature}</div>`
                : message;

              try {
                console.log(`[SEND] Email to ${leadData.email} via account ${channelAccountId}`);
                const formData = new FormData();
                formData.append("account_id", channelAccountId);
                formData.append("to", JSON.stringify([{ identifier: leadData.email, display_name: leadData.name || "" }]));
                formData.append("subject", campaign.subject || "Hello");
                formData.append("body", finalBody);
                const resp = await fetch(`${UNIPILE_BASE_URL}/api/v1/emails`, {
                  method: "POST",
                  headers: {
                    "X-API-KEY": UNIPILE_API_KEY,
                    "accept": "application/json",
                  },
                  body: formData,
                });
                if (resp.ok) {
                  success = true;
                  console.log(`[SEND] Email sent successfully`);
                } else {
                  const errBody = await resp.text().catch(() => "");
                  errorMsg = `Email API error [${resp.status}]: ${errBody.slice(0, 200)}`;
                  console.error(`[SEND_FAIL] ${errorMsg}`);
                }
              } catch (e) {
                errorMsg = `Email request failed: ${e.message}`;
                console.error(`[SEND_FAIL] ${errorMsg}`);
              }
            }
          }

          // ============ WHATSAPP — delegated to unipile-messages ============
          else if (campaign.channel === "whatsapp") {
            if (!leadData.phone) {
              errorMsg = "Sem número de telefone";
            } else {
              const message = (campaign.message_template || "").replace(/\{\{name\}\}/g, leadData.name || "");
              try {
                console.log(`[SEND] Delegating WhatsApp send to unipile-messages for lead ${lead.lead_id}`);
                const msgResp = await fetch(
                  `${Deno.env.get("SUPABASE_URL")}/functions/v1/unipile-messages`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "apikey": Deno.env.get("SUPABASE_ANON_KEY") || "",
                      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                    },
                    body: JSON.stringify({
                      userId: campaign.user_id,
                      phone: leadData.phone,
                      content: message,
                      campaignId: campaign.id,
                      campaignLeadId: lead.id,
                      leadId: lead.lead_id,
                      messageType: "text",
                    }),
                  }
                );
                const msgData = await msgResp.json().catch(() => ({}));
                if (msgData.success) {
                  success = true;
                  console.log(`[SEND] WhatsApp sent via unipile-messages. msg_id=${msgData.message_id}`);
                } else {
                  errorMsg = msgData.error || "unipile-messages returned failure";
                  console.error(`[SEND_FAIL] ${errorMsg}`);
                }
              } catch (e) {
                errorMsg = `WhatsApp delegation failed: ${e.message}`;
                console.error(`[SEND_FAIL] ${errorMsg}`);
              }
            }
          }

          // ============ LINKEDIN ============
          else if (campaign.channel === "linkedin") {
            if (!leadData.linkedin_url) {
              errorMsg = "Sem URL do LinkedIn";
            } else if (!UNIPILE_BASE_URL || !UNIPILE_API_KEY || !channelAccountId) {
              errorMsg = "LinkedIn não configurado";
            } else {
              // --- Provider ID Resolution ---
              let resolvedProviderId = leadData.provider_id;

              if (!resolvedProviderId) {
                const linkedinIdentifier = extractLinkedInId(leadData.linkedin_url);
                resolvedProviderId = await resolveLinkedInProviderId(
                  linkedinIdentifier,
                  UNIPILE_BASE_URL,
                  UNIPILE_API_KEY,
                  channelAccountId
                );

                if (!resolvedProviderId) {
                  // Mark as invalid (distinct from send failure)
                  await markInvalid(supabase, lead.id, campaign.id, "Perfil LinkedIn não encontrado na resolução");
                  campResult.invalid++;
                  continue;
                }

                // Cache provider_id for future use
                await supabase
                  .from("prospect_list_items")
                  .update({ provider_id: resolvedProviderId })
                  .eq("id", lead.lead_id);
                console.log(`[RESOLVE] Cached provider_id ${resolvedProviderId} for lead ${lead.lead_id}`);
              }

              const rawMessage = (campaign.message_template || "").replace(/\{\{name\}\}/g, leadData.name || "");
              const message = await wrapUrlsInMessage(supabase, rawMessage, campaign.user_id, lead.lead_id, lead.id, SUPABASE_PROJECT_ID);

              try {
                if (campaign.linkedin_type === "connection_request") {
                  console.log(`[SEND] LinkedIn invite to ${resolvedProviderId} via account ${channelAccountId}`);
                  const body: Record<string, string> = {
                    provider_id: resolvedProviderId,
                    account_id: channelAccountId,
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
                    console.log(`[SEND] LinkedIn invite sent successfully`);
                  } else {
                    const errBody = await resp.text().catch(() => "");
                    errorMsg = `LinkedIn invite error [${resp.status}]: ${errBody.slice(0, 200)}`;
                    console.error(`[SEND_FAIL] ${errorMsg}`);
                  }
                } else if (campaign.linkedin_type === "inmail") {
                  console.log(`[SEND] LinkedIn InMail to ${resolvedProviderId} via account ${channelAccountId}`);
                  const formData = new FormData();
                  formData.append("account_id", channelAccountId);
                  formData.append("text", message);
                  formData.append("attendees_ids", resolvedProviderId);
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
                    console.log(`[SEND] LinkedIn InMail sent successfully`);
                  } else {
                    const errBody = await resp.text().catch(() => "");
                    errorMsg = `LinkedIn InMail error [${resp.status}]: ${errBody.slice(0, 200)}`;
                    console.error(`[SEND_FAIL] ${errorMsg}`);
                  }
                } else {
                  // message to existing connection
                  console.log(`[SEND] LinkedIn message to ${resolvedProviderId} via account ${channelAccountId}`);
                  const formData = new FormData();
                  formData.append("account_id", channelAccountId);
                  formData.append("text", message);
                  formData.append("attendees_ids", resolvedProviderId);

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
                    console.log(`[SEND] LinkedIn message sent successfully`);
                  } else {
                    const errBody = await resp.text().catch(() => "");
                    errorMsg = `LinkedIn message error [${resp.status}]: ${errBody.slice(0, 200)}`;
                    console.error(`[SEND_FAIL] ${errorMsg}`);
                  }
                }
              } catch (e) {
                errorMsg = `LinkedIn request failed: ${e.message}`;
                console.error(`[SEND_FAIL] ${errorMsg}`);
              }
            }
          }

          // Update lead status and campaign counters
          if (success) {
            await supabase.from("campaign_leads").update({
              status: "sent",
              sent_at: new Date().toISOString(),
            }).eq("id", lead.id);

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

async function markInvalid(supabase: any, leadId: string, campaignId: string, errorMsg: string) {
  await supabase.from("campaign_leads").update({
    status: "invalid",
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
