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
    const UNIPILE_API_KEY = Deno.env.get("UNIPILE_API_KEY");
    const UNIPILE_BASE_URL = Deno.env.get("UNIPILE_BASE_URL");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!UNIPILE_API_KEY || !UNIPILE_BASE_URL) {
      throw new Error("Unipile credentials not configured");
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action } = await req.json();

    if (action === "status") {
      // Check current connection status
      const { data: conn } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("user_id", user.id)
        .single();

      return new Response(
        JSON.stringify({ status: conn?.status || "disconnected", connection: conn }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "disconnect") {
      // Update status to disconnected
      await supabase
        .from("whatsapp_connections")
        .update({ status: "disconnected", unipile_account_id: null })
        .eq("user_id", user.id);

      return new Response(
        JSON.stringify({ status: "disconnected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "connect") {
      // Generate hosted auth link for WhatsApp only
      const expiresOn = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      const webhookUrl = `${SUPABASE_URL}/functions/v1/webhooks-whatsapp`;

      const response = await fetch(`${UNIPILE_BASE_URL}/api/v1/hosted/accounts/link`, {
        method: "POST",
        headers: {
          "X-API-KEY": UNIPILE_API_KEY,
          "accept": "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: "create",
          providers: ["WHATSAPP"],
          api_url: UNIPILE_BASE_URL,
          expiresOn,
          notify_url: webhookUrl,
          name: `whatsapp-${user.id}`,
          sync_history: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Unipile hosted auth error:", response.status, errorText);
        throw new Error(`Failed to generate connection link: ${response.status}`);
      }

      const data = await response.json();
      console.log("Unipile hosted auth response:", JSON.stringify(data));

      // Upsert a pending connection record
      await supabase
        .from("whatsapp_connections")
        .upsert(
          {
            user_id: user.id,
            status: "pending",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      return new Response(
        JSON.stringify({ url: data.url, status: "pending" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: connect, status, disconnect" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("whatsapp-connect error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
