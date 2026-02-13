import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload = await req.json();
    console.log("WhatsApp webhook payload:", JSON.stringify(payload));

    // Unipile sends account connection events
    // The "name" field we set during connect contains the user_id
    const accountName = payload?.name || payload?.account?.name || "";
    const accountId = payload?.account_id || payload?.account?.id || payload?.id || "";
    const event = payload?.event || payload?.status || "";

    // Extract user_id from the name pattern "whatsapp-{user_id}"
    const userIdMatch = accountName.match(/^whatsapp-(.+)$/);
    const userId = userIdMatch?.[1];

    if (!userId) {
      console.warn("Could not extract user_id from webhook payload. Name:", accountName);
      // Try to find by pending status and update the most recent one
      return new Response(JSON.stringify({ received: true, warning: "no_user_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("WhatsApp webhook: userId=", userId, "accountId=", accountId, "event=", event);

    // Determine the status based on the event
    const isConnected =
      event === "connected" ||
      event === "CONNECTED" ||
      event === "account.connected" ||
      payload?.status === "OK" ||
      payload?.status === "connected";

    const newStatus = isConnected ? "connected" : "disconnected";

    const { error } = await supabase
      .from("whatsapp_connections")
      .upsert(
        {
          user_id: userId,
          unipile_account_id: accountId || null,
          status: newStatus,
          connected_at: isConnected ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("Error updating whatsapp connection:", error);
    }

    return new Response(JSON.stringify({ received: true, status: newStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("webhooks-whatsapp error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
