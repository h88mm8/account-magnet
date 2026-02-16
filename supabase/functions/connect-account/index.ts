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
    const { action, provider } = await req.json();

    if (!provider || !["linkedin", "email"].includes(provider)) {
      return new Response(
        JSON.stringify({ error: "Invalid provider. Use: linkedin, email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ STATUS ============
    if (action === "status") {
      const { data: conn } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("user_id", user.id)
        .eq("provider", provider)
        .single();

      return new Response(
        JSON.stringify({ status: conn?.status || "disconnected", connection: conn }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ DISCONNECT ============
    if (action === "disconnect") {
      await supabase
        .from("user_integrations")
        .update({ status: "disconnected", unipile_account_id: null })
        .eq("user_id", user.id)
        .eq("provider", provider);

      return new Response(
        JSON.stringify({ status: "disconnected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ CONNECT ============
    if (action === "connect") {
      const expiresOn = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Map provider to Unipile provider name
      const providerMap: Record<string, string[]> = {
        linkedin: ["LINKEDIN"],
        email: ["GOOGLE", "OUTLOOK"],
      };

      const webhookUrl = `${SUPABASE_URL}/functions/v1/webhooks-integration`;

      const body: Record<string, unknown> = {
        type: "create",
        providers: providerMap[provider],
        api_url: UNIPILE_BASE_URL,
        expiresOn,
        notify_url: webhookUrl,
        name: `${provider}-${user.id}`,
        sync_history: false,
      };

      // For LinkedIn, we want messaging capabilities
      if (provider === "linkedin") {
        body.providers = ["LINKEDIN"];
      }

      console.log(`[CONNECT] Generating hosted auth for ${provider}, user ${user.id}`);

      const response = await fetch(`${UNIPILE_BASE_URL}/api/v1/hosted/accounts/link`, {
        method: "POST",
        headers: {
          "X-API-KEY": UNIPILE_API_KEY,
          "accept": "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[CONNECT] Unipile hosted auth error for ${provider}:`, response.status, errorText);
        throw new Error(`Failed to generate connection link: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[CONNECT] Hosted auth response for ${provider}:`, JSON.stringify(data));

      // Upsert a pending connection record
      await supabase
        .from("user_integrations")
        .upsert(
          {
            user_id: user.id,
            provider,
            status: "pending",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider" }
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
    console.error("connect-account error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
