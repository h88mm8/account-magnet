import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CREDIT_COST_EMAIL = 1;
const CREDIT_COST_PHONE = 8;
const APIFY_ACTOR_ID = "2SyF0bVxmgGr8IVCZ";
const APIFY_POLL_INTERVAL_MS = 3000;
const APIFY_TIMEOUT_MS = 45000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { itemId, searchType, firstName, lastName, company, domain } = await req.json();

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

    // ============ CREDIT CHECK ============
    const creditCost = searchType === "email" ? CREDIT_COST_EMAIL : CREDIT_COST_PHONE;
    const { data: remaining } = await supabase.rpc("deduct_credits", {
      p_user_id: user.id,
      p_amount: creditCost,
      p_type: searchType === "email" ? "email_enrich" : "phone_enrich",
      p_description: `Enriquecimento ${searchType} - ${item.name}`,
      p_reference_id: itemId,
    });

    if (remaining === -1) {
      return new Response(
        JSON.stringify({ error: "Créditos insuficientes", found: false, status: "error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ CONCURRENCY LOCK ============
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
      await supabase.rpc("add_credits", {
        p_user_id: user.id,
        p_amount: creditCost,
        p_type: "refund_enrich",
        p_description: `Reembolso ${searchType} - já em processamento`,
      });
      return new Response(
        JSON.stringify({ alreadyChecked: true, found: false, message: "Already in progress" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ EMAIL ENRICHMENT (Apify LinkedIn Scraper) ============
    if (searchType === "email") {
      const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
      if (!APIFY_API_KEY) {
        await supabase.rpc("add_credits", {
          p_user_id: user.id,
          p_amount: creditCost,
          p_type: "refund_enrich",
          p_description: `Reembolso email - APIFY_API_KEY não configurada`,
        });
        await supabase.from("prospect_list_items").update({
          enrichment_status: "error",
          apollo_reason: "apify_not_configured",
        }).eq("id", itemId);
        return new Response(
          JSON.stringify({ found: false, status: "error", error: "Apify not configured" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const linkedinUrl = item.linkedin_url as string;
      if (!linkedinUrl) {
        await supabase.rpc("add_credits", {
          p_user_id: user.id,
          p_amount: creditCost,
          p_type: "refund_enrich",
          p_description: `Reembolso email - sem LinkedIn URL`,
        });
        await supabase.from("prospect_list_items").update({
          enrichment_status: "done",
          apollo_reason: "no_linkedin_url_for_email",
        }).eq("id", itemId);
        return new Response(
          JSON.stringify({ found: false, status: "done", error: "LinkedIn URL necessária para buscar email" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        console.log(`[enrich-lead] Apify email for ${itemId}, LinkedIn: ${linkedinUrl}`);

        const actorUrl = `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_API_KEY}`;
        const apifyRes = await fetch(actorUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startUrls: [{ url: linkedinUrl }],
            maxItems: 1,
          }),
        });

        if (!apifyRes.ok) {
          const errText = await apifyRes.text();
          throw new Error(`Apify start error [${apifyRes.status}]: ${errText}`);
        }

        const apifyData = await apifyRes.json();
        const runId = apifyData?.data?.id;
        const datasetId = apifyData?.data?.defaultDatasetId;

        if (!runId || !datasetId) throw new Error("Apify did not return runId/datasetId");

        // Poll for completion
        let foundEmail: string | null = null;
        const startTime = Date.now();

        while (Date.now() - startTime < APIFY_TIMEOUT_MS) {
          await new Promise((r) => setTimeout(r, APIFY_POLL_INTERVAL_MS));
          const statusRes = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_KEY}`
          );
          const statusData = await statusRes.json();
          const runStatus = statusData?.data?.status;

          if (runStatus === "SUCCEEDED") {
            const dsRes = await fetch(
              `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}`
            );
            const dsItems = await dsRes.json();
            if (Array.isArray(dsItems) && dsItems.length > 0) {
              const profile = dsItems[0];
              foundEmail = profile.email || profile.emailAddress || profile.emails?.[0] || 
                profile.contact?.email || null;
            }
            break;
          } else if (["FAILED", "ABORTED", "TIMED-OUT"].includes(runStatus)) {
            console.warn(`[enrich-lead] Apify run ${runStatus} for ${itemId}`);
            break;
          }
        }

        const updateData: Record<string, unknown> = {
          enrichment_status: "done",
          apify_called: true,
          apify_finished: true,
          apify_run_id: runId,
        };

        const found = !!foundEmail;
        if (foundEmail) {
          updateData.email = foundEmail;
          updateData.enrichment_source = "apify";
          updateData.apify_email_found = true;
          updateData.apollo_reason = "email_found_apify";
        } else {
          updateData.apify_email_found = false;
          updateData.apollo_reason = "email_not_found_apify";
          await supabase.rpc("add_credits", {
            p_user_id: user.id,
            p_amount: creditCost,
            p_type: "refund_enrich",
            p_description: `Reembolso email - nenhum resultado encontrado`,
          });
        }

        await supabase.from("prospect_list_items").update(updateData).eq("id", itemId);

        return new Response(
          JSON.stringify({ email: found ? foundEmail : null, found, source: found ? "apify" : null, status: "done" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("[enrich-lead] Apify email error:", err);
        await supabase.rpc("add_credits", {
          p_user_id: user.id,
          p_amount: creditCost,
          p_type: "refund_enrich",
          p_description: `Reembolso email - erro Apify`,
        });
        await supabase.from("prospect_list_items").update({
          enrichment_status: "error",
          apify_called: true,
          apollo_reason: `apify_error: ${err instanceof Error ? err.message : "unknown"}`,
        }).eq("id", itemId);

        return new Response(
          JSON.stringify({ found: false, status: "error", enrichmentError: "Falha no scraping" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ============ PHONE ENRICHMENT (Apollo /people/match + webhook) ============
    if (searchType === "phone") {
      const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
      if (!APOLLO_API_KEY) {
        await supabase.rpc("add_credits", {
          p_user_id: user.id,
          p_amount: creditCost,
          p_type: "refund_enrich",
          p_description: `Reembolso phone - APOLLO_API_KEY não configurada`,
        });
        await supabase.from("prospect_list_items").update({
          enrichment_status: "error",
          apollo_reason: "apollo_not_configured",
        }).eq("id", itemId);
        return new Response(
          JSON.stringify({ found: false, status: "error", error: "Apollo not configured" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const resolvedFirst = firstName || item.name?.split(" ")[0] || "";
      const resolvedLast = lastName || item.name?.split(" ").slice(1).join(" ") || "";
      const resolvedCompany = company || item.company || "";
      const apolloId = item.provider_id || item.external_id || "";

      const hasIdentifiers = !!(apolloId || (resolvedFirst && resolvedLast));
      if (!hasIdentifiers) {
        await supabase.rpc("add_credits", {
          p_user_id: user.id,
          p_amount: creditCost,
          p_type: "refund_enrich",
          p_description: `Reembolso phone - identificadores insuficientes`,
        });
        await supabase.from("prospect_list_items").update({
          enrichment_status: "done",
          apollo_reason: "no_strong_identifiers_for_phone",
        }).eq("id", itemId);
        return new Response(
          JSON.stringify({ found: false, status: "done" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const webhookUrl = `${SUPABASE_URL}/functions/v1/webhooks-apollo?itemId=${encodeURIComponent(itemId)}&searchType=phone`;
        const body: Record<string, unknown> = {
          reveal_phone_number: true,
          webhook_url: webhookUrl,
        };
        if (apolloId) body.id = apolloId;
        if (resolvedFirst) body.first_name = resolvedFirst;
        if (resolvedLast) body.last_name = resolvedLast;
        if (resolvedCompany) body.organization_name = resolvedCompany;
        if (domain) body.domain = domain;
        if (item.email) body.email = item.email;

        console.log(`[enrich-lead] Apollo phone for ${itemId}:`, JSON.stringify(body));

        const response = await fetch("https://api.apollo.io/api/v1/people/match", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": APOLLO_API_KEY },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Apollo error [${response.status}]: ${errText}`);
        }

        // Apollo processes phone async via webhook
        await supabase.from("prospect_list_items").update({
          enrichment_status: "processing",
          apollo_called: true,
          apollo_reason: "phone_via_apollo_webhook",
        }).eq("id", itemId);

        console.log(`[enrich-lead] Apollo phone request sent for ${itemId}, waiting for webhook`);

        return new Response(
          JSON.stringify({ found: false, status: "processing", message: "Aguardando resultado do Apollo" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("[enrich-lead] Apollo phone error:", err);
        await supabase.rpc("add_credits", {
          p_user_id: user.id,
          p_amount: creditCost,
          p_type: "refund_enrich",
          p_description: `Reembolso phone - erro Apollo`,
        });
        await supabase.from("prospect_list_items").update({
          enrichment_status: "error",
          apollo_called: true,
          apollo_reason: `apollo_error: ${err instanceof Error ? err.message : "unknown"}`,
        }).eq("id", itemId);

        return new Response(
          JSON.stringify({ found: false, status: "error", enrichmentError: "Falha no enrichment" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Invalid searchType" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[enrich-lead] Fatal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", found: false, status: "error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
