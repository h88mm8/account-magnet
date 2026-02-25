import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APIFY_ACTOR_ID = "2SyF0bVxmgGr8IVCZ";
const APIFY_POLL_INTERVAL_MS = 3000;
const APIFY_TIMEOUT_MS = 45000;

/**
 * Enrich basic lead profile data (full name, title, company, location, photo)
 * using Apify LinkedIn Profile Scraper.
 * This does NOT cost credits.
 * Input: { items: [{ itemId, linkedinUrl }] }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) {
      return new Response(JSON.stringify({ error: "APIFY_API_KEY not set" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { items } = await req.json() as {
      items: Array<{ itemId: string; linkedinUrl?: string; apolloId?: string }>;
    };

    if (!items?.length) {
      return new Response(JSON.stringify({ enriched: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let enriched = 0;

    for (const item of items) {
      try {
        // Get the linkedin_url from payload or from DB
        let linkedinUrl = item.linkedinUrl || "";

        if (!linkedinUrl) {
          const { data: dbItem } = await supabase
            .from("prospect_list_items")
            .select("linkedin_url, raw_data")
            .eq("id", item.itemId)
            .single();

          linkedinUrl = (dbItem?.linkedin_url as string) || 
            (dbItem?.raw_data as Record<string, unknown>)?.full_linkedin_url as string || "";
        }

        if (!linkedinUrl) {
          console.warn(`[enrich-profile] No LinkedIn URL for ${item.itemId}, skipping`);
          continue;
        }

        // Start Apify LinkedIn Profile Scraper
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
          console.warn(`[enrich-profile] Apify start error for ${item.itemId}: ${apifyRes.status}`);
          continue;
        }

        const apifyData = await apifyRes.json();
        const runId = apifyData?.data?.id;
        const datasetId = apifyData?.data?.defaultDatasetId;

        if (!runId || !datasetId) {
          console.warn(`[enrich-profile] No runId/datasetId for ${item.itemId}`);
          continue;
        }

        // Poll for completion
        const startTime = Date.now();
        let profile: Record<string, unknown> | null = null;

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
              profile = dsItems[0];
            }
            break;
          } else if (["FAILED", "ABORTED", "TIMED-OUT"].includes(runStatus)) {
            console.warn(`[enrich-profile] Apify run ${runStatus} for ${item.itemId}`);
            break;
          }
        }

        if (!profile) {
          console.warn(`[enrich-profile] No profile returned for ${item.itemId}`);
          continue;
        }

        // Extract profile data
        const firstName = (profile.firstName || profile.first_name || "") as string;
        const lastName = (profile.lastName || profile.last_name || "") as string;
        const fullName = [firstName, lastName].filter(Boolean).join(" ") || 
          (profile.fullName || profile.name || "") as string;
        const title = (profile.title || profile.headline || profile.occupation || "") as string;
        const company = (profile.company || profile.companyName || profile.organization_name || "") as string;
        const photoUrl = (profile.profilePicture || profile.photo_url || profile.avatar || "") as string;
        const location = (profile.location || profile.addressLocality || "") as string;

        // Merge with existing raw_data
        const { data: existing } = await supabase
          .from("prospect_list_items")
          .select("raw_data")
          .eq("id", item.itemId)
          .single();

        const existingRaw = (existing?.raw_data as Record<string, unknown>) || {};

        const updateData: Record<string, unknown> = {};
        if (fullName) updateData.name = fullName;
        if (linkedinUrl) updateData.linkedin_url = linkedinUrl;
        if (title) updateData.title = title;
        if (company) updateData.company = company;
        if (location) updateData.location = location;

        updateData.raw_data = {
          ...existingRaw,
          photo_url: photoUrl,
          apify_profile_enriched: true,
          full_linkedin_url: linkedinUrl,
        };

        const { error: updateError } = await supabase
          .from("prospect_list_items")
          .update(updateData)
          .eq("id", item.itemId);

        if (updateError) {
          console.error(`[enrich-profile] DB error for ${item.itemId}:`, updateError.message);
        } else {
          enriched++;
          console.log(`[enrich-profile] OK ${item.itemId}: ${fullName} | ${linkedinUrl}`);
        }
      } catch (err) {
        console.error(`[enrich-profile] Error for ${item.itemId}:`, (err as Error).message);
      }
    }

    return new Response(JSON.stringify({ enriched, total: items.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[enrich-profile] Unhandled error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
