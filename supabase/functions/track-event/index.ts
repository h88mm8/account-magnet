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
    const { contact_id, user_id, event_type, metadata } = body;

    // Validate required fields
    if (!contact_id || !event_type) {
      return new Response(
        JSON.stringify({ error: "contact_id and event_type are required" }),
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

    // Resolve user_id from contact_id if not provided
    let resolvedUserId = user_id;
    if (!resolvedUserId) {
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

    // Sanitize metadata
    const safeMetadata: Record<string, any> = {};
    if (metadata && typeof metadata === "object") {
      // Only allow safe keys
      const allowedKeys = ["url", "page_title", "scroll_percent", "cta_id", "cta_text", "referrer", "duration_ms"];
      for (const key of allowedKeys) {
        if (metadata[key] !== undefined) {
          safeMetadata[key] = typeof metadata[key] === "string"
            ? metadata[key].slice(0, 500)
            : metadata[key];
        }
      }
    }

    // Insert event
    const { error } = await supabase.from("events").insert({
      user_id: resolvedUserId,
      contact_id,
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
