const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("UNIPILE_API_KEY");
    const baseUrl = Deno.env.get("UNIPILE_BASE_URL");
    const accountId = Deno.env.get("UNIPILE_ACCOUNT_ID");

    if (!apiKey || !baseUrl || !accountId) {
      return new Response(
        JSON.stringify({ error: "UNIPILE credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { query, type = "LOCATION", limit = 25 } = body;

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ items: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const effectiveLimit = Math.min(Math.max(Number(limit) || 25, 1), 50);
    const url = `${baseUrl}/api/v1/linkedin/search/parameters?account_id=${encodeURIComponent(accountId)}&type=${encodeURIComponent(type)}&keywords=${encodeURIComponent(query.trim())}&limit=${effectiveLimit}`;

    console.log(`[LOOKUP] type=${type} query="${query.trim()}" limit=${effectiveLimit}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: "GET",
      headers: { "X-API-KEY": apiKey, accept: "application/json" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(`[LOOKUP] Unipile error [${res.status}]:`, JSON.stringify(payload));
      return new Response(
        JSON.stringify({ error: `Unipile lookup failed [${res.status}]`, details: payload }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize items: each must have id, label, type
    const items = (payload?.items || [])
      .filter((item: Record<string, unknown>) => {
        const id = String(item?.id || "").trim();
        return id && /^\d+$/.test(id);
      })
      .map((item: Record<string, unknown>) => {
        const id = String(item.id).trim();
        const label = String(item.title || item.name || item.text || "").trim();
        
        // Infer region level from Unipile response
        // Unipile returns a "type" or "urn_type" field in some cases
        let resolvedType = type; // default to requested type
        
        if (type === "LOCATION") {
          // Try to infer level from the item data
          const urnType = String(item.urn_type || item.type || item.entity_type || "").toLowerCase();
          const urn = String(item.urn || item.entity_urn || "").toLowerCase();
          
          if (urnType.includes("country") || urn.includes("country")) {
            resolvedType = "REGION_COUNTRY";
          } else if (urnType.includes("state") || urnType.includes("admin") || urn.includes("state")) {
            resolvedType = "REGION_STATE";
          } else if (urnType.includes("city") || urn.includes("city")) {
            resolvedType = "REGION_CITY";
          } else {
            // Default: use REGION which works for all levels in Sales Navigator
            resolvedType = "REGION";
          }
        }

        return { id, label, type: resolvedType };
      });

    console.log(`[LOOKUP] Found ${items.length} results for "${query.trim()}" (type=${type})`);

    return new Response(
      JSON.stringify({ items }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[LOOKUP] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
