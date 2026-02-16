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

    console.log(`[WEBHOOK-INTEGRATION] Event/Status: ${event}, Provider: ${provider}, User: ${userId}, AccountId: ${accountId}, AccountType: ${accountType}`);

    if (!provider || !userId) {
      console.log("[WEBHOOK-INTEGRATION] Could not parse provider/user from name, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize event string for matching
    const normalizedEvent = event.toUpperCase().replace(/[.\-_]/g, "");

    // Handle connection success
    // Unipile sends: status="CREATION_SUCCESS", event="account.created", "account.connected", etc.
    const isConnected = [
      "CREATIONSUCCESS",
      "ACCOUNTCREATED",
      "ACCOUNTCONNECTED",
      "ACCOUNTCREATED",
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
