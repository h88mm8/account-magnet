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
    const resolvedFirst = firstName || item.name?.split(" ")[0] || "";
    const resolvedLast = lastName || item.name?.split(" ").slice(1).join(" ") || "";
    const resolvedCompany = company || item.company || "";

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

    // ============ APOLLO ENRICHMENT ============
    console.log("Starting Apollo enrichment for:", { itemId, searchType, resolvedFirst, resolvedLast, resolvedCompany });

    try {
      if (searchType === "phone") {
        // Phone enrichment is ASYNC — Apollo requires webhook_url
        const webhookBaseUrl = `${SUPABASE_URL}/functions/v1/webhooks-apollo`;
        const webhookUrl = `${webhookBaseUrl}?itemId=${encodeURIComponent(itemId)}&searchType=phone`;

        const apolloBody: Record<string, unknown> = {
          reveal_phone_number: true,
          webhook_url: webhookUrl,
        };
        if (resolvedFirst) apolloBody.first_name = resolvedFirst;
        if (resolvedLast) apolloBody.last_name = resolvedLast;
        if (resolvedCompany) apolloBody.organization_name = resolvedCompany;
        if (domain) apolloBody.domain = domain;
        if (item.email) apolloBody.email = item.email;

        console.log("Apollo /people/match (phone async) payload:", JSON.stringify(apolloBody));

        const response = await fetch("https://api.apollo.io/api/v1/people/match", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": APOLLO_API_KEY,
          },
          body: JSON.stringify(apolloBody),
        });

        const responseText = await response.text();
        console.log("Apollo phone response status:", response.status);

        if (!response.ok) {
          throw new Error(`Apollo match error [${response.status}]: ${responseText}`);
        }

        // Apollo accepted — webhook will deliver phone data later
        // Keep status as "processing" — webhook will set "done"
        console.log("Apollo phone enrichment dispatched, waiting for webhook");

        return new Response(
          JSON.stringify({ found: false, status: "processing", message: "Aguardando resultado do Apollo via webhook" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Email enrichment is SYNC
      const apolloResult = await enrichWithApollo(
        { firstName: resolvedFirst, lastName: resolvedLast, company: resolvedCompany, domain, email: item.email },
        APOLLO_API_KEY
      );

      const email = apolloResult?.email || null;
      const found = !!email;

      const updateData: Record<string, unknown> = {
        enrichment_status: "done",
        apollo_called: true,
        apollo_reason: "direct",
      };
      if (email) { updateData.email = email; updateData.enrichment_source = "apollo"; }

      await supabase.from("prospect_list_items").update(updateData).eq("id", itemId);

      console.log("Apollo result:", { email, found });

      return new Response(
        JSON.stringify({ email, found, source: found ? "apollo" : null, status: "done" }),
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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// =============================================
// Apollo: People Match (scoped by searchType)
// =============================================
async function enrichWithApollo(
  params: {
    firstName?: string;
    lastName?: string;
    company?: string;
    domain?: string;
    email?: string | null;
  },
  apiKey: string
): Promise<{ email?: string } | null> {
  const body: Record<string, unknown> = {
    reveal_personal_emails: true,
  };

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

  if (!response.ok) {
    throw new Error(`Apollo match error [${response.status}]: ${responseText}`);
  }

  const data = JSON.parse(responseText);
  const person = data.person;
  if (!person) {
    console.log("Apollo: no match found");
    return null;
  }

  console.log("Apollo matched person:", person.id, person.name);

  return {
    email: person.email || person.personal_emails?.[0] || null,
  };
}
