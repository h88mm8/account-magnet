import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HMAC-SHA256 token helpers
async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(payload, secret);
  return expected === signature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const HMAC_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // reuse as HMAC key

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // ── Action: GENERATE token (called by process-campaign-queue) ──
  if (action === "generate") {
    try {
      const { user_id, campaign_id, lead_id } = await req.json();
      if (!user_id || !campaign_id || !lead_id) {
        return new Response(JSON.stringify({ error: "Missing params" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const payload = `${user_id}.${campaign_id}.${lead_id}`;
      const sig = await hmacSign(payload, HMAC_SECRET);
      const token = btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") + "." + sig;

      return new Response(JSON.stringify({ token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ── Action: VALIDATE token + return settings (called by public page) ──
  if (action === "validate") {
    try {
      const { token } = await req.json();
      if (!token) {
        return new Response(JSON.stringify({ error: "Missing token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [encodedPayload, sig] = token.split(".");
      if (!encodedPayload || !sig) {
        return new Response(JSON.stringify({ error: "Invalid token format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = atob(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"));
      const valid = await hmacVerify(payload, sig, HMAC_SECRET);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid token signature" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [user_id, campaign_id, lead_id] = payload.split(".");

      // Load tracking page settings
      const { data: settings } = await supabase
        .from("tracking_page_settings")
        .select("*")
        .eq("user_id", user_id)
        .single();

      return new Response(JSON.stringify({
        valid: true,
        user_id,
        campaign_id,
        lead_id,
        settings: settings || {
          background_color: "#f8fafc",
          button_text: "Acessar conteúdo",
          button_color: "#3b82f6",
          button_font_color: "#ffffff",
          logo_url: null,
          redirect_url: null,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ── Action: CLICK registration ──
  if (action === "click") {
    try {
      const { token } = await req.json();
      if (!token) {
        return new Response(JSON.stringify({ error: "Missing token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [encodedPayload, sig] = token.split(".");
      const payload = atob(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"));
      const valid = await hmacVerify(payload, sig, HMAC_SECRET);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [user_id, campaign_id, lead_id] = payload.split(".");

      // Check dedup: if clicked_at already set, just return redirect
      const { data: campaignLead } = await supabase
        .from("campaign_leads")
        .select("id, clicked_at")
        .eq("campaign_id", campaign_id)
        .eq("lead_id", lead_id)
        .single();

      // Get redirect URL
      const { data: settings } = await supabase
        .from("tracking_page_settings")
        .select("redirect_url")
        .eq("user_id", user_id)
        .single();

      const redirectUrl = settings?.redirect_url || "https://google.com";

      if (campaignLead?.clicked_at) {
        // Already clicked — dedup, just redirect
        return new Response(JSON.stringify({ redirect_url: redirectUrl, already_clicked: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Register click
      if (campaignLead) {
        await supabase
          .from("campaign_leads")
          .update({
            clicked_at: new Date().toISOString(),
            status: "clicked",
          })
          .eq("id", campaignLead.id);

        // Increment total_clicked
        const { data: camp } = await supabase
          .from("campaigns")
          .select("total_clicked")
          .eq("id", campaign_id)
          .single();

        await supabase
          .from("campaigns")
          .update({ total_clicked: (camp?.total_clicked || 0) + 1 })
          .eq("id", campaign_id);
      }

      return new Response(JSON.stringify({ redirect_url: redirectUrl, already_clicked: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
