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
    console.log("[WEBHOOK-INTEGRATION] Received:", JSON.stringify(body));

    // Unipile webhook payloads can use different field names
    const event = body.event || body.type || body.status || "";
    const data = body.data || body;
    const accountId = data.account_id || body.account_id || data.id || "";
    const accountName = data.name || body.name || "";
    const accountType = data.account_type || body.account_type || "";

    // Parse provider and user_id from name pattern: "provider-userId"
    let provider = "";
    let userId = "";
    
    if (accountName) {
      const parts = accountName.split("-");
      if (parts.length >= 2) {
        provider = parts[0]; // "linkedin" or "email"  
        userId = parts.slice(1).join("-"); // UUID may contain dashes
      }
    }

    console.log(`[WEBHOOK-INTEGRATION] Event/Status: ${event}, Provider: ${provider}, User: ${userId}, AccountId: ${accountId}, AccountType: ${accountType}`);

    if (!provider || !userId) {
      console.log("[WEBHOOK-INTEGRATION] Could not parse provider/user from name, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize event string for matching
    const normalizedEvent = event.toUpperCase().replace(/[.\-_]/g, "");

    // Handle connection success
    // Unipile sends: status="CREATION_SUCCESS", event="account.created", "account.connected", etc.
    const isConnected = [
      "CREATIONSUCCESS",
      "ACCOUNTCREATED",
      "ACCOUNTCONNECTED",
      "ACCOUNTCREATED",
      "CONNECTED",
    ].includes(normalizedEvent);

    if (isConnected) {
      const { error } = await supabase
        .from("user_integrations")
        .upsert(
          {
            user_id: userId,
            provider,
            status: "connected",
            unipile_account_id: accountId,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider" }
        );

      if (error) {
        console.error(`[WEBHOOK-INTEGRATION] DB upsert error:`, error);
      } else {
        console.log(`[WEBHOOK-INTEGRATION] ✅ ${provider} connected for user ${userId}, account ${accountId}`);
      }
    }

    // Handle disconnection
    const isDisconnected = [
      "ACCOUNTDISCONNECTED",
      "ACCOUNTDISCONNECTED",
      "DISCONNECTED",
    ].includes(normalizedEvent);

    if (isDisconnected) {
      await supabase
        .from("user_integrations")
        .update({
          status: "disconnected",
          unipile_account_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("provider", provider);

      console.log(`[WEBHOOK-INTEGRATION] ${provider} disconnected for user ${userId}`);
    }

    // Handle expired
    const isExpired = [
      "ACCOUNTEXPIRED",
      "EXPIRED",
    ].includes(normalizedEvent);

    if (isExpired) {
      await supabase
        .from("user_integrations")
        .update({
          status: "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("provider", provider);

      console.log(`[WEBHOOK-INTEGRATION] ${provider} expired for user ${userId}`);
    }

    // Handle creation failure
    const isFailed = [
      "CREATIONFAILED",
      "CREATIONFAILURE",
      "ACCOUNTFAILED",
    ].includes(normalizedEvent);

    if (isFailed) {
      await supabase
        .from("user_integrations")
        .update({
          status: "disconnected",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("provider", provider);

      console.log(`[WEBHOOK-INTEGRATION] ${provider} creation failed for user ${userId}`);
    }

    // ── Email reply / delivered / opened events ─────────────────────────────
    // Unipile sends events like: email.replied, email.opened, email.delivered, message_reply, etc.
    // These events carry data.email (sender), data.subject, data.message_id or data.original_message_id
    const isEmailReply = [
      "EMAILREPLIED",
      "EMAILREPLY",
      "MESSAGEREPLY",
      "REPLY",
    ].some((e) => normalizedEvent.includes(e));

    const isEmailDelivered = [
      "EMAILDELIVERED",
      "MESSAGEDELIVERED",
      "DELIVERED",
    ].some((e) => normalizedEvent.includes(e) && !isEmailReply);

    const isEmailOpened = [
      "EMAILOPENED",
      "MESSAGEOPENED",
      "OPENED",
    ].some((e) => normalizedEvent.includes(e) && !isEmailReply && !isEmailDelivered);

    const isEmailBounced = [
      "EMAILBOUNCED",
      "EMAILFAILED",
      "MESSAGEFAILED",
      "BOUNCED",
      "BOUNCE",
      "HARD_BOUNCE",
      "SOFT_BOUNCE",
    ].some((e) => normalizedEvent.includes(e));

    // ── Handle bounce → auto-blocklist ──
    if (isEmailBounced && provider === "email" && userId) {
      console.log(`[WEBHOOK-INTEGRATION] Email bounce event: ${event} for user ${userId}`);
      const bouncedEmail = (data.to || data.recipient || data.email || "").toLowerCase().trim();
      if (bouncedEmail) {
        try {
          const { data: existing } = await supabase
            .from("email_blocklist")
            .select("id, bounce_count")
            .eq("user_id", userId)
            .eq("email", bouncedEmail)
            .maybeSingle();

          if (existing) {
            await supabase.from("email_blocklist").update({
              bounce_count: existing.bounce_count + 1,
              reason: existing.bounce_count + 1 >= 3 ? "bounce_auto" : "bounce",
            }).eq("id", existing.id);
          } else {
            await supabase.from("email_blocklist").insert({
              user_id: userId,
              email: bouncedEmail,
              reason: "bounce",
              bounce_count: 1,
            });
          }
          console.log(`[WEBHOOK-INTEGRATION] Bounce registered for ${bouncedEmail} (user ${userId})`);
        } catch (blErr) {
          console.error(`[WEBHOOK-INTEGRATION] Failed to register bounce:`, blErr.message);
        }
      }
    }

    if ((isEmailReply || isEmailDelivered || isEmailOpened) && provider === "email") {
      console.log(`[WEBHOOK-INTEGRATION] Email event: ${event} for user ${userId}`);

      // Extract the sender/recipient email to match against leads
      const senderEmail = data.from || data.sender || data.from_address || data.email || "";
      const messageId = data.message_id || data.id || data.original_message_id || body.message_id || "";

      console.log(`[WEBHOOK-INTEGRATION] Email event details — sender: ${senderEmail}, messageId: ${messageId}`);

      // Find matching campaign_lead by lead email
      let matchedLeadIds: string[] = [];

      if (senderEmail) {
        const { data: leads } = await supabase
          .from("prospect_list_items")
          .select("id, email")
          .eq("user_id", userId)
          .ilike("email", senderEmail.trim());

        if (leads && leads.length > 0) {
          matchedLeadIds = leads.map((l) => l.id);
          console.log(`[WEBHOOK-INTEGRATION] Matched ${matchedLeadIds.length} lead(s) by email: ${senderEmail}`);
        }
      }

      // Fallback: match by campaign_lead message tracking (unipile_message_id / content)
      if (matchedLeadIds.length === 0 && messageId) {
        // Try to find the original sent message and extract lead_id
        const { data: sentMsg } = await supabase
          .from("messages_sent")
          .select("lead_id, campaign_lead_id")
          .eq("unipile_message_id", messageId)
          .eq("user_id", userId)
          .maybeSingle();

        if (sentMsg?.lead_id) {
          matchedLeadIds = [sentMsg.lead_id];
          console.log(`[WEBHOOK-INTEGRATION] Matched lead via messages_sent: ${sentMsg.lead_id}`);
        }
      }

      if (matchedLeadIds.length > 0) {
        const now = new Date().toISOString();

        if (isEmailReply) {
          // Update campaign_leads status to replied
          const { data: updated } = await supabase
            .from("campaign_leads")
            .update({
              status: "replied",
              replied_at: now,
              webhook_data: body,
            })
            .in("lead_id", matchedLeadIds)
            .eq("user_id", userId)
            .in("status", ["sent", "delivered", "opened"])
            .select("campaign_id");

          if (updated && updated.length > 0) {
            console.log(`[WEBHOOK-INTEGRATION] Marked ${updated.length} campaign_lead(s) as replied`);

            // Increment campaigns.total_replied per campaign
            const campaignIds = [...new Set(updated.map((l) => l.campaign_id as string))];
            for (const cid of campaignIds) {
              const count = updated.filter((l) => l.campaign_id === cid).length;
              const { data: camp } = await supabase
                .from("campaigns")
                .select("total_replied")
                .eq("id", cid)
                .single();
              if (camp) {
                await supabase
                  .from("campaigns")
                  .update({ total_replied: (camp.total_replied || 0) + count })
                  .eq("id", cid);
                console.log(`[WEBHOOK-INTEGRATION] Campaign ${cid} total_replied += ${count}`);
              }
            }
          } else {
            console.warn(`[WEBHOOK-INTEGRATION] No campaign_leads updated for leads: ${matchedLeadIds}`);
          }

        } else if (isEmailDelivered) {
          const { data: updated } = await supabase
            .from("campaign_leads")
            .update({
              status: "delivered",
              delivered_at: now,
              webhook_data: body,
            })
            .in("lead_id", matchedLeadIds)
            .eq("user_id", userId)
            .eq("status", "sent")
            .select("campaign_id");

          if (updated && updated.length > 0) {
            const campaignIds = [...new Set(updated.map((l) => l.campaign_id as string))];
            for (const cid of campaignIds) {
              const count = updated.filter((l) => l.campaign_id === cid).length;
              const { data: camp } = await supabase
                .from("campaigns")
                .select("total_delivered")
                .eq("id", cid)
                .single();
              if (camp) {
                await supabase
                  .from("campaigns")
                  .update({ total_delivered: (camp.total_delivered || 0) + count })
                  .eq("id", cid);
              }
            }
            console.log(`[WEBHOOK-INTEGRATION] Marked ${updated.length} campaign_lead(s) as delivered`);
          }

        } else if (isEmailOpened) {
          const { data: updated } = await supabase
            .from("campaign_leads")
            .update({
              status: "opened",
              opened_at: now,
              webhook_data: body,
            })
            .in("lead_id", matchedLeadIds)
            .eq("user_id", userId)
            .in("status", ["sent", "delivered"])
            .select("campaign_id");

          if (updated && updated.length > 0) {
            const campaignIds = [...new Set(updated.map((l) => l.campaign_id as string))];
            for (const cid of campaignIds) {
              const count = updated.filter((l) => l.campaign_id === cid).length;
              const { data: camp } = await supabase
                .from("campaigns")
                .select("total_opened")
                .eq("id", cid)
                .single();
              if (camp) {
                await supabase
                  .from("campaigns")
                  .update({ total_opened: (camp.total_opened || 0) + count })
                  .eq("id", cid);
              }
            }
            console.log(`[WEBHOOK-INTEGRATION] Marked ${updated.length} campaign_lead(s) as opened`);
          }
        }
      } else {
        console.warn(`[WEBHOOK-INTEGRATION] Could not match any lead for email event. sender: ${senderEmail}`);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[WEBHOOK-INTEGRATION] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
