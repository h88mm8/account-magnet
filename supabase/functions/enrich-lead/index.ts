import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CREDIT_COST_EMAIL = 1;
const CREDIT_COST_PHONE = 8;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    if (!APOLLO_API_KEY) throw new Error("APOLLO_API_KEY is not configured");

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

    // ============ RESOLVE IDENTIFIERS ============
    const resolvedFirst = firstName || item.name?.split(" ")[0] || "";
    const resolvedLast = lastName || item.name?.split(" ").slice(1).join(" ") || "";
    const resolvedCompany = company || item.company || "";
    const apolloId = item.provider_id || item.external_id || "";

    // ============ EMAIL ENRICHMENT (Apollo) ============
    if (searchType === "email") {
      const hasStrongIdentifiers = !!(apolloId || (resolvedFirst && resolvedLast && (resolvedCompany || domain)));

      if (!hasStrongIdentifiers) {
        await supabase.rpc("add_credits", {
          p_user_id: user.id,
          p_amount: creditCost,
          p_type: "refund_enrich",
          p_description: `Reembolso email - identificadores insuficientes`,
        });
        await supabase.from("prospect_list_items").update({
          enrichment_status: "done",
          apollo_called: false,
          apollo_reason: "no_strong_identifiers",
        }).eq("id", itemId);

        return new Response(
          JSON.stringify({ found: false, status: "done" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const body: Record<string, unknown> = { reveal_personal_emails: true };
        if (apolloId) body.id = apolloId;
        if (resolvedFirst) body.first_name = resolvedFirst;
        if (resolvedLast) body.last_name = resolvedLast;
        if (resolvedCompany) body.organization_name = resolvedCompany;
        if (domain) body.domain = domain;
        if (item.email) body.email = item.email;

        console.log(`[enrich-lead] Apollo email for ${itemId}:`, JSON.stringify(body));

        const response = await fetch("https://api.apollo.io/api/v1/people/match", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": APOLLO_API_KEY },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errText = await response.text();
          await supabase.rpc("add_credits", {
            p_user_id: user.id,
            p_amount: creditCost,
            p_type: "refund_enrich",
            p_description: `Reembolso email - erro API Apollo`,
          });
          throw new Error(`Apollo error [${response.status}]: ${errText}`);
        }

        const data = await response.json();
        const person = data?.person;

        const linkedinUpdate: Record<string, unknown> = {};
        if (person?.linkedin_url && !item.linkedin_url) {
          linkedinUpdate.linkedin_url = person.linkedin_url;
        }

        const updateData: Record<string, unknown> = {
          ...linkedinUpdate,
          enrichment_status: "done",
          apollo_called: true,
        };

        const email = person?.email || person?.personal_emails?.[0] || null;
        const found = !!email;
        if (email) {
          updateData.email = email;
          updateData.enrichment_source = "apollo";
          updateData.apollo_reason = "email_found";
        } else {
          updateData.apollo_reason = "email_not_found";
          await supabase.rpc("add_credits", {
            p_user_id: user.id,
            p_amount: creditCost,
            p_type: "refund_enrich",
            p_description: `Reembolso email - nenhum resultado encontrado`,
          });
        }

        await supabase.from("prospect_list_items").update(updateData).eq("id", itemId);

        return new Response(
          JSON.stringify({ email: found ? email : null, found, source: found ? "apollo" : null, status: "done" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("[enrich-lead] Apollo email error:", err);
        await supabase.from("prospect_list_items").update({
          enrichment_status: "error",
          apollo_called: true,
          apollo_reason: `error: ${err instanceof Error ? err.message : "unknown"}`,
        }).eq("id", itemId);

        return new Response(
          JSON.stringify({ found: false, status: "error", enrichmentError: "Falha no enrichment" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ============ PHONE ENRICHMENT (Apify LinkedIn Scraper) ============
    if (searchType === "phone") {
      const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
      if (!APIFY_API_KEY) {
        await supabase.rpc("add_credits", {
          p_user_id: user.id,
          p_amount: creditCost,
          p_type: "refund_enrich",
          p_description: `Reembolso phone - APIFY_API_KEY não configurada`,
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
          p_description: `Reembolso phone - sem LinkedIn URL`,
        });
        await supabase.from("prospect_list_items").update({
          enrichment_status: "done",
          apollo_reason: "no_linkedin_url_for_phone",
        }).eq("id", itemId);

        return new Response(
          JSON.stringify({ found: false, status: "done", error: "LinkedIn URL necessária para buscar telefone" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        // Start Apify LinkedIn scraper
        const actorId = "2SyF0bVxmgGr8IVCZ";
        const webhookUrl = `${SUPABASE_URL}/functions/v1/webhooks-apify`;
        const webhookPayload = JSON.stringify({
          itemId,
          searchType: "phone",
          userId: user.id,
        });

        console.log(`[enrich-lead] Starting Apify phone scraper for ${itemId}, LinkedIn: ${linkedinUrl}`);

        const actorUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_KEY}`;
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

        if (!runId) {
          throw new Error("Apify did not return a run ID");
        }

        // Register webhook for this run
        const webhookRegUrl = `https://api.apify.com/v2/actor-runs/${runId}/webhooks?token=${APIFY_API_KEY}`;
        await fetch(webhookRegUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.ABORTED", "ACTOR.RUN.TIMED_OUT"],
            requestUrl: webhookUrl,
            payloadTemplate: `{"runId":"${runId}","datasetId":"{{defaultDatasetId}}","eventType":"{{eventType}}","itemId":"${itemId}","searchType":"phone","userId":"${user.id}"}`,
          }),
        });

        // Update item with Apify run tracking
        await supabase.from("prospect_list_items").update({
          enrichment_status: "processing",
          apify_called: true,
          apify_finished: false,
          apify_run_id: runId,
          apollo_reason: "phone_via_apify",
        }).eq("id", itemId);

        console.log(`[enrich-lead] Apify phone run started: ${runId}`);

        return new Response(
          JSON.stringify({ found: false, status: "processing", message: "Aguardando resultado do Apify" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("[enrich-lead] Apify phone error:", err);
        await supabase.rpc("add_credits", {
          p_user_id: user.id,
          p_amount: creditCost,
          p_type: "refund_enrich",
          p_description: `Reembolso phone - erro Apify`,
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
