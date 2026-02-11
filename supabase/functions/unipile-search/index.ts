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

// INDUSTRY_MAP removed — industries are now resolved dynamically via unipile-lookup.
// The frontend sends pre-resolved { id, label, type } objects.

// REGION handling:
// - Frontend sends human-readable location strings (e.g. "Minas Gerais", "São Paulo (Cidade)")
// - We resolve them to LinkedIn/Sales Navigator geo IDs via Unipile "search/parameters".

type RegionInput = string | { id: string; text?: string };

function isNumericGeoId(v: string): boolean {
  return /^\d{6,}$/.test(v);
}

function cleanLocationQuery(v: string): string {
  // Remove suffixes like "(Estado)" / "(Cidade)" added in our UI catalog
  return v.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

function resolveRegion(
  input: RegionInput | RegionInput[] | undefined
): { id: string; text: string; selectionType: string }[] {
  if (!input) return [];
  const values = Array.isArray(input) ? input : [input];

  return values
    .map((v) => {
      if (!v) return null;
      if (typeof v === "string") {
        const s = v.trim();
        if (!s || s === "any") return null;
        return {
          id: s,
          text: s,
          selectionType: "INCLUDED",
        };
      }

      const id = String(v.id || "").trim();
      if (!id) return null;
      return {
        id,
        text: String(v.text || id),
        selectionType: "INCLUDED",
      };
    })
    .filter(Boolean) as { id: string; text: string; selectionType: string }[];
}

async function resolveLocationsToGeoIds(
  input: RegionInput | RegionInput[] | undefined,
  baseUrl: string,
  apiKey: string,
  accountId: string
): Promise<RegionInput[] | undefined> {
  if (!input) return undefined;
  const values = Array.isArray(input) ? input : [input];

  const cache = new Map<string, RegionInput>();

  const jobs = values
    .filter(Boolean)
    .map(async (v) => {
      if (typeof v !== "string") return v;

      const raw = v.trim();
      if (!raw || raw === "any") return null;

      // Already an ID
      if (isNumericGeoId(raw)) return { id: raw, text: raw };

      const query = cleanLocationQuery(raw);
      if (!query) return null;

      const cacheKey = query.toLowerCase();
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const url = `${baseUrl}/api/v1/linkedin/search/parameters?account_id=${encodeURIComponent(accountId)}&type=LOCATION&keywords=${encodeURIComponent(query)}&limit=25`;
      const res = await fetch(url, {
        method: "GET",
        headers: { "X-API-KEY": apiKey, accept: "application/json" },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn(`[LOCATION] Failed to resolve "${query}" [${res.status}]:`, JSON.stringify(payload));
        return null;
      }

      const first = (payload?.items || [])[0];
      const id = String(first?.id || "").trim();
      const text = String(first?.title || first?.name || query).trim();

      if (!id || !isNumericGeoId(id)) {
        console.warn(`[LOCATION] No valid geo ID for "${query}":`, JSON.stringify(first));
        return null;
      }

      const resolved = { id, text };
      cache.set(cacheKey, resolved);
      console.log(`[LOCATION] Resolved "${raw}" -> ${id} (${text})`);
      return resolved;
    });

  const settled = await Promise.allSettled(jobs);
  const resolved = settled
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter(Boolean) as RegionInput[];

  return resolved.length ? resolved : undefined;
}

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
  industryResolved?: { id: string; text: string }[];
  location?: RegionInput | RegionInput[];
}): string {
  const base = "https://www.linkedin.com/sales/search/company";
  const filters: FilterEntry[] = [];

  addFilter(filters, "COMPANY_HEADCOUNT", resolveMulti(params.companySize, COMPANY_HEADCOUNT_MAP));
  addFilter(filters, "ANNUAL_REVENUE", resolveMulti(params.revenue, ANNUAL_REVENUE_MAP));

  // Industry: use pre-resolved objects directly (no fixed map)
  if (params.industryResolved && params.industryResolved.length > 0) {
    addFilter(filters, "INDUSTRY", params.industryResolved.map(i => ({ id: i.id, text: i.text, selectionType: "INCLUDED" })));
  }

  addFilter(filters, "REGION", resolveRegion(params.location));

  return buildFinalUrl(base, filters, params.keywords);
}

// ── URL builder — Leads ──────────────────────────────────────────────

function buildSalesNavLeadUrl(params: {
  keywords?: string;
  seniority?: string | string[];
  jobFunction?: string | string[];
  industryResolved?: { id: string; text: string }[];
  location?: RegionInput | RegionInput[];
  companySize?: string | string[];
  yearsOfExperience?: string | string[];
  yearsAtCurrentCompany?: string | string[];
}): string {
  const base = "https://www.linkedin.com/sales/search/people";
  const filters: FilterEntry[] = [];

  addFilter(filters, "SENIORITY_LEVEL", resolveMulti(params.seniority, SENIORITY_MAP));
  addFilter(filters, "FUNCTION", resolveMulti(params.jobFunction, FUNCTION_MAP));

  // Industry: use pre-resolved objects directly (no fixed map)
  if (params.industryResolved && params.industryResolved.length > 0) {
    addFilter(filters, "INDUSTRY", params.industryResolved.map(i => ({ id: i.id, text: i.text, selectionType: "INCLUDED" })));
  }

  addFilter(filters, "REGION", resolveRegion(params.location));
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

// ── Enrich company locations via profile endpoint ────────────────────

async function enrichCompanyLocations(
  items: Record<string, unknown>[],
  baseUrl: string,
  apiKey: string,
  accountId: string
): Promise<Record<string, unknown>[]> {
  const promises = items.map(async (item) => {
    const id = item.id as string | undefined;
    if (!id || (item.location && item.location !== "")) return item;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const url = `${baseUrl}/api/v1/linkedin/company/${encodeURIComponent(id)}?account_id=${encodeURIComponent(accountId)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { "X-API-KEY": apiKey, accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return item;

      const profile = await res.json();
      // Log first profile response to understand the shape
      console.log(`[ENRICH] Profile for ${id}:`, JSON.stringify({
        location: profile.location,
        headquarters: profile.headquarters,
        hq_location: profile.hq_location,
        headquarter: profile.headquarter,
        address: profile.address,
        city: profile.city,
        country: profile.country,
      }));

      const location = profile.location || profile.headquarters || profile.hq_location ||
        profile.headquarter || profile.address || profile.city || "";

      if (location) {
        return { ...item, location };
      }
      return item;
    } catch (e) {
      console.warn(`[ENRICH] Failed for ${id}:`, e);
      return item;
    }
  });

  const results = await Promise.allSettled(promises);
  return results.map((r, i) => r.status === "fulfilled" ? r.value : items[i]);
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
    const { cursor, limit } = body;
    const effectiveLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);

    // ── Build Unipile URL with limit & cursor as query parameters ──
    let unipileUrl = `${baseUrl}/api/v1/linkedin/search?account_id=${encodeURIComponent(accountId)}&limit=${effectiveLimit}`;
    if (cursor) {
      unipileUrl += `&cursor=${encodeURIComponent(cursor)}`;
    }

    // ── Build request body ──
    let unipileBody: Record<string, unknown>;

    if (cursor) {
      console.log("[PAGINATION] Using cursor:", cursor, "limit:", effectiveLimit);
      // Cursor pagination: empty body (no filters, no limit, no cursor in body)
      unipileBody = {};
    } else {
      // First page: build URL from filters
      const {
        searchType = "accounts",
        keywords,
        revenue,
        location,
        locationResolved,
        industry,
        industryResolved,
        companySize,
        seniority,
        jobFunction,
        yearsOfExperience,
        yearsAtCurrentCompany,
      } = body;

      const isLeads = searchType === "leads";

      // Use pre-resolved location objects if available, otherwise fall back to text resolution
      let finalLocation: RegionInput | RegionInput[] | undefined;
      if (locationResolved && Array.isArray(locationResolved) && locationResolved.length > 0) {
        // Frontend sent structured objects: { id, text, type }
        finalLocation = locationResolved.map((item: { id: string; text?: string; type?: string }) => ({
          id: item.id,
          text: item.text || item.id,
        }));
        console.log("[SEARCH] Using pre-resolved locations:", JSON.stringify(finalLocation));
      } else if (location) {
        finalLocation = await resolveLocationsToGeoIds(location, baseUrl, apiKey, accountId);
        console.log("[SEARCH] Resolved locations from text:", JSON.stringify(finalLocation));
      }

      // Build resolved industry entries from pre-resolved objects
      const resolvedIndustryEntries: { id: string; text: string }[] = [];
      if (industryResolved && Array.isArray(industryResolved) && industryResolved.length > 0) {
        for (const item of industryResolved) {
          const id = String(item.id || "").trim();
          const text = String(item.text || item.label || id).trim();
          if (id) resolvedIndustryEntries.push({ id, text });
        }
        console.log("[SEARCH] Using pre-resolved industries:", JSON.stringify(resolvedIndustryEntries));
      }

      const searchUrl = isLeads
        ? buildSalesNavLeadUrl({
            keywords,
            seniority,
            jobFunction,
            industryResolved: resolvedIndustryEntries.length > 0 ? resolvedIndustryEntries : undefined,
            location: finalLocation,
            companySize,
            yearsOfExperience,
            yearsAtCurrentCompany,
          })
        : buildSalesNavAccountUrl({
            keywords,
            companySize,
            revenue,
            industryResolved: resolvedIndustryEntries.length > 0 ? resolvedIndustryEntries : undefined,
            location: finalLocation,
          });

      console.log(`[SEARCH] Sales Navigator URL (${searchType}):`, searchUrl);
      console.log(`[SEARCH] Limit: ${effectiveLimit}`);

      unipileBody = {
        api: "sales_navigator",
        category: isLeads ? "people" : "companies",
        url: searchUrl,
      };
    }

    const response = await fetch(unipileUrl, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(unipileBody),
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

    // Log paging and cursor info
    const paging = data.paging || {};
    const nextCursor = data.cursor || null;
    console.log("[PAGINATION] paging:", JSON.stringify(paging), "cursor:", nextCursor);

    if ((data.items || []).length > 0) {
      console.log(`[SEARCH] First item keys:`, Object.keys(data.items[0]));
    }

    // Determine searchType: from body or infer from cursor response
    const searchType = body.searchType || (cursor ? inferSearchType(data.items) : "accounts");

    // Normalize response with expanded fallbacks
    let items;
    if (searchType === "leads") {
      items = (data.items || []).map((item: Record<string, unknown>) => {
        const currentPositions = item.current_positions as Array<Record<string, unknown>> | undefined;
        const firstPosition = currentPositions?.[0];
        const company = firstPosition?.company
          || item.company || item.current_company || item.company_name || item.companyName || "";

        const role = firstPosition?.role || "";

        return {
          firstName: item.first_name || item.firstName || "",
          lastName: item.last_name || item.lastName || "",
          title: role || item.headline || item.title || item.current_role || item.position || item.occupation || "",
          company: company,
          location: item.location || item.geo_location || item.geoLocation || item.geography || item.geo || item.region || "",
          linkedinUrl: item.profile_url || item.linkedinUrl || item.linkedin_url || item.url || item.publicProfileUrl || "",
          profilePictureUrl: item.profile_picture_url || item.profilePictureUrl || item.avatar_url || "",
          email: item.email || item.emailAddress || item.email_address ||
            (item.contactInfo as Record<string, unknown>)?.email || "",
          phoneNumber: item.phoneNumber || item.phone_number || item.phone ||
            (item.contactInfo as Record<string, unknown>)?.phone || "",
        };
      });
    } else {
      // Enrich company locations from profile endpoint
      const enrichedItems = await enrichCompanyLocations(data.items || [], baseUrl, apiKey, accountId);
      items = enrichedItems.map((item: Record<string, unknown>) => ({
        name: item.name || item.title || item.company_name || item.companyName || "",
        industry: item.industry || item.sector || item.vertical || "",
        location: item.location || item.headquarters || item.hq_location || item.headquarter ||
          item.company_location || item.companyLocation || item.geography || item.geo ||
          item.region || item.hqLocation || item.address || "",
        employeeCount: item.employeeCount || item.employee_count || item.size || item.staff_count || item.company_headcount || item.headcount || item.staffCount || item.companySize || "",
        linkedinUrl: item.linkedinUrl || item.linkedin_url || item.url || item.profile_url || item.publicProfileUrl || "",
        revenue: item.revenue || item.annual_revenue || item.annualRevenue || "",
      }));
    }

    return new Response(
      JSON.stringify({
        items,
        cursor: nextCursor,
        paging: {
          start: paging.start ?? 0,
          count: (data.items || []).length,
          total: paging.total_count ?? paging.total ?? null,
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

// Helper to infer search type when using cursor (no searchType in body)
function inferSearchType(items: Record<string, unknown>[]): string {
  if (!items || items.length === 0) return "accounts";
  const first = items[0];
  // People results typically have first_name or firstName
  if (first.first_name || first.firstName || first.last_name || first.lastName) return "leads";
  return "accounts";
}