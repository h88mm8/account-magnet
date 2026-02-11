const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Normalize text: remove accents, lowercase, trim, collapse whitespace.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[_\s]+/g, " ")
    .trim();
}

/**
 * Determine which Unipile search types to query based on lookupType.
 * The Unipile API supports: LOCATION, REGION, INDUSTRY, COMPANY, SCHOOL, etc.
 * We query both LOCATION and REGION for geographic searches to maximize results,
 * then infer the level (country/state/city) from the response.
 */
function getSearchTypes(lookupType?: string): string[] {
  if (lookupType === "INDUSTRY") return ["INDUSTRY"];
  if (lookupType === "LOCATION") return ["REGION"];
  // Default: search all relevant types
  return ["INDUSTRY", "REGION"];
}

/**
 * Infer region level from Unipile item data.
 * Falls back to generic "REGION" if we can't determine the level.
 */
function inferRegionLevel(item: Record<string, unknown>, searchType: string): string {
  if (searchType === "INDUSTRY") return "INDUSTRY";

  // Try to infer level from item metadata
  const urnType = String(item.urn_type || item.type || item.entity_type || "").toLowerCase();
  const urn = String(item.urn || item.entity_urn || "").toLowerCase();
  const label = String(item.title || item.name || "");

  if (urnType.includes("country") || urn.includes("country")) return "REGION_COUNTRY";
  if (urnType.includes("state") || urnType.includes("admin") || urn.includes("state")) return "REGION_STATE";
  if (urnType.includes("city") || urn.includes("city")) return "REGION_CITY";

  // Heuristic: if label contains a comma (e.g. "Curitiba, Paraná, Brazil"), likely a city
  if (label.includes(",")) return "REGION_CITY";

  return "REGION";
}

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
    const { query, type: lookupType, limit = 15 } = body;

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ items: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedQuery = normalizeText(query);
    const effectiveLimit = Math.min(Math.max(Number(limit) || 15, 1), 50);
    const searchTypes = getSearchTypes(lookupType);

    console.log(`[LOOKUP] query="${query}" normalized="${normalizedQuery}" types=${searchTypes.join(",")} limit=${effectiveLimit}`);

    // Query all relevant types in parallel
    const fetchJobs = searchTypes.map(async (searchType) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const url = `${baseUrl}/api/v1/linkedin/search/parameters?account_id=${encodeURIComponent(accountId)}&type=${encodeURIComponent(searchType)}&keywords=${encodeURIComponent(normalizedQuery)}&limit=${effectiveLimit}`;

      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { "X-API-KEY": apiKey, accept: "application/json" },
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));

        const payload = await res.json().catch(() => ({}));

        if (!res.ok) {
          console.warn(`[LOOKUP] Unipile error for type=${searchType} [${res.status}]:`, JSON.stringify(payload));
          return [];
        }

        return (payload?.items || [])
          .filter((item: Record<string, unknown>) => {
            const id = String(item?.id || "").trim();
            return id.length > 0;
          })
          .map((item: Record<string, unknown>) => {
            const id = String(item.id).trim();
            const label = String(item.title || item.name || item.text || "").trim();
            return {
              id,
              label,
              type: inferRegionLevel(item, searchType),
            };
          });
      } catch (err) {
        console.warn(`[LOOKUP] Fetch failed for type=${searchType}:`, err);
        return [];
      }
    });

    const results = await Promise.allSettled(fetchJobs);
    const allItems: Array<{ id: string; label: string; type: string }> = [];
    const seenIds = new Set<string>();

    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const item of result.value) {
          // Deduplicate by id+type
          const key = `${item.id}:${item.type}`;
          if (!seenIds.has(key) && item.label) {
            seenIds.add(key);
            allItems.push(item);
          }
        }
      }
    }

    // Sort: exact prefix matches first, then by label length (shorter = more relevant)
    allItems.sort((a, b) => {
      const aNorm = normalizeText(a.label);
      const bNorm = normalizeText(b.label);
      const aPrefix = aNorm.startsWith(normalizedQuery) ? 0 : 1;
      const bPrefix = bNorm.startsWith(normalizedQuery) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      return a.label.length - b.label.length;
    });

    // Limit total results
    const items = allItems.slice(0, effectiveLimit);

    console.log(`[LOOKUP] Found ${items.length} results for "${query}" (types=${searchTypes.join(",")})`);

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
