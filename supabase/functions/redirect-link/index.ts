import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEDUP_WINDOW_MINUTES = 10;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Path: /redirect-link/r/<short_code>
  const match = url.pathname.match(/\/r\/([a-zA-Z0-9]+)$/);
  if (!match) {
    return new Response("Not found", { status: 404 });
  }
  const shortCode = match[1];

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Lookup tracking record
  const { data: tracking, error: trackErr } = await supabase
    .from("link_tracking")
    .select("id, user_id, lead_id, original_url")
    .eq("short_code", shortCode)
    .single();

  if (trackErr || !tracking) {
    console.error("[REDIRECT] short_code not found:", shortCode, trackErr?.message);
    return new Response("Link not found", { status: 404 });
  }

  const { id: trackingId, user_id: userId, lead_id: leadId, original_url: originalUrl } = tracking;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const userAgent = req.headers.get("user-agent") || "";
  const now = new Date();

  // 2. Deduplication: check if same lead clicked same tracking link within window
  const windowStart = new Date(now.getTime() - DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("link_clicks")
    .select("id", { count: "exact", head: true })
    .eq("tracking_id", trackingId)
    .eq("lead_id", leadId)
    .eq("is_unique", true)
    .gte("clicked_at", windowStart);

  const isUnique = (recentCount ?? 0) === 0;

  // 3. Register click
  const { error: clickErr } = await supabase.from("link_clicks").insert({
    tracking_id: trackingId,
    user_id: userId,
    lead_id: leadId,
    ip_address: ip,
    user_agent: userAgent,
    is_unique: isUnique,
    clicked_at: now.toISOString(),
  });

  if (clickErr) {
    console.error("[REDIRECT] Failed to insert click:", clickErr.message);
  }

  // 4. If unique click: increment counter on lead and create notification
  if (isUnique) {
    // Increment link_clicks_count
    const { data: lead } = await supabase
      .from("prospect_list_items")
      .select("link_clicks_count, name")
      .eq("id", leadId)
      .single();

    const newCount = (lead?.link_clicks_count ?? 0) + 1;
    await supabase
      .from("prospect_list_items")
      .update({ link_clicks_count: newCount })
      .eq("id", leadId);

    // 5. Create in-app notification
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "link_click",
      title: "Link clicado!",
      body: `${lead?.name || "Um contato"} clicou no link enviado.`,
      data: {
        lead_id: leadId,
        tracking_id: trackingId,
        original_url: originalUrl,
        clicked_at: now.toISOString(),
      },
    });

    // 6. Check user notification preferences & send alerts
    const { data: profile } = await supabase
      .from("profiles")
      .select("notify_email_enabled, notify_email, notify_whatsapp_enabled, notify_whatsapp_number, full_name")
      .eq("user_id", userId)
      .single();

    if (profile?.notify_email_enabled && profile?.notify_email) {
      // Fire-and-forget email notification
      supabase.functions.invoke("send-click-notification", {
        body: {
          to_email: profile.notify_email,
          lead_name: lead?.name || "Contato",
          original_url: originalUrl,
          clicked_at: now.toISOString(),
        },
      }).catch((e) => console.error("[REDIRECT] Email notify failed:", e.message));
    }

    if (profile?.notify_whatsapp_enabled && profile?.notify_whatsapp_number) {
      // Send WhatsApp notification to the user's own number via their connected account
      const { data: waConn } = await supabase
        .from("whatsapp_connections")
        .select("unipile_account_id")
        .eq("user_id", userId)
        .eq("status", "connected")
        .single();

      if (waConn?.unipile_account_id) {
        const UNIPILE_BASE_URL = Deno.env.get("UNIPILE_BASE_URL");
        const UNIPILE_API_KEY = Deno.env.get("UNIPILE_API_KEY");
        if (UNIPILE_BASE_URL && UNIPILE_API_KEY) {
          const msg = `🔗 *Link clicado!*\n*Contato:* ${lead?.name || "Desconhecido"}\n*Link:* ${originalUrl}\n*Horário:* ${now.toLocaleString("pt-BR")}`;
          const cleanPhone = profile.notify_whatsapp_number.replace(/\D/g, "");
          const fd = new FormData();
          fd.append("account_id", waConn.unipile_account_id);
          fd.append("text", msg);
          fd.append("attendees_ids", cleanPhone);
          fetch(`${UNIPILE_BASE_URL}/api/v1/chats`, {
            method: "POST",
            headers: { "X-API-KEY": UNIPILE_API_KEY, accept: "application/json" },
            body: fd,
          }).catch((e) => console.error("[REDIRECT] WA notify failed:", e.message));
        }
      }
    }
  }

  // 7. 302 redirect — no cache
  return new Response(null, {
    status: 302,
    headers: {
      Location: originalUrl,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
});
