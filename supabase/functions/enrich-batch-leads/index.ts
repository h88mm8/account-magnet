import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CREDIT_COST_EMAIL = 1;
const CREDIT_COST_WHATSAPP = 8;
const MAX_LEADS = 100;
const CONCURRENCY = 5;
const APIFY_TIMEOUT_MS = 45000;
const APIFY_POLL_INTERVAL_MS = 3000;

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
  phoneFound: boolean;
  email?: string | null;
  phone?: string | null;
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
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth
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

    // Fetch all items and verify ownership
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

    // Filter eligible leads (not already checked for email)
    const eligible: Array<{ input: LeadInput; item: Record<string, unknown> }> = [];
    for (const lead of leads) {
      const item = itemMap.get(lead.itemId);
      if (!item) continue;
      if (item.email_checked_at && item.email) continue; // already has email
      eligible.push({ input: lead, item });
    }

    if (eligible.length === 0) {
      return new Response(
        JSON.stringify({
          totalProcessed: 0,
          emailsFound: 0,
          phonesFound: 0,
          notFound: 0,
          creditsUsed: 0,
          message: "No eligible leads to process",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Estimate max credits: 1 per email + 8 per phone (worst case all found)
    const maxCredits = eligible.length * (CREDIT_COST_EMAIL + CREDIT_COST_WHATSAPP);
    const { data: balanceData } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();
    const currentBalance = balanceData?.balance ?? 0;

    // Check minimum: at least enough for email-only enrichment
    const minCredits = eligible.length * CREDIT_COST_EMAIL;
    if (currentBalance < minCredits) {
      return new Response(
        JSON.stringify({
          error: "Créditos insuficientes",
          required: minCredits,
          available: currentBalance,
          eligibleCount: eligible.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark all as processing
    await supabase
      .from("prospect_list_items")
      .update({ enrichment_status: "processing" })
      .in("id", eligible.map((e) => e.input.itemId));

    // Process with controlled concurrency
    const results: LeadResult[] = [];
    let totalCreditsUsed = 0;

    async function processLead(entry: { input: LeadInput; item: Record<string, unknown> }): Promise<LeadResult> {
      const { input, item } = entry;
      const result: LeadResult = {
        itemId: input.itemId,
        emailFound: false,
        phoneFound: false,
        status: "done",
      };

      try {
        const firstName = input.firstName || (item.name as string)?.split(" ")[0] || "";
        const lastName = input.lastName || (item.name as string)?.split(" ").slice(1).join(" ") || "";
        const company = input.company || (item.company as string) || "";
        const domain = input.domain || "";
        const linkedinUrl = input.linkedinUrl || (item.linkedin_url as string) || "";

        if (!firstName && !lastName) {
          result.status = "skipped";
          result.error = "no_identifiers";
          await supabase.from("prospect_list_items").update({
            enrichment_status: "done",
            apollo_reason: "no_strong_identifiers",
          }).eq("id", input.itemId);
          return result;
        }

        // ====== APOLLO ENRICHMENT ======
        const apolloBody: Record<string, unknown> = {};
        if (firstName) apolloBody.first_name = firstName;
        if (lastName) apolloBody.last_name = lastName;
        if (company) apolloBody.organization_name = company;
        if (domain) apolloBody.domain = domain;
        if (linkedinUrl) apolloBody.linkedin_url = linkedinUrl;
        if (item.email) apolloBody.email = item.email as string;

        console.log(`[batch] Apollo payload for ${input.itemId}:`, JSON.stringify(apolloBody));

        const apolloRes = await fetch("https://api.apollo.io/api/v1/people/match", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": APOLLO_API_KEY! },
          body: JSON.stringify(apolloBody),
        });

        const apolloText = await apolloRes.text();
        let apolloEmail: string | null = null;
        let apolloPhone: string | null = null;

        if (apolloRes.ok) {
          const apolloData = JSON.parse(apolloText);
          const person = apolloData.person;
          if (person) {
            apolloEmail = person.email || person.personal_emails?.[0] || null;
            // Phone may come even without reveal_phone_number
            const phones = person.phone_numbers;
            if (Array.isArray(phones) && phones.length > 0) {
              const mobile = phones.find((p: Record<string, unknown>) => p.type === "mobile");
              apolloPhone = (mobile?.sanitized_number || mobile?.raw_number || phones[0]?.sanitized_number || phones[0]?.raw_number) as string || null;
            }
            if (!apolloPhone && person.sanitized_phone) apolloPhone = person.sanitized_phone as string;
          }
        } else {
          console.error(`[batch] Apollo error for ${input.itemId}: ${apolloRes.status} body: ${apolloText.substring(0, 300)}`);
        }

        // ====== APIFY FALLBACK (if Apollo found nothing for email) ======
        if (!apolloEmail && APIFY_API_KEY && linkedinUrl) {
          console.log(`[batch] Apollo no email for ${input.itemId}, trying Apify...`);
          try {
            const actorId = "2SyF0bVxmgGr8IVCZ";
            const actorUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_KEY}`;
            const apifyStartRes = await fetch(actorUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                startUrls: [{ url: linkedinUrl }],
                maxItems: 1,
              }),
            });
            const apifyStartData = await apifyStartRes.json();
            const runId = apifyStartData?.data?.id;
            const datasetId = apifyStartData?.data?.defaultDatasetId;

            if (runId) {
              // Poll for completion with timeout
              const startTime = Date.now();
              let finished = false;
              let apifyEmail: string | null = null;
              let apifyPhone: string | null = null;

              while (Date.now() - startTime < APIFY_TIMEOUT_MS) {
                await new Promise((r) => setTimeout(r, APIFY_POLL_INTERVAL_MS));
                const statusRes = await fetch(
                  `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_KEY}`
                );
                const statusData = await statusRes.json();
                const runStatus = statusData?.data?.status;

                if (runStatus === "SUCCEEDED") {
                  finished = true;
                  // Fetch dataset
                  const dsRes = await fetch(
                    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_KEY}`
                  );
                  const dsItems = await dsRes.json();
                  if (Array.isArray(dsItems) && dsItems.length > 0) {
                    const profile = dsItems[0];
                    apifyEmail = profile.email || profile.emails?.[0] || null;
                    apifyPhone = apifyPhone || profile.phone || profile.phones?.[0] || null;
                  }
                  break;
                } else if (["FAILED", "ABORTED", "TIMED-OUT"].includes(runStatus)) {
                  finished = true;
                  break;
                }
              }

              if (apifyEmail) {
                apolloEmail = apifyEmail;
                result.source = "apify";
              }
              if (apifyPhone && !apolloPhone) apolloPhone = apifyPhone;

              // Update apify tracking fields
              await supabase.from("prospect_list_items").update({
                apify_called: true,
                apify_finished: finished,
                apify_run_id: runId,
                apify_email_found: !!apifyEmail,
              }).eq("id", input.itemId);
            }
          } catch (apifyErr) {
            console.error(`[batch] Apify error for ${input.itemId}:`, apifyErr);
          }
        }

        // ====== SAVE RESULTS ======
        const updateData: Record<string, unknown> = {
          enrichment_status: "done",
          apollo_called: true,
          email_checked_at: new Date().toISOString(),
        };

        let creditsForThis = 0;

        if (apolloEmail) {
          updateData.email = apolloEmail;
          updateData.enrichment_source = result.source || "apollo";
          result.emailFound = true;
          result.email = apolloEmail;
          creditsForThis += CREDIT_COST_EMAIL;
        } else {
          updateData.apollo_reason = "not_found";
        }

        if (apolloPhone) {
          updateData.phone = apolloPhone;
          updateData.phone_checked_at = new Date().toISOString();
          if (!updateData.enrichment_source) updateData.enrichment_source = result.source || "apollo";
          result.phoneFound = true;
          result.phone = apolloPhone;
          creditsForThis += CREDIT_COST_WHATSAPP;
        }

        // Deduct credits only for found data
        if (creditsForThis > 0) {
          const desc = [];
          if (result.emailFound) desc.push("email");
          if (result.phoneFound) desc.push("phone");
          const { data: remaining } = await supabase.rpc("deduct_credits", {
            p_user_id: user!.id,
            p_amount: creditsForThis,
            p_type: "batch_enrich",
            p_description: `Enriquecimento batch (${desc.join("+")}) - ${item.name}`,
            p_reference_id: input.itemId,
          });

          if (remaining === -1) {
            // Insufficient credits — save what we have but mark as credit_error
            updateData.enrichment_status = "done";
            updateData.apollo_reason = "insufficient_credits";
            // Don't save found data since we can't charge
            delete updateData.email;
            delete updateData.phone;
            delete updateData.phone_checked_at;
            result.emailFound = false;
            result.phoneFound = false;
            result.status = "credit_error";
          } else {
            totalCreditsUsed += creditsForThis;
          }
        }

        await supabase.from("prospect_list_items").update(updateData).eq("id", input.itemId);

      } catch (err) {
        console.error(`[batch] Error processing ${input.itemId}:`, err);
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

    // Controlled concurrency: process CONCURRENCY leads at a time
    for (let i = 0; i < eligible.length; i += CONCURRENCY) {
      const batch = eligible.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(processLead));
      results.push(...batchResults);
    }

    const emailsFound = results.filter((r) => r.emailFound).length;
    const phonesFound = results.filter((r) => r.phoneFound).length;
    const notFound = results.filter((r) => !r.emailFound && !r.phoneFound && r.status === "done").length;

    const summary = {
      totalProcessed: results.length,
      emailsFound,
      phonesFound,
      notFound,
      creditsUsed: totalCreditsUsed,
      results,
    };

    console.log(`[batch] Complete:`, JSON.stringify({ ...summary, results: undefined }));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[batch] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
