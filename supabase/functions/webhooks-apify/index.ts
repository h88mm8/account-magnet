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

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY")!;
  const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY")!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const payload = await req.json();
    console.log("Apify webhook received:", JSON.stringify(payload));

    const { runId, eventType, datasetId, itemId, searchType, firstName, lastName, company, domain } = payload;

    if (!itemId || !runId) {
      console.error("Missing required fields: itemId or runId");
      return new Response(JSON.stringify({ error: "Missing itemId or runId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify item exists
    const { data: item, error: itemError } = await supabase
      .from("prospect_list_items")
      .select("*")
      .eq("id", itemId)
      .single();

    if (itemError || !item) {
      console.error("Item not found:", itemId);
      return new Response(JSON.stringify({ error: "Item not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ HANDLE FAILED RUNS ============
    const isSuccess = eventType === "ACTOR.RUN.SUCCEEDED";
    if (!isSuccess) {
      console.log(`Apify run ${runId} ended with: ${eventType}. Going to Apollo fallback.`);

      await supabase
        .from("prospect_list_items")
        .update({
          apify_finished: true,
          apify_email_found: false,
        })
        .eq("id", itemId);

      // Try Apollo fallback
      await tryApolloFallback(supabase, item, searchType, firstName, lastName, company, domain, APOLLO_API_KEY, "apify_failed");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ READ APIFY DATASET ============
    console.log("Reading Apify dataset:", datasetId);

    const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}`;
    const datasetResponse = await fetch(datasetUrl);

    if (!datasetResponse.ok) {
      const text = await datasetResponse.text();
      console.error("Failed to read Apify dataset:", text);

      await supabase
        .from("prospect_list_items")
        .update({ apify_finished: true, apify_email_found: false })
        .eq("id", itemId);

      await tryApolloFallback(supabase, item, searchType, firstName, lastName, company, domain, APOLLO_API_KEY, "apify_dataset_read_failed");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const datasetItems = await datasetResponse.json();
    console.log("Apify dataset items count:", datasetItems?.length || 0);

    if (!Array.isArray(datasetItems) || datasetItems.length === 0) {
      console.log("Apify returned empty dataset");

      await supabase
        .from("prospect_list_items")
        .update({ apify_finished: true, apify_email_found: false })
        .eq("id", itemId);

      await tryApolloFallback(supabase, item, searchType, firstName, lastName, company, domain, APOLLO_API_KEY, "apify_empty_dataset");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ EXTRACT DATA FROM APIFY RESULT ============
    const profile = datasetItems[0];
    console.log("Apify profile keys:", Object.keys(profile));

    const apifyEmail =
      profile.email ||
      profile.emailAddress ||
      profile.emails?.[0] ||
      profile.contact?.email ||
      null;

    const apifyPhone =
      profile.mobileNumber ||
      profile.mobile_number ||
      profile.phone ||
      profile.phoneNumber ||
      profile.phones?.[0] ||
      profile.contact?.phone ||
      null;

    console.log("Apify extracted:", { email: apifyEmail, phone: apifyPhone });

    const apifyFoundEmail = !!apifyEmail;
    const apifyFoundPhone = !!apifyPhone;

    // ============ DETERMINE IF APIFY SATISFIED THE REQUEST ============
    const apifySatisfied =
      (searchType === "email" && apifyFoundEmail) ||
      (searchType === "phone" && apifyFoundPhone);

    if (apifySatisfied) {
      // Apify found what we need — finalize, NO Apollo
      console.log("Apify satisfied request. Finalizing without Apollo.");

      const updateData: Record<string, unknown> = {
        enrichment_status: "done",
        enrichment_source: "apify",
        apify_finished: true,
        apify_email_found: apifyFoundEmail,
        apollo_called: false,
        apollo_reason: null,
      };
      if (apifyEmail) updateData.email = apifyEmail;
      if (apifyPhone) updateData.phone = apifyPhone;

      await supabase.from("prospect_list_items").update(updateData).eq("id", itemId);

      console.log("Enrichment complete via Apify:", { email: apifyEmail, phone: apifyPhone });

      return new Response(JSON.stringify({ ok: true, source: "apify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ APIFY DIDN'T FIND — FALLBACK TO APOLLO ============
    console.log("Apify did not find requested data. Proceeding to Apollo fallback.");

    // Save partial Apify data if any
    const partialUpdate: Record<string, unknown> = {
      apify_finished: true,
      apify_email_found: apifyFoundEmail,
    };
    if (apifyEmail) partialUpdate.email = apifyEmail;
    if (apifyPhone) partialUpdate.phone = apifyPhone;

    await supabase.from("prospect_list_items").update(partialUpdate).eq("id", itemId);

    await tryApolloFallback(supabase, item, searchType, firstName, lastName, company, domain, APOLLO_API_KEY, "email_not_found_in_apify");

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// =============================================
// Apollo Fallback — called ONLY after Apify finishes
// =============================================
async function tryApolloFallback(
  supabase: ReturnType<typeof createClient>,
  item: Record<string, unknown>,
  searchType: string,
  firstName: string,
  lastName: string,
  company: string,
  domain: string,
  apolloApiKey: string,
  reason: string
) {
  const resolvedFirst = firstName || (item.name as string)?.split(" ")[0] || "";
  const resolvedLast = lastName || (item.name as string)?.split(" ").slice(1).join(" ") || "";
  const resolvedCompany = company || (item.company as string) || "";
  const resolvedDomain = domain || "";

  const hasStrongIdentifiers = !!(resolvedFirst && resolvedLast && (resolvedCompany || resolvedDomain));

  if (!hasStrongIdentifiers) {
    console.warn("Apollo skipped: no strong identifiers");
    await supabase
      .from("prospect_list_items")
      .update({
        enrichment_status: "done",
        apollo_called: false,
        apollo_reason: "no_strong_identifiers",
      })
      .eq("id", item.id as string);
    return;
  }

  console.log("Apollo fallback starting. Reason:", reason);

  try {
    const body: Record<string, unknown> = {};

    if (searchType === "email") {
      body.reveal_personal_emails = true;
    } else {
      body.reveal_phone_number = true;
    }

    body.first_name = resolvedFirst;
    body.last_name = resolvedLast;
    if (resolvedCompany) body.organization_name = resolvedCompany;
    if (resolvedDomain) body.domain = resolvedDomain;
    if (item.email) body.email = item.email;

    console.log("Apollo /people/match payload:", JSON.stringify(body));

    const response = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apolloApiKey,
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
      console.log("Apollo: no match found");
      await supabase
        .from("prospect_list_items")
        .update({
          enrichment_status: "done",
          apollo_called: true,
          apollo_reason: reason,
        })
        .eq("id", item.id as string);
      return;
    }

    console.log("Apollo matched person:", person.id, person.name);

    let email: string | null = null;
    let phone: string | null = null;

    if (searchType === "email") {
      email = person.email || person.personal_emails?.[0] || null;
    } else {
      const mobile = person.phone_numbers?.find(
        (p: { type?: string; sanitized_number?: string }) =>
          p.type === "mobile" && p.sanitized_number
      );
      phone =
        mobile?.sanitized_number ||
        person.phone_numbers?.find(
          (p: { sanitized_number?: string }) => p.sanitized_number
        )?.sanitized_number ||
        person.mobile_phone ||
        null;
    }

    const updateData: Record<string, unknown> = {
      enrichment_status: "done",
      apollo_called: true,
      apollo_reason: reason,
    };
    if (email) { updateData.email = email; updateData.enrichment_source = "apollo"; }
    if (phone) { updateData.phone = phone; updateData.enrichment_source = "apollo"; }

    await supabase.from("prospect_list_items").update(updateData).eq("id", item.id as string);

    console.log("Apollo result saved:", { email, phone });
  } catch (err) {
    console.error("Apollo fallback error:", err);
    await supabase
      .from("prospect_list_items")
      .update({
        enrichment_status: "error",
        apollo_called: true,
        apollo_reason: `error: ${err instanceof Error ? err.message : "unknown"}`,
      })
      .eq("id", item.id as string);
  }
}
