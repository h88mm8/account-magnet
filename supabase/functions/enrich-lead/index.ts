import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) throw new Error("APIFY_API_KEY is not configured");

    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    if (!APOLLO_API_KEY) throw new Error("APOLLO_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const {
      data: { user },
    } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { itemId, searchType, linkedinUrl, firstName, lastName, company, domain } =
      await req.json();

    if (!itemId || !searchType) {
      return new Response(
        JSON.stringify({ error: "itemId and searchType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ownership
    const { data: item, error: itemError } = await supabase
      .from("prospect_list_items")
      .select("*")
      .eq("id", itemId)
      .eq("user_id", user.id)
      .single();

    if (itemError || !item) {
      return new Response(JSON.stringify({ error: "Item not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if data already exists
    if (searchType === "email" && item.email) {
      return new Response(
        JSON.stringify({ email: item.email, source: item.enrichment_source, alreadyExists: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (searchType === "phone" && item.phone) {
      return new Response(
        JSON.stringify({ phone: item.phone, source: item.enrichment_source, alreadyExists: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let email: string | null = null;
    let phone: string | null = null;
    let source: string | null = null;

    // ============ STEP 1: Apify ============
    console.log("Step 1: Trying Apify enrichment...");
    try {
      const apifyResult = await enrichWithApify(linkedinUrl, APIFY_API_KEY);
      if (apifyResult) {
        if (apifyResult.email) email = apifyResult.email;
        if (apifyResult.phone) phone = apifyResult.phone;
        if (email || phone) source = "apify";
        console.log("Apify result:", { email, phone });
      }
    } catch (err) {
      console.error("Apify error:", err);
    }

    // ============ STEP 2: Apollo (fallback) ============
    if ((searchType === "email" && !email) || (searchType === "phone" && !phone)) {
      console.log("Step 2: Trying Apollo fallback...");
      try {
        const apolloResult = await enrichWithApollo(
          { firstName, lastName, company, domain, linkedinUrl, email: item.email },
          APOLLO_API_KEY
        );
        if (apolloResult) {
          if (!email && apolloResult.email) {
            email = apolloResult.email;
            source = source || "apollo";
          }
          if (!phone && apolloResult.phone) {
            phone = apolloResult.phone;
            source = source || "apollo";
          }
          console.log("Apollo result:", { email: apolloResult.email, phone: apolloResult.phone });
        }
      } catch (err) {
        console.error("Apollo error:", err);
      }
    }

    // ============ Save to DB ============
    const updateData: Record<string, string> = {};
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (source) updateData.enrichment_source = source;

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("prospect_list_items")
        .update(updateData)
        .eq("id", itemId);

      if (updateError) {
        console.error("DB update error:", updateError);
      }
    }

    const found =
      (searchType === "email" && email) || (searchType === "phone" && phone);

    return new Response(
      JSON.stringify({
        email,
        phone,
        source,
        found: !!found,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("enrich-lead error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// =============================================
// Apify: Run LinkedIn profile scraper actor
// =============================================
async function enrichWithApify(
  linkedinUrl: string | null,
  apiKey: string
): Promise<{ email?: string; phone?: string } | null> {
  if (!linkedinUrl) return null;

  const actorId = "curious_coder~linkedin-profile-scraper";
  const runUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apiKey}`;

  const response = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profileUrls: [linkedinUrl],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apify error [${response.status}]: ${text}`);
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const profile = data[0];

  // Try multiple possible field names from Apify actor output
  const email =
    profile.email ||
    profile.emailAddress ||
    profile.emails?.[0] ||
    profile.contact?.email ||
    null;
  const phone =
    profile.phone ||
    profile.phoneNumber ||
    profile.phones?.[0] ||
    profile.contact?.phone ||
    null;

  return { email, phone };
}

// =============================================
// Apollo: People Enrichment (fallback)
// =============================================
async function enrichWithApollo(
  params: {
    firstName?: string;
    lastName?: string;
    company?: string;
    domain?: string;
    linkedinUrl?: string | null;
    email?: string | null;
  },
  apiKey: string
): Promise<{ email?: string; phone?: string } | null> {
  const body: Record<string, unknown> = {
    reveal_personal_emails: true,
    reveal_phone_number: true,
  };

  if (params.firstName) body.first_name = params.firstName;
  if (params.lastName) body.last_name = params.lastName;
  if (params.company) body.organization_name = params.company;
  if (params.domain) body.domain = params.domain;
  if (params.linkedinUrl) body.linkedin_url = params.linkedinUrl;
  if (params.email) body.email = params.email;

  const response = await fetch("https://api.apollo.io/api/v1/people/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apollo error [${response.status}]: ${text}`);
  }

  const data = await response.json();
  const person = data.person;
  if (!person) return null;

  const email = person.email || person.personal_emails?.[0] || null;
  const phone =
    person.phone_numbers?.find((p: { sanitized_number?: string }) => p.sanitized_number)
      ?.sanitized_number ||
    person.mobile_phone ||
    null;

  return { email, phone };
}
