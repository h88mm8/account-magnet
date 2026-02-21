import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Enrich basic lead profile data (full name + LinkedIn URL) from Apollo.
 * This does NOT cost credits — it only reveals public profile data.
 * Input: { items: [{ itemId, apolloId }] }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    if (!APOLLO_API_KEY) {
      return new Response(JSON.stringify({ error: "APOLLO_API_KEY not set" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { items } = await req.json() as {
      items: Array<{ itemId: string; apolloId: string }>;
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
        const res = await fetch("https://api.apollo.io/api/v1/people/match", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "x-api-key": APOLLO_API_KEY,
          },
          body: JSON.stringify({ id: item.apolloId }),
        });

        if (!res.ok) {
          console.warn(`[enrich-profile] Apollo error for ${item.itemId}: ${res.status}`);
          continue;
        }

        const data = await res.json();
        const person = data.person;
        if (!person) {
          console.warn(`[enrich-profile] No person returned for ${item.itemId}`);
          continue;
        }

        const fullName = [person.first_name, person.last_name].filter(Boolean).join(" ");
        const linkedinUrl = person.linkedin_url || "";
        const photoUrl = person.photo_url || "";
        const title = person.title || "";
        const org = person.organization;
        const company = org?.name || person.organization_name || "";
        const location = [person.city, person.state, person.country].filter(Boolean).join(", ");

        const updateData: Record<string, unknown> = {};
        if (fullName) updateData.name = fullName;
        if (linkedinUrl) updateData.linkedin_url = linkedinUrl;
        if (title) updateData.title = title;
        if (company) updateData.company = company;
        if (location) updateData.location = location;
        if (item.apolloId) updateData.external_id = item.apolloId;

        // Merge with existing raw_data
        const { data: existing } = await supabase
          .from("prospect_list_items")
          .select("raw_data")
          .eq("id", item.itemId)
          .single();

        const existingRaw = (existing?.raw_data as Record<string, unknown>) || {};
        updateData.raw_data = {
          ...existingRaw,
          photo_url: photoUrl,
          apollo_enriched: true,
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
