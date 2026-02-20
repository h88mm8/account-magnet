import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APOLLO_BASE = "https://api.apollo.io/api/v1";

/** Resolve email from all possible Apollo payload locations */
function resolveEmail(p: Record<string, unknown>): string {
  if (p.email && typeof p.email === "string" && p.email.includes("@")) return p.email;
  // reveal_personal_emails returns this array
  const personalEmails = p.personal_emails as string[] | undefined;
  if (Array.isArray(personalEmails) && personalEmails.length > 0) {
    const first = personalEmails[0];
    if (typeof first === "string" && first.includes("@")) return first;
  }
  const emailAddresses = p.email_addresses as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(emailAddresses) && emailAddresses.length > 0) {
    const preferred = emailAddresses.find(
      (e) => e.type === "personal" || e.type === "work" || e.type === "professional"
    );
    const candidate = preferred || emailAddresses[0];
    const val = (candidate?.email || candidate?.value || candidate?.address) as string | undefined;
    if (val && val.includes("@")) return val;
  }
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
  const primaryPhone = p.primary_phone as Record<string, unknown> | undefined;
  if (primaryPhone) {
    const num = (primaryPhone.sanitized_number as string) || (primaryPhone.number as string) || (primaryPhone.raw_number as string);
    if (num) return num;
  }
  if (p.sanitized_phone && typeof p.sanitized_phone === "string") return p.sanitized_phone as string;
  if (p.phone && typeof p.phone === "string") return p.phone as string;
  const phoneNumbers = p.phone_numbers as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(phoneNumbers) && phoneNumbers.length > 0) {
    const preferred = phoneNumbers.find(
      (ph) => ph.type === "mobile" || ph.type === "personal" || ph.type === "work_hq"
    );
    const candidate = preferred || phoneNumbers[0];
    const num = (candidate?.sanitized_number as string) || (candidate?.number as string) || (candidate?.raw_number as string);
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

    // ── Auth + Supabase client ──
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    let userId: string | null = null;
    let supabase: ReturnType<typeof createClient> | null = null;

    if (authHeader) {
      const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
      if (user) {
        userId = user.id;
        supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      }
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

    // ── Credit check: 1 credit per search page ──
    const SEARCH_PAGE_COST = 1;
    if (userId && supabase) {
      const { data: remaining } = await supabase.rpc("deduct_credits", {
        p_user_id: userId,
        p_amount: SEARCH_PAGE_COST,
        p_type: "search_page",
        p_description: `Busca ${searchType} página ${page}`,
      });

      if (remaining === -1) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes", items: [], pagination: { page: 1, total_pages: 0, total_entries: 0 } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`[credits] Deducted ${SEARCH_PAGE_COST} for search_page. Remaining: ${remaining}`);
    }

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
      url = `${APOLLO_BASE}/mixed_people/search`;
      apolloBody.reveal_personal_emails = true;
      apolloBody.reveal_phone_number = true;
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
      // Refund the credit on API error
      if (userId && supabase) {
        await supabase.rpc("add_credits", {
          p_user_id: userId,
          p_amount: SEARCH_PAGE_COST,
          p_type: "refund_search",
          p_description: `Reembolso busca ${searchType} - erro API ${response.status}`,
        });
        console.log(`[credits] Refunded ${SEARCH_PAGE_COST} due to API error`);
      }
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
      if (organizations.length > 0) {
        const sample = organizations[0] as Record<string, unknown>;
        console.log("[apollo-search] company sample keys:", Object.keys(sample).join(", "));
      }

      const items = organizations.map((org: Record<string, unknown>) => {
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
      if (people.length > 0) {
        const sample = people[0] as Record<string, unknown>;
        console.log("[apollo-search] person sample keys:", Object.keys(sample).join(", "));
        console.log("[apollo-search] person sample email fields:", JSON.stringify({
          email: sample.email,
          personal_emails: sample.personal_emails,
          email_addresses: sample.email_addresses,
          emails: sample.emails,
        }));
        console.log("[apollo-search] person sample phone fields:", JSON.stringify({
          phone: sample.phone,
          sanitized_phone: sample.sanitized_phone,
          primary_phone: sample.primary_phone,
          phone_numbers: sample.phone_numbers,
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
