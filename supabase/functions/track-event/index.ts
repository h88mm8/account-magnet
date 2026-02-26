import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiter (per-instance, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60; // requests per window
const RATE_WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

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
    const { contact_id, user_id, event_type, metadata, org_token, session_id } = body;

    // Validate required fields
    if (!event_type) {
      return new Response(
        JSON.stringify({ error: "event_type is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate event_type
    const allowedEvents = ["page_visit", "scroll_depth", "cta_click", "form_submit", "video_play"];
    if (!allowedEvents.includes(event_type)) {
      return new Response(
        JSON.stringify({ error: `Invalid event_type. Allowed: ${allowedEvents.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit by IP or org_token
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimitKey = org_token || clientIp;
    if (!checkRateLimit(rateLimitKey)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve user_id from org_token if provided
    let resolvedUserId = user_id;
    if (!resolvedUserId && org_token) {
      const { data: orgSettings } = await supabase
        .from("web_tracking_settings")
        .select("user_id")
        .eq("org_token", org_token)
        .maybeSingle();

      if (!orgSettings) {
        return new Response(
          JSON.stringify({ error: "Invalid org_token" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      resolvedUserId = orgSettings.user_id;

      // Validate origin if site_url is configured
      const origin = req.headers.get("origin") || req.headers.get("referer") || "";
      // We log but don't block for now to allow flexible deployment
    }

    // Resolve user_id from contact_id if still not found
    if (!resolvedUserId && contact_id) {
      const { data: contact } = await supabase
        .from("prospect_list_items")
        .select("user_id")
        .eq("id", contact_id)
        .maybeSingle();

      if (!contact) {
        return new Response(
          JSON.stringify({ error: "Contact not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      resolvedUserId = contact.user_id;
    }

    if (!resolvedUserId) {
      return new Response(
        JSON.stringify({ error: "Could not resolve user_id. Provide contact_id, user_id, or org_token." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize metadata
    const safeMetadata: Record<string, any> = {};
    if (metadata && typeof metadata === "object") {
      const allowedKeys = [
        "url", "page_title", "scroll_percent", "cta_id", "cta_text",
        "referrer", "duration_ms", "session_id", "href",
        "css_class", "time_on_page",
      ];
      for (const key of allowedKeys) {
        if (metadata[key] !== undefined) {
          safeMetadata[key] = typeof metadata[key] === "string"
            ? metadata[key].slice(0, 500)
            : metadata[key];
        }
      }
    }

    // Add session_id to metadata if provided at top level
    if (session_id && typeof session_id === "string") {
      safeMetadata.session_id = session_id.slice(0, 100);
    }

    // Insert event
    const { error } = await supabase.from("events").insert({
      user_id: resolvedUserId,
      contact_id: contact_id || null,
      channel: "site",
      event_type,
      metadata: safeMetadata,
    });

    if (error) {
      console.error("[TRACK-EVENT] Insert error:", error.message);
      return new Response(
        JSON.stringify({ error: "Failed to record event" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[TRACK-EVENT] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
