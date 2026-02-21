import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CREDIT_COST_EMAIL = 1;
const CREDIT_COST_WHATSAPP = 8;

/**
 * Extract phone from Apollo person object.
 */
function extractPhone(person: Record<string, unknown>): string | null {
  if (!person) return null;
  const directPhone =
    (person.sanitized_phone as string) ||
    (person.phone_number as string) ||
    (person.mobile_phone as string) ||
    (person.corporate_phone as string) ||
    null;
  if (directPhone) return directPhone;

  const phoneNumbers = person.phone_numbers as Array<Record<string, unknown>> | undefined;
  if (phoneNumbers?.length) {
    const mobile = phoneNumbers.find((p) => p.type === "mobile");
    if (mobile?.sanitized_number) return mobile.sanitized_number as string;
    if (mobile?.raw_number) return mobile.raw_number as string;
    const first = phoneNumbers[0];
    return (first?.sanitized_number || first?.raw_number || first?.number) as string || null;
  }
  return null;
}

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
    const creditCost = searchType === "email" ? CREDIT_COST_EMAIL : CREDIT_COST_WHATSAPP;
    const { data: remaining } = await supabase.rpc("deduct_credits", {
      p_user_id: user.id,
      p_amount: creditCost,
      p_type: searchType === "email" ? "email_enrich" : "whatsapp_enrich",
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

    const hasStrongIdentifiers = !!(apolloId || (resolvedFirst && resolvedLast && (resolvedCompany || domain)));

    if (!hasStrongIdentifiers) {
      await supabase.rpc("add_credits", {
        p_user_id: user.id,
        p_amount: creditCost,
        p_type: "refund_enrich",
        p_description: `Reembolso ${searchType} - identificadores insuficientes`,
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

    // ============ APOLLO ENRICHMENT ============
    try {
      const body: Record<string, unknown> = {};
      if (apolloId) body.id = apolloId;
      if (resolvedFirst) body.first_name = resolvedFirst;
      if (resolvedLast) body.last_name = resolvedLast;
      if (resolvedCompany) body.organization_name = resolvedCompany;
      if (domain) body.domain = domain;
      if (item.email) body.email = item.email;

      if (searchType === "email") {
        body.reveal_personal_emails = true;
      } else {
        body.reveal_phone_number = true;
        const webhookUrl = `${SUPABASE_URL}/functions/v1/webhooks-apollo?itemId=${encodeURIComponent(itemId)}&searchType=phone`;
        body.webhook_url = webhookUrl;
      }

      console.log(`[enrich-lead] Apollo ${searchType} for ${itemId}:`, JSON.stringify(body));

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
          p_description: `Reembolso ${searchType} - erro API Apollo`,
        });
        throw new Error(`Apollo error [${response.status}]: ${errText}`);
      }

      const data = await response.json();
      const person = data?.person;

      // Also update linkedin_url if missing
      const linkedinUpdate: Record<string, unknown> = {};
      if (person?.linkedin_url && !item.linkedin_url) {
        linkedinUpdate.linkedin_url = person.linkedin_url;
      }

      // Phone enrichment is ASYNC — Apollo sends result via webhook
      if (searchType === "phone") {
        await supabase.from("prospect_list_items").update({
          ...linkedinUpdate,
          enrichment_status: "processing",
          apollo_called: true,
          apollo_reason: "waiting_webhook",
        }).eq("id", itemId);

        console.log("[enrich-lead] Phone enrichment dispatched, waiting for Apollo webhook");
        return new Response(
          JSON.stringify({ found: false, status: "processing", message: "Aguardando resultado do Apollo via webhook" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Email enrichment is SYNC
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
        // Refund credits when nothing is found
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
      console.error("[enrich-lead] Apollo error:", err);
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
  } catch (error) {
    console.error("[enrich-lead] Fatal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", found: false, status: "error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
