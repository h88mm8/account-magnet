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

    // Unipile sends account connection events
    const event = body.event || body.type || "";
    const data = body.data || body;
    const accountId = data.account_id || data.id || body.account_id;
    const accountName = data.name || body.name || "";

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

    console.log(`[WEBHOOK-INTEGRATION] Event: ${event}, Provider: ${provider}, User: ${userId}, AccountId: ${accountId}`);

    if (!provider || !userId) {
      // Try to find by matching account_id in existing records
      console.log("[WEBHOOK-INTEGRATION] Could not parse provider/user from name, checking existing records");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle connection success
    if (event === "account.created" || event === "account.connected" || event === "account_created" || event === "connected") {
      await supabase
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

      console.log(`[WEBHOOK-INTEGRATION] ${provider} connected for user ${userId}`);
    }

    // Handle disconnection
    if (event === "account.disconnected" || event === "account_disconnected" || event === "disconnected") {
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
    if (event === "account.expired" || event === "expired") {
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
