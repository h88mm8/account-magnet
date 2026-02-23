import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEDUP_WINDOW_MINUTES = 10;

// ── Security: URL validation ──
const BLOCKED_PROTOCOLS = ["javascript:", "data:", "vbscript:", "file:"];

function isUrlSafe(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    // Block dangerous protocols
    if (BLOCKED_PROTOCOLS.some((p) => url.protocol.toLowerCase().startsWith(p))) return false;
    // Only allow http/https
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    // Block localhost / private IPs
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("172.") ||
      host === "0.0.0.0" ||
      host.endsWith(".local")
    ) return false;
    return true;
  } catch {
    return false;
  }
}

function sanitizeUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    // Remove any auth info from URL
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Path: /redirect-link/r/<short_code>
  const match = url.pathname.match(/\/r\/([a-zA-Z0-9]+)$/);
  if (!match) {
    return new Response("Not found", { status: 404 });
  }
  const shortCode = match[1];

  // Validate short_code format (alphanumeric only, max 20 chars)
  if (!/^[a-zA-Z0-9]{1,20}$/.test(shortCode)) {
    return new Response("Invalid link", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Lookup tracking record
  const { data: tracking, error: trackErr } = await supabase
    .from("link_tracking")
    .select("id, user_id, lead_id, original_url, campaign_lead_id")
    .eq("short_code", shortCode)
    .single();

  if (trackErr || !tracking) {
    console.error("[REDIRECT] short_code not found:", shortCode, trackErr?.message);
    return new Response("Link not found", { status: 404 });
  }

  const {
    id: trackingId,
    user_id: userId,
    lead_id: leadId,
    original_url: rawOriginalUrl,
    campaign_lead_id: campaignLeadId,
  } = tracking;

  // 2. Validate & sanitize the original URL before redirect
  const originalUrl = sanitizeUrl(rawOriginalUrl);
  if (!originalUrl || !isUrlSafe(originalUrl)) {
    console.error("[REDIRECT] Blocked unsafe URL:", rawOriginalUrl);
    return new Response("This link has been blocked for security reasons.", { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const userAgent = req.headers.get("user-agent") || "";
  const now = new Date();

  // 3. Deduplication: check if same lead clicked same tracking link within window
  const windowStart = new Date(now.getTime() - DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("link_clicks")
    .select("id", { count: "exact", head: true })
    .eq("tracking_id", trackingId)
    .eq("lead_id", leadId)
    .eq("is_unique", true)
    .gte("clicked_at", windowStart);

  const isUnique = (recentCount ?? 0) === 0;

  // 4. Register click in link_clicks (existing table)
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
    console.error("[REDIRECT] Failed to insert link_click:", clickErr.message);
  }

  // 5. Resolve campaign_id from campaign_lead_id and register in email_clicks
  let campaignId: string | null = null;
  if (campaignLeadId) {
    const { data: cl } = await supabase
      .from("campaign_leads")
      .select("campaign_id")
      .eq("id", campaignLeadId)
      .single();
    campaignId = cl?.campaign_id || null;
  }

  if (campaignId) {
    // Dedup for email_clicks: same campaign + lead + url within window
    const { count: emailRecentCount } = await supabase
      .from("email_clicks")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("lead_id", leadId)
      .eq("original_url", originalUrl)
      .eq("is_unique", true)
      .gte("clicked_at", windowStart);

    const emailIsUnique = (emailRecentCount ?? 0) === 0;

    const { error: ecErr } = await supabase.from("email_clicks").insert({
      campaign_id: campaignId,
      lead_id: leadId,
      user_id: userId,
      original_url: originalUrl,
      clicked_at: now.toISOString(),
      ip_address: ip,
      user_agent: userAgent,
      is_unique: emailIsUnique,
      short_code: shortCode,
    });

    if (ecErr) {
      console.error("[REDIRECT] Failed to insert email_click:", ecErr.message);
    }

    // 6. If unique: update campaign metrics and mark lead as clicked
    if (emailIsUnique) {
      // Update campaign_leads.clicked_at (only first click)
      if (campaignLeadId) {
        const { data: existingCl } = await supabase
          .from("campaign_leads")
          .select("clicked_at")
          .eq("id", campaignLeadId)
          .single();

        if (!existingCl?.clicked_at) {
          await supabase
            .from("campaign_leads")
            .update({ clicked_at: now.toISOString(), status: "clicked" })
            .eq("id", campaignLeadId);

          // Increment campaigns.total_clicked
          const { data: camp } = await supabase
            .from("campaigns")
            .select("total_clicked")
            .eq("id", campaignId)
            .single();

          await supabase
            .from("campaigns")
            .update({ total_clicked: (camp?.total_clicked || 0) + 1 })
            .eq("id", campaignId);
        }
      }
    }
  }

  // 7. If unique click: increment link_clicks_count on lead and create notification
  if (isUnique) {
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

    // Create in-app notification
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

    // 8. Check user notification preferences & send alerts
    const { data: profile } = await supabase
      .from("profiles")
      .select("notify_email_enabled, notify_email, notify_whatsapp_enabled, notify_whatsapp_number, full_name")
      .eq("user_id", userId)
      .single();

    if (profile?.notify_email_enabled && profile?.notify_email) {
      supabase.functions.invoke("send-click-notification", {
        body: {
          to_email: profile.notify_email,
          lead_name: lead?.name || "Contato",
          original_url: originalUrl,
          clicked_at: now.toISOString(),
        },
      }).catch((e: any) => console.error("[REDIRECT] Email notify failed:", e.message));
    }

    if (profile?.notify_whatsapp_enabled && profile?.notify_whatsapp_number) {
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
          }).catch((e: any) => console.error("[REDIRECT] WA notify failed:", e.message));
        }
      }
    }
  }

  // 9. 302 redirect — no cache
  return new Response(null, {
    status: 302,
    headers: {
      Location: originalUrl,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
});
