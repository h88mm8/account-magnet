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
    const dsn = Deno.env.get("UNIPILE_DSN");

    if (!apiKey || !dsn) {
      return new Response(
        JSON.stringify({
          error: "UNIPILE_API_KEY and UNIPILE_DSN must be configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { keywords, revenue, location, industry, companySize, accountId } =
      await req.json();

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: "accountId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build Sales Navigator search URL for Accounts
    const searchUrl = buildSalesNavUrl({
      keywords,
      revenue,
      location,
      industry,
      companySize,
    });

    console.log("Search URL:", searchUrl);

    const unipileUrl = `https://${dsn}/api/v1/linkedin/search?account_id=${encodeURIComponent(accountId)}`;

    const response = await fetch(unipileUrl, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        api: "sales_navigator",
        category: "companies",
        url: searchUrl,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Unipile API error:", data);
      return new Response(
        JSON.stringify({
          error: data.message || `Unipile request failed with status ${response.status}`,
          details: data,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Normalize response items
    const items = (data.items || []).map((item: Record<string, unknown>) => ({
      type: item.type || "COMPANY",
      id: item.id || "",
      name: item.name || item.title || "",
      industry: item.industry || "",
      location: item.location || item.headquarters || "",
      employeeCount: item.employeeCount || item.employee_count || item.size || "",
      description: item.description || "",
      linkedinUrl: item.linkedinUrl || item.linkedin_url || item.url || "",
      raw: item,
    }));

    return new Response(
      JSON.stringify({ object: data.object || "LinkedinSearch", items }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function buildSalesNavUrl(params: {
  keywords?: string;
  revenue?: string;
  location?: string;
  industry?: string;
  companySize?: string;
}): string {
  // Sales Navigator company search base URL
  const base = "https://www.linkedin.com/sales/search/company";
  const queryParts: string[] = [];

  if (params.keywords) {
    queryParts.push(`keywords=${encodeURIComponent(params.keywords)}`);
  }

  if (params.companySize && params.companySize !== "any") {
    queryParts.push(`companySize=${encodeURIComponent(params.companySize)}`);
  }

  if (params.revenue && params.revenue !== "any") {
    queryParts.push(`annualRevenue=${encodeURIComponent(params.revenue)}`);
  }

  if (params.industry) {
    queryParts.push(`industry=${encodeURIComponent(params.industry)}`);
  }

  if (params.location) {
    queryParts.push(`geoIncluded=${encodeURIComponent(params.location)}`);
  }

  return queryParts.length > 0
    ? `${base}?${queryParts.join("&")}`
    : base;
}
