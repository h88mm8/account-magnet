import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CREDIT_COST_PHONE = 8;
const MAX_LEADS = 100;
const CONCURRENCY = 5;
const APIFY_TIMEOUT_MS = 40000;
const APIFY_POLL_INTERVAL_MS = 3000;

interface LeadInput {
  itemId: string;
  linkedinUrl?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  apolloId?: string;
}

interface LeadResult {
  itemId: string;
  phoneFound: boolean;
  phone?: string | null;
  source?: string;
  status: string;
  error?: string;
}

/**
 * Resolve LinkedIn URL via Apollo /people/match using apolloId or name+company.
 */
async function resolveLinkedInUrl(
  input: LeadInput,
  item: Record<string, unknown>,
  apolloApiKey: string
): Promise<string | null> {
  const apolloId = input.apolloId || (item.provider_id as string) || "";
  const firstName = input.firstName || "";
  const lastName = input.lastName || "";
  const company = input.company || (item.company as string) || "";

  if (!apolloId && !firstName) return null;

  try {
    const body: Record<string, unknown> = {};
    if (apolloId) body.id = apolloId;
    if (firstName) body.first_name = firstName;
    if (lastName) body.last_name = lastName;
    if (company) body.organization_name = company;

    console.log(`[batch-phone] Resolving LinkedIn URL via Apollo for ${input.itemId}, apolloId: ${apolloId}`);

    const res = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apolloApiKey },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(`[batch-phone] Apollo match failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const person = data?.person;
    const linkedinUrl = person?.linkedin_url;

    if (linkedinUrl) {
      console.log(`[batch-phone] Resolved LinkedIn URL for ${input.itemId}: ${linkedinUrl}`);
      // Also update the item in DB for future use
      return linkedinUrl;
    }
    return null;
  } catch (err) {
    console.error(`[batch-phone] Apollo match error for ${input.itemId}:`, err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) throw new Error("APIFY_API_KEY not configured");
    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { leads } = await req.json() as { leads: LeadInput[] };

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return new Response(JSON.stringify({ error: "leads array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (leads.length > MAX_LEADS) {
      return new Response(JSON.stringify({ error: `Maximum ${MAX_LEADS} leads per batch` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const itemIds = leads.map((l) => l.itemId);
    const { data: items, error: fetchErr } = await supabase
      .from("prospect_list_items")
      .select("*")
      .in("id", itemIds)
      .eq("user_id", user.id);

    if (fetchErr || !items) {
      return new Response(JSON.stringify({ error: "Failed to fetch items" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const itemMap = new Map(items.map((i: Record<string, unknown>) => [i.id as string, i]));

    // Filter: skip leads that already have phone
    // Now accepts leads without linkedin_url if they have provider_id (apolloId)
    const eligible: Array<{ input: LeadInput; item: Record<string, unknown> }> = [];
    for (const lead of leads) {
      const item = itemMap.get(lead.itemId);
      if (!item) continue;
      if (item.phone_checked_at && item.phone) continue;
      const linkedinUrl = lead.linkedinUrl || (item.linkedin_url as string) || "";
      const apolloId = lead.apolloId || (item.provider_id as string) || "";
      // Accept if has linkedin URL OR apolloId (we can resolve URL via Apollo)
      if (!linkedinUrl && !apolloId) continue;
      eligible.push({ input: { ...lead, apolloId }, item });
    }

    if (eligible.length === 0) {
      return new Response(
        JSON.stringify({ totalProcessed: 0, phonesFound: 0, creditsUsed: 0, message: "No eligible leads" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Credit check
    const minCredits = eligible.length * CREDIT_COST_PHONE;
    const { data: balanceData } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();
    const currentBalance = balanceData?.balance ?? 0;

    if (currentBalance < minCredits) {
      return new Response(
        JSON.stringify({ error: "Créditos insuficientes", required: minCredits, available: currentBalance, eligibleCount: eligible.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: LeadResult[] = [];
    let totalCreditsUsed = 0;

    async function processLead(entry: { input: LeadInput; item: Record<string, unknown> }): Promise<LeadResult> {
      const { input, item } = entry;
      const result: LeadResult = { itemId: input.itemId, phoneFound: false, status: "done" };
      let linkedinUrl = input.linkedinUrl || (item.linkedin_url as string) || "";

      // If no LinkedIn URL, resolve via Apollo using apolloId
      if (!linkedinUrl && APOLLO_API_KEY) {
        const resolved = await resolveLinkedInUrl(input, item, APOLLO_API_KEY);
        if (resolved) {
          linkedinUrl = resolved;
          // Persist the resolved LinkedIn URL for future use
          await supabase.from("prospect_list_items").update({ linkedin_url: resolved }).eq("id", input.itemId);
        }
      }

      if (!linkedinUrl) {
        result.status = "not_found";
        result.error = "no_linkedin_url";
        await supabase.from("prospect_list_items").update({
          phone_checked_at: new Date().toISOString(),
          enrichment_status: "not_found",
          apollo_reason: "linkedin_url_not_resolved",
        }).eq("id", input.itemId);
        return result;
      }

      try {
        console.log(`[batch-phone] Starting Apify for ${input.itemId}, url: ${linkedinUrl}`);

        const actorId = "2SyF0bVxmgGr8IVCZ";
        const actorUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_KEY}`;
        const apifyStartRes = await fetch(actorUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keywords: [linkedinUrl],
            platform: "linkedin_profile",
            country: "Global",
            maxPhoneNumbers: 1,
          }),
        });
        const apifyStartData = await apifyStartRes.json();
        const runId = apifyStartData?.data?.id;
        const datasetId = apifyStartData?.data?.defaultDatasetId;

        if (!runId) {
          console.error(`[batch-phone] Apify start failed for ${input.itemId}:`, JSON.stringify(apifyStartData));
          result.status = "error";
          result.error = "apify_start_failed";
          await supabase.from("prospect_list_items").update({
            enrichment_status: "error",
            phone_checked_at: new Date().toISOString(),
            apollo_reason: "apify_start_failed",
          }).eq("id", input.itemId);
          return result;
        }

        console.log(`[batch-phone] Apify run started: ${runId}, dataset: ${datasetId}`);

        // Poll for completion
        const startTime = Date.now();
        let foundPhone: string | null = null;

        while (Date.now() - startTime < APIFY_TIMEOUT_MS) {
          await new Promise((r) => setTimeout(r, APIFY_POLL_INTERVAL_MS));
          const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_KEY}`);
          const statusData = await statusRes.json();
          const runStatus = statusData?.data?.status;

          if (runStatus === "SUCCEEDED") {
            const dsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}`);
            const dsItems = await dsRes.json();
            console.log(`[batch-phone] Apify dataset items for ${input.itemId}:`, JSON.stringify(dsItems?.length ? Object.keys(dsItems[0]) : "empty"));
            if (Array.isArray(dsItems) && dsItems.length > 0) {
              const profile = dsItems[0];
              // Cover all known field variations from Apify LinkedIn scrapers
              foundPhone =
                profile.phone_number ||
                profile.phoneNumber ||
                profile.mobileNumber ||
                profile.mobile_number ||
                profile.phone ||
                profile.phones?.[0] ||
                profile.contact?.phone ||
                null;
              console.log(`[batch-phone] Extracted phone for ${input.itemId}: ${foundPhone}`);
            }
            break;
          } else if (["FAILED", "ABORTED", "TIMED-OUT"].includes(runStatus)) {
            console.warn(`[batch-phone] Apify run ${runId} ended with: ${runStatus}`);
            break;
          }
        }

        // Update tracking
        await supabase.from("prospect_list_items").update({
          apify_called: true,
          apify_finished: true,
          apify_run_id: runId,
        }).eq("id", input.itemId);

        const updateData: Record<string, unknown> = {
          phone_checked_at: new Date().toISOString(),
        };

        if (foundPhone) {
          updateData.phone = foundPhone;
          updateData.enrichment_source = "apify";
          updateData.enrichment_status = "done";
          result.phoneFound = true;
          result.phone = foundPhone;
          result.source = "apify";

          const { data: remaining } = await supabase.rpc("deduct_credits", {
            p_user_id: user!.id,
            p_amount: CREDIT_COST_PHONE,
            p_type: "batch_enrich_phone",
            p_description: `Telefone encontrado - ${item.name}`,
            p_reference_id: input.itemId,
          });

          if (remaining === -1) {
            delete updateData.phone;
            result.phoneFound = false;
            result.status = "credit_error";
            updateData.enrichment_status = "done";
            updateData.apollo_reason = "insufficient_credits";
          } else {
            totalCreditsUsed += CREDIT_COST_PHONE;
          }
        } else {
          updateData.enrichment_status = "not_found";
          updateData.apollo_reason = "phone_not_found";
          result.status = "not_found";
        }

        await supabase.from("prospect_list_items").update(updateData).eq("id", input.itemId);
      } catch (err) {
        console.error(`[batch-phone] Error for ${input.itemId}:`, err);
        result.status = "error";
        result.error = err instanceof Error ? err.message : "unknown";
        await supabase.from("prospect_list_items").update({
          enrichment_status: "error",
          phone_checked_at: new Date().toISOString(),
          apollo_reason: `batch_phone_error: ${result.error}`,
        }).eq("id", input.itemId);
      }

      return result;
    }

    for (let i = 0; i < eligible.length; i += CONCURRENCY) {
      const batch = eligible.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(processLead));
      results.push(...batchResults);
    }

    const phonesFound = results.filter((r) => r.phoneFound).length;
    const summary = {
      totalProcessed: results.length,
      phonesFound,
      creditsUsed: totalCreditsUsed,
      results,
    };

    console.log(`[batch-phone] Complete:`, JSON.stringify({ ...summary, results: undefined }));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[batch-phone] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
