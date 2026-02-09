const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Sales Navigator ID mappings ──────────────────────────────────────

const COMPANY_HEADCOUNT_MAP: Record<string, { id: string; text: string }> = {
  "B": { id: "B", text: "1-10" },
  "C": { id: "C", text: "11-50" },
  "D": { id: "D", text: "51-200" },
  "E": { id: "E", text: "201-500" },
  "F": { id: "F", text: "501-1000" },
  "G": { id: "G", text: "1001-5000" },
  "H": { id: "H", text: "5001-10000" },
  "I": { id: "I", text: "10001+" },
};

const ANNUAL_REVENUE_MAP: Record<string, { id: string; text: string }> = {
  "1": { id: "1", text: "Less than $1M" },
  "2": { id: "2", text: "$1M to $10M" },
  "3": { id: "3", text: "$10M to $50M" },
  "4": { id: "4", text: "$50M to $100M" },
  "5": { id: "5", text: "$100M to $500M" },
  "6": { id: "6", text: "$500M to $1B" },
  "7": { id: "7", text: "More than $1B" },
};

const INDUSTRY_MAP: Record<string, { id: string; text: string }> = {
  "1": { id: "1", text: "Defense & Space" },
  "3": { id: "3", text: "Computer Hardware" },
  "4": { id: "4", text: "Computer Software" },
  "5": { id: "5", text: "Telecommunications" },
  "6": { id: "6", text: "Computer Networking" },
  "7": { id: "7", text: "Semiconductors" },
  "8": { id: "8", text: "Mechanical or Industrial Engineering" },
  "11": { id: "11", text: "Biotechnology" },
  "12": { id: "12", text: "Hospital & Health Care" },
  "13": { id: "13", text: "Food & Beverages" },
  "14": { id: "14", text: "Marketing and Advertising" },
  "17": { id: "17", text: "Automotive" },
  "27": { id: "27", text: "Retail" },
  "28": { id: "28", text: "Consumer Goods" },
  "29": { id: "29", text: "Cosmetics" },
  "31": { id: "31", text: "Farming" },
  "41": { id: "41", text: "Banking" },
  "42": { id: "42", text: "Insurance" },
  "43": { id: "43", text: "Financial Services" },
  "44": { id: "44", text: "Government Administration" },
  "47": { id: "47", text: "Accounting" },
  "48": { id: "48", text: "Construction" },
  "51": { id: "51", text: "Logistics and Supply Chain" },
  "67": { id: "67", text: "Education Management" },
  "68": { id: "68", text: "E-Learning" },
  "69": { id: "69", text: "Law Practice" },
  "80": { id: "80", text: "Real Estate" },
  "94": { id: "94", text: "Management Consulting" },
  "96": { id: "96", text: "IT Services and IT Consulting" },
  "104": { id: "104", text: "Mining & Metals" },
  "110": { id: "110", text: "Oil & Energy" },
  "116": { id: "116", text: "Pharmaceuticals" },
  "118": { id: "118", text: "Renewables & Environment" },
  "129": { id: "129", text: "Human Resources" },
  "137": { id: "137", text: "Staffing and Recruiting" },
  "147": { id: "147", text: "Transportation" },
  "3248": { id: "3248", text: "Robotics Engineering" },
};

const REGION_MAP: Record<string, { id: string; text: string }> = {
  "brasil": { id: "106057199", text: "Brazil" },
  "sao_paulo": { id: "100364837", text: "São Paulo, Brazil" },
  "rio_de_janeiro": { id: "103806428", text: "Rio de Janeiro, Brazil" },
  "minas_gerais": { id: "100501801", text: "Minas Gerais, Brazil" },
  "parana": { id: "106209057", text: "Paraná, Brazil" },
  "santa_catarina": { id: "106380113", text: "Santa Catarina, Brazil" },
  "rio_grande_do_sul": { id: "105959875", text: "Rio Grande do Sul, Brazil" },
  "bahia": { id: "103537801", text: "Bahia, Brazil" },
  "distrito_federal": { id: "103644278", text: "Distrito Federal, Brazil" },
  "ceara": { id: "101937022", text: "Ceará, Brazil" },
  "pernambuco": { id: "104570964", text: "Pernambuco, Brazil" },
  "goias": { id: "102225773", text: "Goiás, Brazil" },
  "estados_unidos": { id: "103644278", text: "United States" },
  "portugal": { id: "100364837", text: "Portugal" },
  "reino_unido": { id: "101165590", text: "United Kingdom" },
};

// ── URL builder ──────────────────────────────────────────────────────

type FilterEntry = {
  type: string;
  values: { id: string; text: string; selectionType: string }[];
};

function buildSalesNavAccountUrl(params: {
  keywords?: string;
  companySize?: string;
  revenue?: string;
  industry?: string;
  location?: string;
}): string {
  const base = "https://www.linkedin.com/sales/search/company";
  const filters: FilterEntry[] = [];

  if (params.companySize && params.companySize !== "any") {
    const mapped = COMPANY_HEADCOUNT_MAP[params.companySize];
    if (mapped) {
      filters.push({
        type: "COMPANY_HEADCOUNT",
        values: [{ ...mapped, selectionType: "INCLUDED" }],
      });
    }
  }

  if (params.revenue && params.revenue !== "any") {
    const mapped = ANNUAL_REVENUE_MAP[params.revenue];
    if (mapped) {
      filters.push({
        type: "ANNUAL_REVENUE",
        values: [{ ...mapped, selectionType: "INCLUDED" }],
      });
    }
  }

  if (params.industry) {
    const mapped = INDUSTRY_MAP[params.industry];
    if (mapped) {
      filters.push({
        type: "INDUSTRY",
        values: [{ ...mapped, selectionType: "INCLUDED" }],
      });
    }
  }

  if (params.location) {
    const mapped = REGION_MAP[params.location];
    if (mapped) {
      filters.push({
        type: "REGION",
        values: [{ ...mapped, selectionType: "INCLUDED" }],
      });
    }
  }

  // Build query=(filters:List(...),keywords:TEXT)
  const parts: string[] = [];

  if (filters.length > 0) {
    const filterStrings = filters.map((f) => {
      const valuesStr = f.values
        .map(
          (v) =>
            `(id:${v.id},text:${encodeURIComponent(v.text)},selectionType:${v.selectionType})`
        )
        .join(",");
      return `(type:${f.type},values:List(${valuesStr}))`;
    });
    parts.push(`filters:List(${filterStrings.join(",")})`);
  }

  if (params.keywords) {
    parts.push(`keywords:${encodeURIComponent(params.keywords)}`);
  }

  if (parts.length === 0) {
    return base;
  }

  return `${base}?query=(${parts.join(",")})`;
}

// ── Main handler ─────────────────────────────────────────────────────

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
        JSON.stringify({
          error: "UNIPILE_API_KEY, UNIPILE_BASE_URL and UNIPILE_ACCOUNT_ID must be configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { keywords, revenue, location, industry, companySize } =
      await req.json();

    const searchUrl = buildSalesNavAccountUrl({
      keywords,
      revenue,
      location,
      industry,
      companySize,
    });

    console.log("Sales Navigator URL:", searchUrl);

    const unipileUrl = `${baseUrl}/api/v1/linkedin/search?account_id=${encodeURIComponent(accountId)}`;

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
      console.error("Unipile API error:", JSON.stringify(data));
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
      name: item.name || item.title || "",
      industry: item.industry || "",
      location: item.location || item.headquarters || "",
      employeeCount: item.employeeCount || item.employee_count || item.size || "",
      linkedinUrl: item.linkedinUrl || item.linkedin_url || item.url || "",
    }));

    return new Response(
      JSON.stringify({ items }),
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
