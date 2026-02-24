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

    // ── Fallback: if name is missing, resolve provider/user from account_id ──
    if ((!provider || !userId) && accountId) {
      console.log(`[WEBHOOK-INTEGRATION] Name missing, looking up account_id: ${accountId}`);
      
      // Check user_integrations (linkedin/email)
      const { data: integration } = await supabase
        .from("user_integrations")
        .select("user_id, provider")
        .eq("unipile_account_id", accountId)
        .maybeSingle();

      if (integration) {
        provider = integration.provider;
        userId = integration.user_id;
        console.log(`[WEBHOOK-INTEGRATION] Resolved from user_integrations: provider=${provider}, user=${userId}`);
      } else {
        // Check whatsapp_connections
        const { data: waConn } = await supabase
          .from("whatsapp_connections")
          .select("user_id")
          .eq("unipile_account_id", accountId)
          .maybeSingle();

        if (waConn) {
          provider = "whatsapp";
          userId = waConn.user_id;
          console.log(`[WEBHOOK-INTEGRATION] Resolved from whatsapp_connections: user=${userId}`);
        }
      }
    }

    console.log(`[WEBHOOK-INTEGRATION] Event/Status: ${event}, Provider: ${provider}, User: ${userId}, AccountId: ${accountId}, AccountType: ${accountType}`);

    if (!provider || !userId) {
      console.log("[WEBHOOK-INTEGRATION] Could not resolve provider/user, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize event string for matching
    const normalizedEvent = event.toUpperCase().replace(/[.\-_]/g, "");

    // Handle connection success
    const isConnected = [
      "CREATIONSUCCESS",
      "ACCOUNTCREATED",
      "ACCOUNTCONNECTED",
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

    // ── Email event detection ─────────────────────────────
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

    const isEmailSpam = [
      "EMAILSPAM",
      "SPAMCOMPLAINT",
      "SPAM_COMPLAINT",
      "COMPLAINT",
      "SPAM",
      "MARKEDASSPAM",
    ].some((e) => normalizedEvent.includes(e));

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

    // ── Handle spam → immediate permanent block ──
    if (isEmailSpam && provider === "email" && userId) {
      console.log(`[WEBHOOK-INTEGRATION] Spam complaint event: ${event} for user ${userId}`);
      const spamEmail = (data.to || data.recipient || data.email || "").toLowerCase().trim();
      if (spamEmail) {
        try {
          const { data: existing } = await supabase
            .from("email_blocklist")
            .select("id")
            .eq("user_id", userId)
            .eq("email", spamEmail)
            .maybeSingle();

          if (existing) {
            await supabase.from("email_blocklist").update({
              bounce_count: 999,
              reason: "spam",
            }).eq("id", existing.id);
          } else {
            await supabase.from("email_blocklist").insert({
              user_id: userId,
              email: spamEmail,
              reason: "spam",
              bounce_count: 999,
            });
          }
          console.log(`[WEBHOOK-INTEGRATION] Spam block registered for ${spamEmail} (user ${userId})`);
        } catch (spamErr) {
          console.error(`[WEBHOOK-INTEGRATION] Failed to register spam block:`, spamErr.message);
        }
      }
    }

    // ── Handle email delivery & reply events ──
    if ((isEmailReply || isEmailDelivered) && (provider === "email" || accountType?.toUpperCase()?.includes("MAIL"))) {
      console.log(`[WEBHOOK-INTEGRATION] Email event: ${event} for user ${userId}`);

      // For REPLY events: the lead is the SENDER (they replied to us)
      // For DELIVERY events: the lead is the RECIPIENT (we sent to them and it was delivered)
      const replyEmail = data.from || data.sender || data.from_address || "";
      const deliveryEmail = data.to || data.recipient || data.to_address || data.email || "";
      const matchEmail = isEmailReply ? (replyEmail || deliveryEmail) : (deliveryEmail || replyEmail);
      const messageId = data.message_id || data.id || data.original_message_id || body.message_id || "";

      console.log(`[WEBHOOK-INTEGRATION] Email event details — matchEmail: ${matchEmail}, messageId: ${messageId}, isReply: ${isEmailReply}, isDelivered: ${isEmailDelivered}`);

      // Find matching campaign_lead by lead email
      let matchedLeadIds: string[] = [];

      if (matchEmail) {
        // Clean email: handle "Name <email@example.com>" format
        const cleanEmail = matchEmail.includes("<") 
          ? matchEmail.match(/<([^>]+)>/)?.[1]?.trim() || matchEmail.trim()
          : matchEmail.trim();

        const { data: leads } = await supabase
          .from("prospect_list_items")
          .select("id, email")
          .eq("user_id", userId)
          .ilike("email", cleanEmail);

        if (leads && leads.length > 0) {
          matchedLeadIds = leads.map((l) => l.id);
          console.log(`[WEBHOOK-INTEGRATION] Matched ${matchedLeadIds.length} lead(s) by email: ${cleanEmail}`);
        }
      }

      // Fallback: match by unipile_message_id in messages_sent
      if (matchedLeadIds.length === 0 && messageId) {
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
          const { data: updated } = await supabase
            .from("campaign_leads")
            .update({
              status: "replied",
              replied_at: now,
              webhook_data: body,
            })
            .in("lead_id", matchedLeadIds)
            .eq("user_id", userId)
            .in("status", ["sent", "delivered"])
            .select("campaign_id");

          if (updated && updated.length > 0) {
            console.log(`[WEBHOOK-INTEGRATION] Marked ${updated.length} campaign_lead(s) as replied`);

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
            console.warn(`[WEBHOOK-INTEGRATION] No campaign_leads updated for reply. leads: ${matchedLeadIds}`);
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
          } else {
            console.warn(`[WEBHOOK-INTEGRATION] No campaign_leads updated for delivery. leads: ${matchedLeadIds}`);
          }
        }
      } else {
        console.warn(`[WEBHOOK-INTEGRATION] Could not match any lead for email event. email: ${matchEmail}, messageId: ${messageId}`);
      }
    }

    // ── Write to unified events table ──
    if (userId) {
      const eventEntries: Array<{ channel: string; event_type: string; contact_id?: string }> = [];

      if (isEmailDelivered && matchedLeadIds.length > 0) {
        matchedLeadIds.forEach((lid) => eventEntries.push({ channel: "email", event_type: "delivered", contact_id: lid }));
      }
      if (isEmailReply && matchedLeadIds.length > 0) {
        matchedLeadIds.forEach((lid) => eventEntries.push({ channel: "email", event_type: "replied", contact_id: lid }));
      }
      if (isEmailBounced) {
        const bouncedEmail2 = (data.to || data.recipient || data.email || "").toLowerCase().trim();
        eventEntries.push({ channel: "email", event_type: "bounced" });
      }
      if (isEmailSpam) {
        eventEntries.push({ channel: "email", event_type: "spam" });
      }

      for (const evt of eventEntries) {
        await supabase.from("events").insert({
          user_id: userId,
          contact_id: evt.contact_id || null,
          channel: evt.channel,
          event_type: evt.event_type,
          metadata: { raw_event: event, account_id: accountId },
        }).then(({ error }) => {
          if (error) console.error(`[WEBHOOK-INTEGRATION] Failed to insert event:`, error.message);
        });
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