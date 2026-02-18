import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APOLLO_BASE = "https://api.apollo.io/api/v1";

/** Resolve email from all possible Apollo payload locations */
function resolveEmail(p: Record<string, unknown>): string {
  // 1. Direct email field
  if (p.email && typeof p.email === "string" && p.email.includes("@")) return p.email;

  // 2. email_addresses array (object with .email property)
  const emailAddresses = p.email_addresses as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(emailAddresses) && emailAddresses.length > 0) {
    // Prefer work/personal type first
    const preferred = emailAddresses.find(
      (e) => e.type === "personal" || e.type === "work" || e.type === "professional"
    );
    const candidate = preferred || emailAddresses[0];
    const val = (candidate?.email || candidate?.value || candidate?.address) as string | undefined;
    if (val && val.includes("@")) return val;
  }

  // 3. emails array (plain strings)
  const emails = p.emails as unknown[] | undefined;
  if (Array.isArray(emails) && emails.length > 0) {
    const first = emails[0];
    if (typeof first === "string" && first.includes("@")) return first;
    if (typeof first === "object" && first !== null) {
      const val = ((first as Record<string, unknown>).email || (first as Record<string, unknown>).value) as string | undefined;
      if (val && val.includes("@")) return val;
    }
  }

  return "";
}

/** Resolve phone from all possible Apollo payload locations */
function resolvePhone(p: Record<string, unknown>): string {
  // 1. primary_phone object – Apollo v1 most common
  const primaryPhone = p.primary_phone as Record<string, unknown> | undefined;
  if (primaryPhone) {
    const num =
      (primaryPhone.sanitized_number as string) ||
      (primaryPhone.number as string) ||
      (primaryPhone.raw_number as string);
    if (num) return num;
  }

  // 2. sanitized_phone direct field
  if (p.sanitized_phone && typeof p.sanitized_phone === "string") return p.sanitized_phone as string;

  // 3. phone direct field
  if (p.phone && typeof p.phone === "string") return p.phone as string;

  // 4. phone_numbers array
  const phoneNumbers = p.phone_numbers as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(phoneNumbers) && phoneNumbers.length > 0) {
    // Prefer mobile/personal type
    const preferred = phoneNumbers.find(
      (ph) => ph.type === "mobile" || ph.type === "personal" || ph.type === "work_hq"
    );
    const candidate = preferred || phoneNumbers[0];
    const num =
      (candidate?.sanitized_number as string) ||
      (candidate?.number as string) ||
      (candidate?.raw_number as string);
    if (num) return num;
  }

  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("APOLLO_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "APOLLO_API_KEY not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      searchType = "people",
      page = 1,
      per_page = 100,
      person_titles,
      person_locations,
      person_seniorities,
      q_keywords,
      organization_locations,
      organization_num_employees_ranges,
      q_organization_keyword_tags,
      q_organization_name,
    } = body;

    // Always cap at 100 results (Apollo max)
    const apolloBody: Record<string, unknown> = {
      page,
      per_page: Math.min(per_page, 100),
    };

    let url: string;

    if (searchType === "companies") {
      url = `${APOLLO_BASE}/mixed_companies/search`;
      if (q_organization_name) apolloBody.q_organization_name = q_organization_name;
      if (q_organization_keyword_tags?.length) apolloBody.q_organization_keyword_tags = q_organization_keyword_tags;
      if (organization_locations?.length) apolloBody.organization_locations = organization_locations;
      if (organization_num_employees_ranges?.length) apolloBody.organization_num_employees_ranges = organization_num_employees_ranges;
    } else {
      url = `${APOLLO_BASE}/mixed_people/api_search`;
      if (q_keywords) apolloBody.q_keywords = q_keywords;
      if (person_titles?.length) apolloBody.person_titles = person_titles;
      if (person_locations?.length) apolloBody.person_locations = person_locations;
      if (person_seniorities?.length) apolloBody.person_seniorities = person_seniorities;
      if (organization_locations?.length) apolloBody.organization_locations = organization_locations;
      if (organization_num_employees_ranges?.length) apolloBody.organization_num_employees_ranges = organization_num_employees_ranges;
    }

    console.log(`[apollo-search] type=${searchType} page=${page} per_page=${apolloBody.per_page}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(apolloBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[apollo-search] API error:", response.status, JSON.stringify(data));
      return new Response(
        JSON.stringify({
          error: data.message || `Apollo API error: ${response.status}`,
          items: [],
          pagination: { page: 1, total_pages: 0, total_entries: 0 },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (searchType === "companies") {
      const organizations = data.organizations || data.accounts || [];

      // Log first record raw to inspect available fields
      if (organizations.length > 0) {
        const sample = organizations[0] as Record<string, unknown>;
        console.log("[apollo-search] company sample keys:", Object.keys(sample).join(", "));
      }

      const items = organizations.map((org: Record<string, unknown>) => {
        // Phone for companies
        const orgPhone =
          (org.sanitized_phone as string) ||
          (org.phone as string) ||
          ((org.primary_phone as Record<string, unknown>)?.sanitized_number as string) ||
          ((org.primary_phone as Record<string, unknown>)?.number as string) ||
          "";

        return {
          name: (org.name as string) || "",
          industry: (org.industry as string) || "",
          location: [org.city, org.state, org.country].filter(Boolean).join(", "),
          employeeCount: org.estimated_num_employees ? String(org.estimated_num_employees) : "",
          linkedinUrl: (org.linkedin_url as string) || "",
          website: (org.website_url as string) || (org.primary_domain as string) || "",
          domain: (org.primary_domain as string) || "",
          logoUrl: (org.logo_url as string) || "",
          foundedYear: org.founded_year ? String(org.founded_year) : "",
          revenue: org.annual_revenue ? String(org.annual_revenue) : "",
          phone: orgPhone,
          apolloId: (org.id as string) || "",
        };
      });

      return new Response(
        JSON.stringify({
          items,
          pagination: {
            page: data.pagination?.page || page,
            total_pages: data.pagination?.total_pages || 0,
            total_entries: data.pagination?.total_entries || 0,
            per_page: data.pagination?.per_page || per_page,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const people = data.people || data.contacts || [];

      // Log first record raw to inspect available fields
      if (people.length > 0) {
        const sample = people[0] as Record<string, unknown>;
        console.log("[apollo-search] person sample keys:", Object.keys(sample).join(", "));
        console.log("[apollo-search] person email fields:", JSON.stringify({
          email: sample.email,
          emails: sample.emails,
          email_addresses: sample.email_addresses,
          sanitized_phone: sample.sanitized_phone,
          primary_phone: sample.primary_phone,
          phone_numbers: sample.phone_numbers,
          phone: sample.phone,
        }));
      }

      const items = people.map((p: Record<string, unknown>) => {
        const org = p.organization as Record<string, unknown> | undefined;
        const email = resolveEmail(p);
        const phoneNumber = resolvePhone(p);

        return {
          firstName: (p.first_name as string) || "",
          lastName: (p.last_name as string) || "",
          title: (p.title as string) || (p.headline as string) || "",
          company: (org?.name as string) || (p.organization_name as string) || "",
          location: [p.city, p.state, p.country].filter(Boolean).join(", "),
          linkedinUrl: (p.linkedin_url as string) || "",
          profilePictureUrl: (p.photo_url as string) || "",
          email,
          phoneNumber,
          apolloId: (p.id as string) || "",
        };
      });

      console.log(`[apollo-search] mapped ${items.length} people. email coverage: ${items.filter((i: { email: string }) => i.email).length}/${items.length}`);

      return new Response(
        JSON.stringify({
          items,
          pagination: {
            page: data.pagination?.page || page,
            total_pages: data.pagination?.total_pages || 0,
            total_entries: data.pagination?.total_entries || 0,
            per_page: data.pagination?.per_page || per_page,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("[apollo-search] unhandled error:", err);
    return new Response(
      JSON.stringify({
        error: (err as Error).message || "Internal error",
        items: [],
        pagination: { page: 1, total_pages: 0, total_entries: 0 },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
