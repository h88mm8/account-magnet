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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload = await req.json();
    console.log("Apollo webhook received:", JSON.stringify(payload).slice(0, 500));

    // Apollo sends the enriched person data in the webhook
    // The webhook_url includes query params with our metadata
    const url = new URL(req.url);
    const itemId = url.searchParams.get("itemId");
    const searchType = url.searchParams.get("searchType");

    if (!itemId || searchType !== "phone") {
      console.error("Missing or invalid query params:", { itemId, searchType });
      return new Response(JSON.stringify({ error: "Missing itemId or invalid searchType" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract phone from Apollo webhook payload
    // Apollo sends the person object directly in the webhook
    const person = payload?.person || payload;
    let phone: string | null = null;

    if (person) {
      const mobile = person.phone_numbers?.find(
        (p: { type?: string; sanitized_number?: string }) =>
          p.type === "mobile" && p.sanitized_number
      );
      phone =
        mobile?.sanitized_number ||
        person.phone_numbers?.find(
          (p: { sanitized_number?: string }) => p.sanitized_number
        )?.sanitized_number ||
        person.mobile_phone ||
        null;
    }

    console.log("Apollo webhook extracted phone:", phone, "for item:", itemId);

    const updateData: Record<string, unknown> = {
      enrichment_status: "done",
      apollo_called: true,
      apollo_reason: "webhook_phone",
    };

    if (phone) {
      updateData.phone = phone;
      updateData.enrichment_source = "apollo";
    }

    const { error: updateError } = await supabase
      .from("prospect_list_items")
      .update(updateData)
      .eq("id", itemId);

    if (updateError) {
      console.error("Failed to update item:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update item" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Apollo webhook: item updated successfully", { itemId, phone, found: !!phone });

    return new Response(
      JSON.stringify({ success: true, found: !!phone }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("webhooks-apollo error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
