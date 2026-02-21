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
 * Extract phone from Apollo person object, checking multiple fields.
 */
function extractPhone(person: Record<string, unknown>): string | null {
  if (!person) return null;

  // Direct fields
  const directPhone =
    (person.sanitized_phone as string) ||
    (person.phone_number as string) ||
    (person.mobile_phone as string) ||
    (person.corporate_phone as string) ||
    null;
  if (directPhone) return directPhone;

  // phone_numbers array
  const phoneNumbers = person.phone_numbers as Array<Record<string, unknown>> | undefined;
  if (phoneNumbers?.length) {
    // Prefer mobile
    const mobile = phoneNumbers.find((p) => p.type === "mobile");
    if (mobile?.sanitized_number) return mobile.sanitized_number as string;
    if (mobile?.raw_number) return mobile.raw_number as string;
    // Fallback to first
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

    // Filter: skip leads that already have phone checked
    const eligible: Array<{ input: LeadInput; item: Record<string, unknown> }> = [];
    for (const lead of leads) {
      const item = itemMap.get(lead.itemId);
      if (!item) continue;
      if (item.phone_checked_at && item.phone) continue;
      const apolloId = lead.apolloId || (item.provider_id as string) || (item.external_id as string) || "";
      const firstName = lead.firstName || (item.name as string)?.split(" ")[0] || "";
      if (!apolloId && !firstName) continue;
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

      try {
        const apolloId = input.apolloId || (item.provider_id as string) || (item.external_id as string) || "";
        const firstName = input.firstName || (item.name as string)?.split(" ")[0] || "";
        const lastName = input.lastName || (item.name as string)?.split(" ").slice(1).join(" ") || "";
        const company = input.company || (item.company as string) || "";
        const email = (item.email as string) || "";

        // Build Apollo /people/match request with reveal_phone_number
        const body: Record<string, unknown> = { reveal_phone_number: true };
        if (apolloId) body.id = apolloId;
        if (firstName) body.first_name = firstName;
        if (lastName) body.last_name = lastName;
        if (company) body.organization_name = company;
        if (email) body.email = email;

        console.log(`[batch-phone] Apollo match for ${input.itemId}, apolloId: ${apolloId}`);

        const res = await fetch("https://api.apollo.io/api/v1/people/match", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": APOLLO_API_KEY! },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`[batch-phone] Apollo error ${res.status} for ${input.itemId}: ${errText}`);
          result.status = "error";
          result.error = `apollo_${res.status}`;
          await supabase.from("prospect_list_items").update({
            enrichment_status: "error",
            phone_checked_at: new Date().toISOString(),
            apollo_called: true,
            apollo_reason: `batch_phone_error_${res.status}`,
          }).eq("id", input.itemId);
          return result;
        }

        const data = await res.json();
        const person = data?.person;
        const foundPhone = extractPhone(person || {});

        // Also update linkedin_url if resolved
        const linkedinUrl = person?.linkedin_url;

        console.log(`[batch-phone] Result for ${input.itemId}: phone=${foundPhone}, linkedin=${linkedinUrl}`);

        const updateData: Record<string, unknown> = {
          phone_checked_at: new Date().toISOString(),
          apollo_called: true,
        };

        if (linkedinUrl && !(item.linkedin_url as string)) {
          updateData.linkedin_url = linkedinUrl;
        }

        if (foundPhone) {
          updateData.phone = foundPhone;
          updateData.enrichment_source = "apollo";
          updateData.enrichment_status = "done";
          updateData.apollo_reason = "phone_found";
          result.phoneFound = true;
          result.phone = foundPhone;
          result.source = "apollo";

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
