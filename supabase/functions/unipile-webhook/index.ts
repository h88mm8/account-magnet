import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * unipile-webhook
 *
 * Handles async events from Unipile:
 * - message_delivered  → update messages_sent status
 * - message_read       → update messages_sent status
 * - message.received   → save to messages_received, create notification
 * - account.connected  → update instances status
 * - account.connection_lost → update instances status
 */

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
    const payload = await req.json();
    console.log("[WEBHOOK] Received:", JSON.stringify(payload).slice(0, 500));

    const event = (payload.event || payload.type || "").toString().toLowerCase().replace(/[_\-\s]/g, "");
    const accountId = payload.account_id || payload.accountId || payload.data?.account_id;
    const messageId = payload.message_id || payload.data?.id || payload.data?.message_id;

    // ── Delivery status events ─────────────────────────────────────────────

    if (event.includes("messagedelivered") || event.includes("delivered")) {
      if (messageId) {
        await supabase
          .from("messages_sent")
          .update({ status: "delivered", delivered_at: new Date().toISOString() })
          .eq("unipile_message_id", messageId);
        console.log(`[WEBHOOK] Marked delivered: ${messageId}`);
      }
      return new Response(JSON.stringify({ received: true, event: "delivered" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.includes("messageread") || event.includes("read")) {
      if (messageId) {
        await supabase
          .from("messages_sent")
          .update({ status: "read", read_at: new Date().toISOString() })
          .eq("unipile_message_id", messageId);
        console.log(`[WEBHOOK] Marked read: ${messageId}`);
      }
      return new Response(JSON.stringify({ received: true, event: "read" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Incoming message ───────────────────────────────────────────────────

    if (event.includes("messagereceived") || event.includes("newmessage") || event.includes("message.received")) {
      const data = payload.data || payload;

      // Extract sender phone / identifier
      const senderPhone = (
        data.sender ||
        data.from ||
        data.attendee_id ||
        (Array.isArray(data.attendees) ? data.attendees?.[0]?.identifier : null) ||
        ""
      ).toString().replace("@s.whatsapp.net", "").replace(/\D/g, "");

      const chatId = data.chat_id || data.chatId || null;
      const msgContent = data.text || data.body || data.content || "";
      const msgId = data.id || data.message_id || messageId || null;

      // Try to find the user via whatsapp_connections.unipile_account_id
      let userId: string | null = null;
      let instanceId: string | null = null;

      if (accountId) {
        const { data: waConn } = await supabase
          .from("whatsapp_connections")
          .select("user_id")
          .eq("unipile_account_id", accountId)
          .maybeSingle();

        if (waConn?.user_id) {
          userId = waConn.user_id;
        }

        // Also check instances table
        const { data: inst } = await supabase
          .from("instances")
          .select("id, user_id")
          .eq("unipile_account_id", accountId)
          .maybeSingle();

        if (inst) {
          instanceId = inst.id;
          userId = userId || inst.user_id;
        }
      }

      if (!userId) {
        console.warn("[WEBHOOK] Could not resolve user_id for incoming message");
        return new Response(JSON.stringify({ received: true, warning: "no_user_id" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try to match lead by phone
      let leadId: string | null = null;
      if (senderPhone) {
        const { data: lead } = await supabase
          .from("prospect_list_items")
          .select("id")
          .eq("user_id", userId)
          .ilike("phone", `%${senderPhone.slice(-8)}%`)
          .maybeSingle();
        leadId = lead?.id || null;
      }

      // Save to messages_received
      await supabase.from("messages_received").insert({
        user_id: userId,
        instance_id: instanceId,
        lead_id: leadId,
        unipile_message_id: msgId,
        unipile_chat_id: chatId,
        phone: senderPhone,
        content: msgContent,
        message_type: "text",
        received_at: new Date().toISOString(),
        raw_payload: payload,
      });

      // Create in-app notification
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "message_received",
        title: "Nova resposta recebida",
        body: senderPhone
          ? `Mensagem de +${senderPhone}: ${msgContent.slice(0, 80)}`
          : msgContent.slice(0, 100),
        data: { phone: senderPhone, chat_id: chatId, lead_id: leadId },
      });

      console.log(`[WEBHOOK] Saved incoming message from ${senderPhone}`);

      return new Response(JSON.stringify({ received: true, event: "message_received" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Account connection events ──────────────────────────────────────────

    const isConnected =
      event.includes("accountconnected") ||
      event.includes("accountcreated") ||
      event.includes("creationsuccess") ||
      event.includes("connected");

    const isDisconnected =
      event.includes("connectionlost") ||
      event.includes("accountdisconnected") ||
      event.includes("disconnected") ||
      event.includes("expired");

    if ((isConnected || isDisconnected) && accountId) {
      const newStatus = isConnected ? "connected" : "disconnected";

      // Update instances table
      await supabase
        .from("instances")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("unipile_account_id", accountId);

      console.log(`[WEBHOOK] Instance status → ${newStatus} for account ${accountId}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[WEBHOOK] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 200, // Always 200 to prevent Unipile retries on our errors
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
