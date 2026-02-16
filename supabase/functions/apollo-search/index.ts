import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APOLLO_BASE = "https://api.apollo.io/api/v1";

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
      per_page = 25,
      person_titles,
      person_locations,
      person_seniorities,
      q_keywords,
      organization_locations,
      organization_num_employees_ranges,
      q_organization_keyword_tags,
      q_organization_name,
    } = body;

    // Apollo requires api_key in x-api-key header (not body)
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

    console.log("Apollo search:", url, JSON.stringify(Object.keys(apolloBody)));

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
      console.error("Apollo API error:", response.status, JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: data.message || `Apollo API error: ${response.status}`, items: [], pagination: { page: 1, total_pages: 0, total_entries: 0 } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (searchType === "companies") {
      const organizations = data.organizations || data.accounts || [];
      const items = organizations.map((org: Record<string, unknown>) => ({
        name: org.name || "",
        industry: org.industry || "",
        location: [org.city, org.state, org.country].filter(Boolean).join(", "),
        employeeCount: org.estimated_num_employees ? String(org.estimated_num_employees) : "",
        linkedinUrl: org.linkedin_url || "",
        website: org.website_url || org.primary_domain || "",
        apolloId: org.id || "",
      }));

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
      const items = people.map((p: Record<string, unknown>) => {
        const org = p.organization as Record<string, unknown> | undefined;
        return {
          firstName: p.first_name || "",
          lastName: p.last_name || "",
          title: p.title || p.headline || "",
          company: (org?.name as string) || p.organization_name || "",
          location: [p.city, p.state, p.country].filter(Boolean).join(", "),
          linkedinUrl: p.linkedin_url || "",
          profilePictureUrl: p.photo_url || "",
          apolloId: p.id || "",
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
    }
  } catch (err) {
    console.error("apollo-search error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error", items: [], pagination: { page: 1, total_pages: 0, total_entries: 0 } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
