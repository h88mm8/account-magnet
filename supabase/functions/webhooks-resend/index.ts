import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    console.log("[WEBHOOK-RESEND] Received:", JSON.stringify(body));

    // Resend webhook payload: { type, created_at, data: { email_id, from, to, subject, ... } }
    const eventType = body.type || "";
    const data = body.data || {};
    const resendEmailId = data.email_id || data.id || "";
    const toEmails: string[] = Array.isArray(data.to) ? data.to : (data.to ? [data.to] : []);

    // Map Resend event types to our internal event types
    const eventMap: Record<string, string> = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.opened": "opened",
      "email.clicked": "clicked",
      "email.bounced": "bounced",
      "email.complained": "spam",
      "email.delivery_delayed": "delayed",
    };

    const internalEventType = eventMap[eventType];
    if (!internalEventType) {
      console.log(`[WEBHOOK-RESEND] Ignoring event type: ${eventType}`);
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the message_sent record by resend email ID (stored in unipile_message_id field)
    let userId: string | null = null;
    let matchedLeadIds: string[] = [];
    let matchedCampaignLeadId: string | null = null;

    if (resendEmailId) {
      const { data: sentMsg } = await supabase
        .from("messages_sent")
        .select("user_id, lead_id, campaign_id, campaign_lead_id")
        .eq("unipile_message_id", resendEmailId)
        .maybeSingle();

      if (sentMsg) {
        userId = sentMsg.user_id;
        if (sentMsg.lead_id) matchedLeadIds = [sentMsg.lead_id];
        matchedCampaignLeadId = sentMsg.campaign_lead_id;
        console.log(`[WEBHOOK-RESEND] Matched by email_id: user=${userId}, lead=${sentMsg.lead_id}`);
      }
    }

    // Fallback: match by recipient email
    if (!userId && toEmails.length > 0) {
      const cleanEmail = toEmails[0].toLowerCase().trim();
      const { data: leads } = await supabase
        .from("prospect_list_items")
        .select("id, user_id")
        .ilike("email", cleanEmail)
        .limit(5);

      if (leads && leads.length > 0) {
        userId = leads[0].user_id;
        matchedLeadIds = leads.map((l: any) => l.id);
        console.log(`[WEBHOOK-RESEND] Matched ${matchedLeadIds.length} lead(s) by email: ${cleanEmail}`);
      }
    }

    if (!userId) {
      console.warn("[WEBHOOK-RESEND] Could not resolve user for event");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    // Handle bounce → auto-blocklist
    if (internalEventType === "bounced" && toEmails.length > 0) {
      const bouncedEmail = toEmails[0].toLowerCase().trim();
      const bounceType = data.bounce?.type || "hard";
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
            bounce_count: bounceType === "hard" ? 3 : 1,
          });
        }
        console.log(`[WEBHOOK-RESEND] Bounce registered: ${bouncedEmail} (${bounceType})`);
      } catch (e) {
        console.error(`[WEBHOOK-RESEND] Blocklist error:`, e.message);
      }
    }

    // Handle spam complaint → immediate block
    if (internalEventType === "spam" && toEmails.length > 0) {
      const spamEmail = toEmails[0].toLowerCase().trim();
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
      } catch (e) {
        console.error(`[WEBHOOK-RESEND] Spam blocklist error:`, e.message);
      }
    }

    // Update campaign_leads status
    if (matchedLeadIds.length > 0) {
      if (internalEventType === "delivered") {
        const { data: updated } = await supabase
          .from("campaign_leads")
          .update({ status: "delivered", delivered_at: now, webhook_data: body })
          .in("lead_id", matchedLeadIds)
          .eq("user_id", userId)
          .eq("status", "sent")
          .select("campaign_id");

        if (updated && updated.length > 0) {
          const campaignIds = [...new Set(updated.map((l: any) => l.campaign_id))];
          for (const cid of campaignIds) {
            const count = updated.filter((l: any) => l.campaign_id === cid).length;
            const { data: camp } = await supabase.from("campaigns").select("total_delivered").eq("id", cid).single();
            if (camp) {
              await supabase.from("campaigns").update({ total_delivered: (camp.total_delivered || 0) + count }).eq("id", cid);
            }
          }
        }
      } else if (internalEventType === "opened") {
        await supabase
          .from("campaign_leads")
          .update({ opened_at: now, webhook_data: body })
          .in("lead_id", matchedLeadIds)
          .eq("user_id", userId)
          .is("opened_at", null);

        // Update total_opened
        const { data: campLeads } = await supabase
          .from("campaign_leads")
          .select("campaign_id")
          .in("lead_id", matchedLeadIds)
          .eq("user_id", userId);
        if (campLeads) {
          const campaignIds = [...new Set(campLeads.map((l: any) => l.campaign_id))];
          for (const cid of campaignIds) {
            const { data: camp } = await supabase.from("campaigns").select("total_opened").eq("id", cid).single();
            if (camp) {
              await supabase.from("campaigns").update({ total_opened: (camp.total_opened || 0) + 1 }).eq("id", cid);
            }
          }
        }
      } else if (internalEventType === "clicked") {
        await supabase
          .from("campaign_leads")
          .update({ clicked_at: now, webhook_data: body })
          .in("lead_id", matchedLeadIds)
          .eq("user_id", userId)
          .is("clicked_at", null);

        const { data: campLeads } = await supabase
          .from("campaign_leads")
          .select("campaign_id")
          .in("lead_id", matchedLeadIds)
          .eq("user_id", userId);
        if (campLeads) {
          const campaignIds = [...new Set(campLeads.map((l: any) => l.campaign_id))];
          for (const cid of campaignIds) {
            const { data: camp } = await supabase.from("campaigns").select("total_clicked").eq("id", cid).single();
            if (camp) {
              await supabase.from("campaigns").update({ total_clicked: (camp.total_clicked || 0) + 1 }).eq("id", cid);
            }
          }
        }
      }
    }

    // Write to unified events table
    const eventsToInsert = matchedLeadIds.length > 0
      ? matchedLeadIds.map((lid) => ({
          user_id: userId,
          contact_id: lid,
          channel: "email",
          event_type: internalEventType,
          metadata: { resend_email_id: resendEmailId, raw_event: eventType },
        }))
      : [{
          user_id: userId,
          contact_id: null,
          channel: "email",
          event_type: internalEventType,
          metadata: { resend_email_id: resendEmailId, raw_event: eventType },
        }];

    for (const evt of eventsToInsert) {
      await supabase.from("events").insert(evt);
    }

    console.log(`[WEBHOOK-RESEND] Processed ${eventType} → ${internalEventType} for user ${userId}`);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[WEBHOOK-RESEND] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
