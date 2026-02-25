import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Webhook handler for Apify runs.
 * Now handles email enrichment results only (phone is via Apollo).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY")!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const payload = await req.json();
    console.log("Apify webhook received:", JSON.stringify(payload));

    const { runId, eventType, datasetId, itemId, searchType } = payload;

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
      console.log(`Apify run ${runId} ended with: ${eventType}. Marking as not_found.`);
      await supabase
        .from("prospect_list_items")
        .update({
          apify_finished: true,
          apify_email_found: false,
          enrichment_status: "not_found",
          apollo_reason: `apify_${eventType}`,
        })
        .eq("id", itemId);

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
        .update({
          apify_finished: true,
          apify_email_found: false,
          enrichment_status: "not_found",
          apollo_reason: "apify_dataset_read_failed",
        })
        .eq("id", itemId);

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
        .update({
          apify_finished: true,
          apify_email_found: false,
          enrichment_status: "not_found",
          apollo_reason: "apify_empty_dataset",
        })
        .eq("id", itemId);

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

    console.log("Apify extracted email:", apifyEmail);

    const updateData: Record<string, unknown> = {
      enrichment_status: "done",
      enrichment_source: "apify",
      apify_finished: true,
      apify_email_found: !!apifyEmail,
    };

    if (apifyEmail) {
      updateData.email = apifyEmail;
      updateData.apollo_reason = "email_found_apify_webhook";
    } else {
      updateData.apollo_reason = "email_not_found_apify_webhook";
    }

    await supabase.from("prospect_list_items").update(updateData).eq("id", itemId);

    console.log("Apify webhook: item updated successfully", { itemId, email: apifyEmail });

    return new Response(JSON.stringify({ ok: true, source: "apify", emailFound: !!apifyEmail }), {
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
