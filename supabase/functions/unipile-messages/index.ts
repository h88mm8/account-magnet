import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Phone normalization ────────────────────────────────────────────────────

/**
 * Normalizes a phone number:
 * - Strips all non-digits
 * - Handles Brazilian "9 digit" issue: removes 9th digit from 13/14-digit numbers
 *   e.g. 5543999575035 (13 digits) → 554399575035 (12 digits)
 */
function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");

  // Brazilian numbers with country code 55 + DDD (2) + 9 (mobile) = 13 digits
  // Some carriers send 14-digit numbers (55 + DDD + 9 + 8 digits)
  if (digits.startsWith("55") && (digits.length === 13 || digits.length === 14)) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.startsWith("9") && rest.length === 9) {
      // Remove the extra "9"
      digits = "55" + ddd + rest.slice(1);
    }
  }

  return digits;
}

// ─── URL Tracking ──────────────────────────────────────────────────────────

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
  campaignLeadId: string | null,
  supabaseProjectId: string
): Promise<string> {
  const URL_REGEX = /(https?:\/\/[^\s]+)/gi;
  const urls = message.match(URL_REGEX);
  if (!urls || urls.length === 0) return message;

  let result = message;

  for (const originalUrl of urls) {
    let shortCode = generateShortCode();
    // Collision retry
    for (let attempt = 0; attempt < 5; attempt++) {
      const { count } = await supabase
        .from("link_tracking")
        .select("id", { count: "exact", head: true })
        .eq("short_code", shortCode);
      if ((count ?? 0) === 0) break;
      shortCode = generateShortCode();
    }

    const { error } = await supabase.from("link_tracking").insert({
      user_id: userId,
      lead_id: leadId,
      campaign_lead_id: campaignLeadId,
      original_url: originalUrl,
      short_code: shortCode,
    });

    if (error) {
      console.error(`[TRACKING] Failed to insert: ${error.message}`);
      continue;
    }

    const trackingUrl = `https://${supabaseProjectId}.supabase.co/functions/v1/redirect-link/r/${shortCode}`;
    result = result.replace(originalUrl, trackingUrl);
    console.log(`[TRACKING] ${originalUrl} → ${trackingUrl}`);
  }

  return result;
}

// ─── Main handler ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const UNIPILE_BASE_URL = Deno.env.get("UNIPILE_BASE_URL")!;
  const UNIPILE_API_KEY = Deno.env.get("UNIPILE_API_KEY")!;
  const SUPABASE_PROJECT_ID = SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1] ?? "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();

    // ── 1. Validate payload ────────────────────────────────────────────────
    const {
      instanceId,
      phone: rawPhone,
      content,
      mediaUrl,
      messageType = "text",
      userId,
      leadId,
      campaignId,
      campaignLeadId,
      workflowInstanceId,
      nodeId,
    } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rawPhone && !instanceId) {
      return new Response(
        JSON.stringify({ error: "phone and instanceId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!content && !mediaUrl) {
      return new Response(
        JSON.stringify({ error: "content or mediaUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Normalize phone ─────────────────────────────────────────────────
    const normalizedPhone = normalizePhone(rawPhone || "");
    console.log(`[MSG] phone: ${rawPhone} → normalized: ${normalizedPhone}`);

    // ── 3. Resolve instance / account ─────────────────────────────────────
    let unipileAccountId: string | null = null;

    if (instanceId) {
      // Look up in instances table
      const { data: instance, error: instErr } = await supabase
        .from("instances")
        .select("unipile_account_id, status, daily_send_limit, daily_sent_count, daily_reset_at")
        .eq("id", instanceId)
        .eq("user_id", userId)
        .single();

      if (instErr || !instance) {
        return new Response(
          JSON.stringify({ error: "Instance not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!instance.unipile_account_id) {
        return new Response(
          JSON.stringify({ error: "Instance is not connected to a WhatsApp account" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Daily limit check + reset
      const now = new Date();
      const resetAt = instance.daily_reset_at ? new Date(instance.daily_reset_at) : null;
      let dailySentCount = instance.daily_sent_count;

      if (!resetAt || now > resetAt) {
        // Reset counter – new day
        const nextReset = new Date(now);
        nextReset.setHours(24, 0, 0, 0);
        await supabase
          .from("instances")
          .update({ daily_sent_count: 0, daily_reset_at: nextReset.toISOString() })
          .eq("id", instanceId);
        dailySentCount = 0;
      }

      if (dailySentCount >= instance.daily_send_limit) {
        return new Response(
          JSON.stringify({ error: "Daily send limit reached for this instance" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      unipileAccountId = instance.unipile_account_id;
    } else {
      // Fallback: look up connected WhatsApp account for this user
      const { data: waConn } = await supabase
        .from("whatsapp_connections")
        .select("unipile_account_id")
        .eq("user_id", userId)
        .eq("status", "connected")
        .single();

      if (!waConn?.unipile_account_id) {
        return new Response(
          JSON.stringify({ error: "No connected WhatsApp account found for this user" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      unipileAccountId = waConn.unipile_account_id;
    }

    // ── 4. URL tracking ────────────────────────────────────────────────────
    let processedContent = content || "";
    if (leadId && SUPABASE_PROJECT_ID) {
      processedContent = await wrapUrlsInMessage(
        supabase,
        processedContent,
        userId,
        leadId,
        campaignLeadId || null,
        SUPABASE_PROJECT_ID
      );
    }

    // ── 5. Build WhatsApp attendee ID ──────────────────────────────────────
    const attendeeId = `${normalizedPhone}@s.whatsapp.net`;

    // ── 6. Build FormData and send ─────────────────────────────────────────
    let unipileMessageId: string | null = null;
    let sendError: string | null = null;

    try {
      const formData = new FormData();
      formData.append("account_id", unipileAccountId);
      formData.append("attendees_ids", attendeeId);

      if (processedContent) {
        formData.append("text", processedContent);
      }

      // Media attachment
      if (mediaUrl) {
        try {
          const mediaResp = await fetch(mediaUrl);
          if (mediaResp.ok) {
            const blob = await mediaResp.blob();
            const fileName = mediaUrl.split("/").pop() || "attachment";
            formData.append("attachments", blob, fileName);
            console.log(`[MSG] Media attached: ${fileName}`);
          } else {
            console.warn(`[MSG] Failed to fetch media: ${mediaResp.status}`);
          }
        } catch (mediaErr) {
          console.warn(`[MSG] Media fetch error: ${mediaErr.message}`);
        }
      }

      console.log(`[MSG] Sending to ${attendeeId} via account ${unipileAccountId}`);

      const resp = await fetch(`${UNIPILE_BASE_URL}/api/v1/chats`, {
        method: "POST",
        headers: {
          "X-API-KEY": UNIPILE_API_KEY,
          "accept": "application/json",
        },
        body: formData,
      });

      const respData = await resp.json().catch(() => ({}));

      if (resp.ok) {
        unipileMessageId = respData.id || respData.message_id || null;
        console.log(`[MSG] Sent successfully. unipile_message_id=${unipileMessageId}`);
      } else {
        sendError = `Unipile API error [${resp.status}]: ${JSON.stringify(respData).slice(0, 300)}`;
        console.error(`[MSG_FAIL] ${sendError}`);
      }
    } catch (sendErr) {
      sendError = `Network error: ${sendErr.message}`;
      console.error(`[MSG_FAIL] ${sendError}`);
    }

    // ── 7. Save result to messages_sent ───────────────────────────────────
    const { data: savedMsg, error: saveErr } = await supabase
      .from("messages_sent")
      .insert({
        user_id: userId,
        instance_id: instanceId || null,
        lead_id: leadId || null,
        campaign_id: campaignId || null,
        campaign_lead_id: campaignLeadId || null,
        workflow_instance_id: workflowInstanceId || null,
        node_id: nodeId || null,
        phone: normalizedPhone,
        content: processedContent,
        media_url: mediaUrl || null,
        message_type: messageType,
        status: sendError ? "failed" : "sent",
        unipile_message_id: unipileMessageId,
        error_message: sendError,
        sent_at: sendError ? null : new Date().toISOString(),
      })
      .select("id")
      .single();

    if (saveErr) {
      console.error("[MSG] Failed to save to messages_sent:", saveErr.message);
    }

    // ── 8. Update daily count on instance ─────────────────────────────────
    if (!sendError && instanceId) {
      await supabase.rpc("increment_instance_daily_count", { p_instance_id: instanceId }).catch(() => {
        // Fallback: manual increment
        supabase
          .from("instances")
          .update({ daily_sent_count: supabase.rpc("daily_sent_count") })
          .eq("id", instanceId);
      });
    }

    // ── 9. Update lead last_contact_at if available ────────────────────────
    if (!sendError && leadId) {
      await supabase
        .from("prospect_list_items")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", leadId)
        .eq("user_id", userId);
    }

    // ── Response ───────────────────────────────────────────────────────────
    if (sendError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: sendError,
          message_id: savedMsg?.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: savedMsg?.id,
        unipile_message_id: unipileMessageId,
        phone: normalizedPhone,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[MSG] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
