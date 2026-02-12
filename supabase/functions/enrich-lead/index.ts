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

    // ============ ANTI-REPROCESSING CHECK ============
    const checkedAtField = searchType === "email" ? "email_checked_at" : "phone_checked_at";
    if (item[checkedAtField]) {
      const dataField = searchType === "email" ? "email" : "phone";
      return new Response(
        JSON.stringify({
          [dataField]: item[dataField] || null,
          source: item.enrichment_source,
          alreadyChecked: true,
          found: !!item[dataField],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ CONCURRENCY LOCK (optimistic) ============
    // Set checked_at immediately to prevent concurrent duplicate calls
    const { error: lockError, data: lockData } = await supabase
      .from("prospect_list_items")
      .update({ [checkedAtField]: new Date().toISOString() })
      .eq("id", itemId)
      .is(checkedAtField, null)
      .select("id")
      .single();

    if (lockError || !lockData) {
      // Another request already locked this — return early
      return new Response(
        JSON.stringify({
          alreadyChecked: true,
          found: false,
          message: "Enrichment already in progress or completed",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let email: string | null = null;
    let phone: string | null = null;
    let source: string | null = null;

    // ============ STEP 1: Apify (dedicated contact enrichment actor) ============
    console.log("Step 1: Trying Apify contact enrichment...");
    try {
      const apifyResult = await enrichWithApify(linkedinUrl, APIFY_API_KEY);
      if (apifyResult) {
        if (searchType === "email" && apifyResult.email) {
          email = apifyResult.email;
          source = "apify";
        }
        if (searchType === "phone" && apifyResult.phone) {
          phone = apifyResult.phone;
          source = "apify";
        }
        console.log("Apify result:", { email: apifyResult.email, phone: apifyResult.phone });
      }
    } catch (err) {
      console.error("Apify error:", err);
    }

    // ============ STEP 2: Apollo (fallback, scoped by searchType) ============
    const needsFallback =
      (searchType === "email" && !email) || (searchType === "phone" && !phone);

    if (needsFallback) {
      console.log("Step 2: Trying Apollo fallback...");
      const normalizedLinkedin = normalizeLinkedInUrl(linkedinUrl || item.linkedin_url);
      const resolvedFirst = firstName || item.name?.split(" ")[0] || "";
      const resolvedLast = lastName || item.name?.split(" ").slice(1).join(" ") || "";
      const resolvedCompany = company || item.company || "";

      const hasLinkedin = !!normalizedLinkedin;
      const hasNameAndOrg = !!(resolvedFirst && resolvedLast && resolvedCompany);

      console.log("Apollo identifiers:", { hasLinkedin, hasNameAndOrg, normalizedLinkedin, resolvedFirst, resolvedLast, resolvedCompany });

      if (!hasLinkedin && !hasNameAndOrg) {
        console.warn("Apollo skipped: no strong identifier (linkedin_url or name+org)");
      } else {
        try {
          const apolloResult = await enrichWithApollo(
            {
              firstName: resolvedFirst,
              lastName: resolvedLast,
              company: resolvedCompany,
              domain,
              linkedinUrl: normalizedLinkedin,
              email: item.email,
            },
            APOLLO_API_KEY,
            searchType
          );
          if (apolloResult) {
            if (searchType === "email" && !email && apolloResult.email) {
              email = apolloResult.email;
              source = source || "apollo";
            }
            if (searchType === "phone" && !phone && apolloResult.phone) {
              phone = apolloResult.phone;
              source = source || "apollo";
            }
            console.log("Apollo result:", apolloResult);
          } else {
            console.log("Apollo: no matching person found");
          }
        } catch (err) {
          console.error("Apollo matching error:", err);
        }
      }
    }

    // ============ Save results to DB ============
    const updateData: Record<string, string | null> = {};
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
      (searchType === "email" && !!email) || (searchType === "phone" && !!phone);

    return new Response(
      JSON.stringify({ email, phone, source, found }),
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
// Apify: Dedicated contact enrichment actor
// =============================================
async function enrichWithApify(
  linkedinUrl: string | null,
  apiKey: string
): Promise<{ email?: string; phone?: string } | null> {
  if (!linkedinUrl) return null;

  const actorId = "dev_fusion~linkedin-profile-scraper";
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

  const email =
    profile.email ||
    profile.emailAddress ||
    profile.emails?.[0] ||
    profile.contact?.email ||
    null;

  // Prioritize mobile number
  const phone =
    profile.mobileNumber ||
    profile.mobile_number ||
    profile.phone ||
    profile.phoneNumber ||
    profile.phones?.[0] ||
    profile.contact?.phone ||
    null;

  return { email, phone };
}

// =============================================
// LinkedIn URL Normalization
// =============================================
function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  let cleaned = url.trim();
  if (!cleaned) return null;

  // Remove trailing slashes
  cleaned = cleaned.replace(/\/+$/, "");

  // Extract the /in/username part
  const match = cleaned.match(/(?:linkedin\.com)?\/?in\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;

  return `https://www.linkedin.com/in/${match[1]}`;
}

// =============================================
// Apollo: People Match (scoped by searchType)
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
  apiKey: string,
  searchType: "email" | "phone"
): Promise<{ email?: string; phone?: string } | null> {
  const body: Record<string, unknown> = {};

  // Only request what we need based on searchType
  if (searchType === "email") {
    body.reveal_personal_emails = true;
  } else {
    body.reveal_phone_number = true;
  }

  // Add identifiers — linkedin_url is the strongest
  if (params.linkedinUrl) body.linkedin_url = params.linkedinUrl;
  if (params.firstName) body.first_name = params.firstName;
  if (params.lastName) body.last_name = params.lastName;
  if (params.company) body.organization_name = params.company;
  if (params.domain) body.domain = params.domain;
  if (params.email) body.email = params.email;

  console.log("Apollo /people/match payload:", JSON.stringify(body));

  const response = await fetch("https://api.apollo.io/api/v1/people/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apollo match error [${response.status}]: ${text}`);
  }

  const data = await response.json();
  const person = data.person;
  if (!person) {
    console.log("Apollo: person is null — no match found for given identifiers");
    return null;
  }

  console.log("Apollo matched person:", person.id, person.name);

  const result: { email?: string; phone?: string } = {};

  if (searchType === "email") {
    result.email = person.email || person.personal_emails?.[0] || null;
  } else {
    // Prioritize mobile/cell phone
    const mobile = person.phone_numbers?.find(
      (p: { type?: string; sanitized_number?: string }) =>
        p.type === "mobile" && p.sanitized_number
    );
    result.phone =
      mobile?.sanitized_number ||
      person.phone_numbers?.find(
        (p: { sanitized_number?: string }) => p.sanitized_number
      )?.sanitized_number ||
      person.mobile_phone ||
      null;
  }

  return result;
}
