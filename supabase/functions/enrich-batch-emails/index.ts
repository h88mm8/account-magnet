import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CREDIT_COST_EMAIL = 1;
const MAX_LEADS = 100;
const CONCURRENCY = 5;

interface LeadInput {
  itemId: string;
  linkedinUrl?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  domain?: string;
}

interface LeadResult {
  itemId: string;
  emailFound: boolean;
  email?: string | null;
  source?: string;
  status: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    if (!APOLLO_API_KEY) throw new Error("APOLLO_API_KEY not configured");
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

    // Filter: skip leads that already have email
    const eligible: Array<{ input: LeadInput; item: Record<string, unknown> }> = [];
    for (const lead of leads) {
      const item = itemMap.get(lead.itemId);
      if (!item) continue;
      if (item.email_checked_at && item.email) continue;
      eligible.push({ input: lead, item });
    }

    if (eligible.length === 0) {
      return new Response(
        JSON.stringify({ totalProcessed: 0, emailsFound: 0, creditsUsed: 0, message: "No eligible leads" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Credit check
    const minCredits = eligible.length * CREDIT_COST_EMAIL;
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

    // Mark as processing
    await supabase
      .from("prospect_list_items")
      .update({ enrichment_status: "processing" })
      .in("id", eligible.map((e) => e.input.itemId));

    const results: LeadResult[] = [];
    let totalCreditsUsed = 0;

    async function processLead(entry: { input: LeadInput; item: Record<string, unknown> }): Promise<LeadResult> {
      const { input, item } = entry;
      const result: LeadResult = { itemId: input.itemId, emailFound: false, status: "done" };

      try {
        const firstName = input.firstName || (item.name as string)?.split(" ")[0] || "";
        const lastName = input.lastName || (item.name as string)?.split(" ").slice(1).join(" ") || "";
        const linkedinUrl = input.linkedinUrl || (item.linkedin_url as string) || "";

        if (!firstName && !lastName && !linkedinUrl) {
          result.status = "skipped";
          result.error = "no_identifiers";
          await supabase.from("prospect_list_items").update({
            enrichment_status: "done",
            apollo_reason: "no_strong_identifiers",
          }).eq("id", input.itemId);
          return result;
        }

        // Build Apollo /people/match body — ONLY email reveal
        const apolloBody: Record<string, unknown> = {
          reveal_personal_emails: true,
        };
        if (linkedinUrl) apolloBody.linkedin_url = linkedinUrl;
        if (firstName) apolloBody.first_name = firstName;
        if (lastName) apolloBody.last_name = lastName;
        const company = input.company || (item.company as string) || "";
        const domain = input.domain || "";
        if (company) apolloBody.organization_name = company;
        if (domain) apolloBody.domain = domain;

        console.log(`[batch-email] Apollo payload for ${input.itemId}:`, JSON.stringify(apolloBody));

        const apolloRes = await fetch("https://api.apollo.io/api/v1/people/match", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": APOLLO_API_KEY! },
          body: JSON.stringify(apolloBody),
        });

        const apolloText = await apolloRes.text();
        let foundEmail: string | null = null;

        if (apolloRes.ok) {
          const apolloData = JSON.parse(apolloText);
          const person = apolloData.person;
          if (person) {
            foundEmail = person.email || person.personal_emails?.[0] || null;
          }
        } else {
          console.error(`[batch-email] Apollo error for ${input.itemId}: ${apolloRes.status} ${apolloText.substring(0, 300)}`);
        }

        // Save results
        const updateData: Record<string, unknown> = {
          apollo_called: true,
          email_checked_at: new Date().toISOString(),
        };

        if (foundEmail) {
          updateData.email = foundEmail;
          updateData.enrichment_source = "apollo";
          updateData.enrichment_status = "done";
          result.emailFound = true;
          result.email = foundEmail;
          result.source = "apollo";

          const { data: remaining } = await supabase.rpc("deduct_credits", {
            p_user_id: user!.id,
            p_amount: CREDIT_COST_EMAIL,
            p_type: "batch_enrich_email",
            p_description: `Email encontrado - ${item.name}`,
            p_reference_id: input.itemId,
          });

          if (remaining === -1) {
            delete updateData.email;
            result.emailFound = false;
            result.status = "credit_error";
            updateData.enrichment_status = "done";
            updateData.apollo_reason = "insufficient_credits";
          } else {
            totalCreditsUsed += CREDIT_COST_EMAIL;
          }
        } else {
          updateData.enrichment_status = "not_found";
          updateData.apollo_reason = "email_not_found";
          result.status = "not_found";
        }

        await supabase.from("prospect_list_items").update(updateData).eq("id", input.itemId);
      } catch (err) {
        console.error(`[batch-email] Error for ${input.itemId}:`, err);
        result.status = "error";
        result.error = err instanceof Error ? err.message : "unknown";
        await supabase.from("prospect_list_items").update({
          enrichment_status: "error",
          email_checked_at: new Date().toISOString(),
          apollo_called: true,
          apollo_reason: `batch_error: ${result.error}`,
        }).eq("id", input.itemId);
      }

      return result;
    }

    for (let i = 0; i < eligible.length; i += CONCURRENCY) {
      const batch = eligible.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(processLead));
      results.push(...batchResults);
    }

    const emailsFound = results.filter((r) => r.emailFound).length;
    const summary = {
      totalProcessed: results.length,
      emailsFound,
      creditsUsed: totalCreditsUsed,
      results,
    };

    console.log(`[batch-email] Complete:`, JSON.stringify({ ...summary, results: undefined }));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[batch-email] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
