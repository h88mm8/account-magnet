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

    // Check if already processing
    if (item.enrichment_status === "processing") {
      return new Response(
        JSON.stringify({ status: "processing", message: "Enrichment already in progress" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ CONCURRENCY LOCK (optimistic) ============
    const { error: lockError, data: lockData } = await supabase
      .from("prospect_list_items")
      .update({
        [checkedAtField]: new Date().toISOString(),
        enrichment_status: "processing",
      })
      .eq("id", itemId)
      .is(checkedAtField, null)
      .select("id")
      .single();

    if (lockError || !lockData) {
      return new Response(
        JSON.stringify({
          alreadyChecked: true,
          found: false,
          message: "Enrichment already in progress or completed",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ RESOLVE IDENTIFIERS ============
    const publicLinkedinUrl = toPublicLinkedInUrl(linkedinUrl || item.linkedin_url);
    const resolvedFirst = firstName || item.name?.split(" ")[0] || "";
    const resolvedLast = lastName || item.name?.split(" ").slice(1).join(" ") || "";
    const resolvedCompany = company || item.company || "";

    // ============ STEP 1: Try Apify (async with webhook) ============
    if (publicLinkedinUrl) {
      console.log("Step 1: Starting Apify async job with public URL:", publicLinkedinUrl);

      try {
        const webhookUrl = `${SUPABASE_URL}/functions/v1/webhooks-apify`;
        const apifyRunId = await startApifyJob(
          publicLinkedinUrl,
          APIFY_API_KEY,
          webhookUrl,
          itemId,
          searchType,
          resolvedFirst,
          resolvedLast,
          resolvedCompany,
          domain || ""
        );

        console.log("Apify job started, runId:", apifyRunId);

        // Save run metadata
        await supabase
          .from("prospect_list_items")
          .update({
            apify_run_id: apifyRunId,
            apify_called: true,
          })
          .eq("id", itemId);

        // Return immediately — webhook will handle the rest
        return new Response(
          JSON.stringify({ status: "processing" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("Apify start error:", err);
        // Apify failed to start — fall through to Apollo directly
        await supabase
          .from("prospect_list_items")
          .update({ apify_called: true, apify_finished: true, apify_email_found: false })
          .eq("id", itemId);
      }
    } else {
      console.log("Step 1: Apify skipped — no valid public LinkedIn URL available");
      await supabase
        .from("prospect_list_items")
        .update({ apify_called: false, apify_finished: true })
        .eq("id", itemId);
    }

    // ============ STEP 2: Apollo (direct, no Apify URL available) ============
    // Only reaches here if Apify was skipped or failed to start
    console.log("Step 2: Going directly to Apollo (no Apify URL or Apify start failed)");

    const hasStrongIdentifiers = !!(resolvedFirst && resolvedLast && (resolvedCompany || domain));

    if (!hasStrongIdentifiers) {
      console.warn("Apollo skipped: no strong identifiers (name+org/domain required)");
      await supabase
        .from("prospect_list_items")
        .update({
          enrichment_status: "done",
          apollo_called: false,
          apollo_reason: "no_strong_identifiers",
        })
        .eq("id", itemId);

      return new Response(
        JSON.stringify({ found: false, status: "done" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Apollo synchronously since there's no Apify to wait for
    try {
      const apolloResult = await enrichWithApollo(
        { firstName: resolvedFirst, lastName: resolvedLast, company: resolvedCompany, domain, email: item.email },
        APOLLO_API_KEY,
        searchType
      );

      const email = searchType === "email" ? (apolloResult?.email || null) : null;
      const phone = searchType === "phone" ? (apolloResult?.phone || null) : null;
      const found = !!(email || phone);

      const updateData: Record<string, unknown> = {
        enrichment_status: "done",
        apollo_called: true,
        apollo_reason: "apify_skipped_no_public_url",
      };
      if (email) { updateData.email = email; updateData.enrichment_source = "apollo"; }
      if (phone) { updateData.phone = phone; updateData.enrichment_source = "apollo"; }

      await supabase.from("prospect_list_items").update(updateData).eq("id", itemId);

      console.log("Apollo direct result:", { email, phone, found });

      return new Response(
        JSON.stringify({ email, phone, found, source: found ? "apollo" : null, status: "done" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("Apollo error:", err);
      await supabase
        .from("prospect_list_items")
        .update({
          enrichment_status: "error",
          apollo_called: true,
          apollo_reason: `error: ${err instanceof Error ? err.message : "unknown"}`,
        })
        .eq("id", itemId);

      return new Response(
        JSON.stringify({ found: false, enrichmentError: "Falha no enrichment", status: "error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("enrich-lead error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        enrichmentError: "Falha no enrichment",
        found: false,
        status: "error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// =============================================
// Convert any LinkedIn URL to public /in/ format
// =============================================
function toPublicLinkedInUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const cleaned = url.trim();
  if (!cleaned) return null;

  const publicMatch = cleaned.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/);
  if (publicMatch) {
    return `https://www.linkedin.com/in/${publicMatch[1]}`;
  }

  if (cleaned.includes("linkedin.com/sales/")) {
    console.warn("Sales Navigator URL detected, cannot convert for Apify:", cleaned);
    return null;
  }

  if (cleaned.includes("linkedin.com")) {
    console.warn("Unrecognized LinkedIn URL format:", cleaned);
    return null;
  }

  return null;
}

// =============================================
// Start Apify job ASYNC (do NOT wait for result)
// Returns the run ID for tracking
// =============================================
async function startApifyJob(
  publicLinkedinUrl: string,
  apiKey: string,
  webhookUrl: string,
  itemId: string,
  searchType: string,
  firstName: string,
  lastName: string,
  company: string,
  domain: string
): Promise<string> {
  const actorId = "dev_fusion~linkedin-profile-scraper";

  // Step 1: Start the run (async, do NOT use run-sync)
  const runUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`;

  console.log("Apify start payload:", { profileUrls: [publicLinkedinUrl] });

  const runResponse = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profileUrls: [publicLinkedinUrl],
    }),
  });

  if (!runResponse.ok) {
    const text = await runResponse.text();
    throw new Error(`Apify start error [${runResponse.status}]: ${text}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data?.id;
  if (!runId) throw new Error("Apify did not return a run ID");

  console.log("Apify run started:", runId);

  // Step 2: Register webhook for this run
  const webhookPayload = {
    eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.ABORTED", "ACTOR.RUN.TIMED_OUT"],
    requestUrl: webhookUrl,
    payloadTemplate: JSON.stringify({
      runId: "{{runId}}",
      eventType: "{{eventType}}",
      datasetId: "{{defaultDatasetId}}",
      // Custom data passed through webhook
      itemId,
      searchType,
      firstName,
      lastName,
      company,
      domain,
    }),
    isAdHoc: true,
    idempotencyKey: `enrich-${itemId}-${searchType}`,
  };

  console.log("Registering Apify webhook for run:", runId);

  const webhookResponse = await fetch(
    `https://api.apify.com/v2/webhooks?token=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    }
  );

  if (!webhookResponse.ok) {
    const text = await webhookResponse.text();
    console.error("Webhook registration failed:", text);
    // Don't throw — we can still poll as fallback, but log the error
    console.warn("Webhook registration failed, run will still complete but webhook won't fire");
  } else {
    console.log("Apify webhook registered successfully");
  }

  return runId;
}

// =============================================
// Apollo: People Match (scoped by searchType)
// Auth: X-Api-Key header (official)
// =============================================
async function enrichWithApollo(
  params: {
    firstName?: string;
    lastName?: string;
    company?: string;
    domain?: string;
    email?: string | null;
  },
  apiKey: string,
  searchType: "email" | "phone"
): Promise<{ email?: string; phone?: string } | null> {
  const body: Record<string, unknown> = {};

  if (searchType === "email") {
    body.reveal_personal_emails = true;
  } else {
    body.reveal_phone_number = true;
  }

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
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  console.log("Apollo response status:", response.status);
  console.log("Apollo raw response:", responseText);

  if (!response.ok) {
    throw new Error(`Apollo match error [${response.status}]: ${responseText}`);
  }

  const data = JSON.parse(responseText);
  const person = data.person;
  if (!person) {
    console.log("Apollo: person is null — no match found");
    return null;
  }

  console.log("Apollo matched person:", person.id, person.name);

  const result: { email?: string; phone?: string } = {};

  if (searchType === "email") {
    result.email = person.email || person.personal_emails?.[0] || null;
  } else {
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
