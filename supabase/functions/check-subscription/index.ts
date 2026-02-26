import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Product IDs for channel licenses
const LINKEDIN_PRODUCT = "prod_U3G8s5GjYgD52X";
const WHATSAPP_PRODUCT = "prod_U3G8Ak8tHtCb3U";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(userError.message);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    const licenses: Record<string, { active: boolean; expires_at: string | null }> = {
      linkedin: { active: false, expires_at: null },
      whatsapp: { active: false, expires_at: null },
    };

    if (customers.data.length > 0) {
      const customerId = customers.data[0].id;
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 10,
      });

      for (const sub of subscriptions.data) {
        const productId = sub.items.data[0]?.price?.product;
        const expiresAt = new Date(sub.current_period_end * 1000).toISOString();

        if (productId === LINKEDIN_PRODUCT) {
          licenses.linkedin = { active: true, expires_at: expiresAt };
          await supabaseAdmin.from("channel_licenses").upsert({
            user_id: user.id,
            channel: "linkedin",
            stripe_subscription_id: sub.id,
            status: "active",
            expires_at: expiresAt,
          }, { onConflict: "user_id,channel" });
        }
        if (productId === WHATSAPP_PRODUCT) {
          licenses.whatsapp = { active: true, expires_at: expiresAt };
          await supabaseAdmin.from("channel_licenses").upsert({
            user_id: user.id,
            channel: "whatsapp",
            stripe_subscription_id: sub.id,
            status: "active",
            expires_at: expiresAt,
          }, { onConflict: "user_id,channel" });
        }
      }

      // Deactivate licenses not found in active subs
      if (!licenses.linkedin.active) {
        await supabaseAdmin.from("channel_licenses").upsert({
          user_id: user.id, channel: "linkedin", status: "inactive", stripe_subscription_id: null, expires_at: null,
        }, { onConflict: "user_id,channel" });
      }
      if (!licenses.whatsapp.active) {
        await supabaseAdmin.from("channel_licenses").upsert({
          user_id: user.id, channel: "whatsapp", status: "inactive", stripe_subscription_id: null, expires_at: null,
        }, { onConflict: "user_id,channel" });
      }
    }

    // Fetch separated credits
    const { data: credits } = await supabaseAdmin
      .from("user_credits_separated")
      .select("leads_balance, email_balance, phone_balance")
      .eq("user_id", user.id)
      .maybeSingle();

    return new Response(JSON.stringify({
      licenses,
      credits: {
        leads: credits?.leads_balance ?? 50,
        email: credits?.email_balance ?? 0,
        phone: credits?.phone_balance ?? 0,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
