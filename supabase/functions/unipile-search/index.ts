const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Sales Navigator ID mappings — Accounts ───────────────────────────

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

// ── Sales Navigator ID mappings — Leads ──────────────────────────────

const SENIORITY_MAP: Record<string, { id: string; text: string }> = {
  "1": { id: "1", text: "Unpaid" },
  "2": { id: "2", text: "Training" },
  "3": { id: "3", text: "Entry" },
  "4": { id: "4", text: "Senior" },
  "5": { id: "5", text: "Manager" },
  "6": { id: "6", text: "Director" },
  "7": { id: "7", text: "VP" },
  "8": { id: "8", text: "CXO" },
  "9": { id: "9", text: "Owner" },
  "10": { id: "10", text: "Partner" },
};

const FUNCTION_MAP: Record<string, { id: string; text: string }> = {
  "1": { id: "1", text: "Accounting" },
  "2": { id: "2", text: "Administrative" },
  "3": { id: "3", text: "Arts and Design" },
  "4": { id: "4", text: "Business Development" },
  "5": { id: "5", text: "Community and Social Services" },
  "6": { id: "6", text: "Consulting" },
  "7": { id: "7", text: "Education" },
  "8": { id: "8", text: "Engineering" },
  "9": { id: "9", text: "Entrepreneurship" },
  "10": { id: "10", text: "Finance" },
  "11": { id: "11", text: "Healthcare Services" },
  "12": { id: "12", text: "Human Resources" },
  "13": { id: "13", text: "Information Technology" },
  "14": { id: "14", text: "Legal" },
  "15": { id: "15", text: "Marketing" },
  "16": { id: "16", text: "Media and Communication" },
  "17": { id: "17", text: "Military and Protective Services" },
  "18": { id: "18", text: "Operations" },
  "19": { id: "19", text: "Product Management" },
  "20": { id: "20", text: "Program and Project Management" },
  "21": { id: "21", text: "Purchasing" },
  "22": { id: "22", text: "Quality Assurance" },
  "23": { id: "23", text: "Real Estate" },
  "24": { id: "24", text: "Research" },
  "25": { id: "25", text: "Sales" },
  "26": { id: "26", text: "Support" },
};

const YEARS_OF_EXPERIENCE_MAP: Record<string, { id: string; text: string }> = {
  "1": { id: "1", text: "Less than 1 year" },
  "2": { id: "2", text: "1 to 2 years" },
  "3": { id: "3", text: "3 to 5 years" },
  "4": { id: "4", text: "6 to 10 years" },
  "5": { id: "5", text: "More than 10 years" },
};

const YEARS_AT_CURRENT_COMPANY_MAP: Record<string, { id: string; text: string }> = {
  "1": { id: "1", text: "Less than 1 year" },
  "2": { id: "2", text: "1 to 2 years" },
  "3": { id: "3", text: "3 to 5 years" },
  "4": { id: "4", text: "6 to 10 years" },
  "5": { id: "5", text: "More than 10 years" },
};

// ── Shared types ─────────────────────────────────────────────────────

type FilterEntry = {
  type: string;
  values: { id: string; text: string; selectionType: string }[];
};

function resolveMulti(
  input: string | string[] | undefined,
  map: Record<string, { id: string; text: string }>
): { id: string; text: string; selectionType: string }[] {
  if (!input) return [];
  const keys = Array.isArray(input) ? input : [input];
  return keys
    .filter((k) => k && k !== "any")
    .map((k) => {
      const mapped = map[k];
      return mapped ? { ...mapped, selectionType: "INCLUDED" } : null;
    })
    .filter(Boolean) as { id: string; text: string; selectionType: string }[];
}

function addFilter(filters: FilterEntry[], type: string, values: { id: string; text: string; selectionType: string }[]) {
  if (values.length > 0) {
    filters.push({ type, values });
  }
}

// ── URL builder — Accounts ───────────────────────────────────────────

function buildSalesNavAccountUrl(params: {
  keywords?: string;
  companySize?: string | string[];
  revenue?: string | string[];
  industry?: string | string[];
  location?: string | string[];
}): string {
  const base = "https://www.linkedin.com/sales/search/company";
  const filters: FilterEntry[] = [];

  addFilter(filters, "COMPANY_HEADCOUNT", resolveMulti(params.companySize, COMPANY_HEADCOUNT_MAP));
  addFilter(filters, "ANNUAL_REVENUE", resolveMulti(params.revenue, ANNUAL_REVENUE_MAP));
  addFilter(filters, "INDUSTRY", resolveMulti(params.industry, INDUSTRY_MAP));
  addFilter(filters, "REGION", resolveMulti(params.location, REGION_MAP));

  return buildFinalUrl(base, filters, params.keywords);
}

// ── URL builder — Leads ──────────────────────────────────────────────

function buildSalesNavLeadUrl(params: {
  keywords?: string;
  seniority?: string | string[];
  jobFunction?: string | string[];
  industry?: string | string[];
  location?: string | string[];
  companySize?: string | string[];
  yearsOfExperience?: string | string[];
  yearsAtCurrentCompany?: string | string[];
}): string {
  const base = "https://www.linkedin.com/sales/search/people";
  const filters: FilterEntry[] = [];

  addFilter(filters, "SENIORITY_LEVEL", resolveMulti(params.seniority, SENIORITY_MAP));
  addFilter(filters, "FUNCTION", resolveMulti(params.jobFunction, FUNCTION_MAP));
  addFilter(filters, "INDUSTRY", resolveMulti(params.industry, INDUSTRY_MAP));
  addFilter(filters, "REGION", resolveMulti(params.location, REGION_MAP));
  addFilter(filters, "COMPANY_HEADCOUNT", resolveMulti(params.companySize, COMPANY_HEADCOUNT_MAP));
  addFilter(filters, "YEARS_OF_EXPERIENCE", resolveMulti(params.yearsOfExperience, YEARS_OF_EXPERIENCE_MAP));
  addFilter(filters, "YEARS_AT_CURRENT_COMPANY", resolveMulti(params.yearsAtCurrentCompany, YEARS_AT_CURRENT_COMPANY_MAP));

  return buildFinalUrl(base, filters, params.keywords);
}

// ── Shared URL formatter ─────────────────────────────────────────────

function buildFinalUrl(base: string, filters: FilterEntry[], keywords?: string): string {
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

  if (keywords) {
    parts.push(`keywords:${encodeURIComponent(keywords)}`);
  }

  if (parts.length === 0) return base;
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

    const body = await req.json();
    const {
      // Common
      searchType = "accounts", // "accounts" | "leads"
      page = 1,
      // Account filters
      keywords,
      revenue,
      location,
      industry,
      companySize,
      // Lead filters
      seniority,
      jobFunction,
      yearsOfExperience,
      yearsAtCurrentCompany,
    } = body;

    const isLeads = searchType === "leads";

    const searchUrl = isLeads
      ? buildSalesNavLeadUrl({
          keywords,
          seniority,
          jobFunction,
          industry,
          location,
          companySize,
          yearsOfExperience,
          yearsAtCurrentCompany,
        })
      : buildSalesNavAccountUrl({
          keywords,
          companySize,
          revenue,
          industry,
          location,
        });

    // Append page parameter to URL for pagination
    const paginatedUrl =
      page > 1
        ? `${searchUrl}${searchUrl.includes("?") ? "&" : "?"}page=${page}`
        : searchUrl;

    console.log(`Sales Navigator URL (${searchType}, page ${page}):`, paginatedUrl);

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
        category: isLeads ? "people" : "companies",
        url: paginatedUrl,
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

    // Normalize response
    let items;
    if (isLeads) {
      items = (data.items || []).map((item: Record<string, unknown>) => ({
        firstName: item.first_name || item.firstName || "",
        lastName: item.last_name || item.lastName || "",
        title: item.title || item.headline || "",
        company: item.company || item.current_company || "",
        location: item.location || "",
        linkedinUrl: item.linkedinUrl || item.linkedin_url || item.url || "",
      }));
    } else {
      items = (data.items || []).map((item: Record<string, unknown>) => ({
        name: item.name || item.title || "",
        industry: item.industry || "",
        location: item.location || item.headquarters || "",
        employeeCount: item.employeeCount || item.employee_count || item.size || "",
        linkedinUrl: item.linkedinUrl || item.linkedin_url || item.url || "",
      }));
    }

    return new Response(
      JSON.stringify({
        items,
        pagination: {
          page,
          hasMore: (data.items || []).length >= 25,
          totalEstimate: data.total || null,
        },
      }),
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
