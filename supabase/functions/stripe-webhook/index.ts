import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Maps price_id -> { type: "leads"|"email"|"phone", amount: number }
const CREDIT_PACKAGES: Record<string, { type: string; amount: number }> = {
  "price_1T59QORwW8qJ8nV68dJWv29N": { type: "leads", amount: 500 },
  "price_1T59QnRwW8qJ8nV6EMgeZh5d": { type: "leads", amount: 1000 },
  "price_1T59aURwW8qJ8nV6F8bqrTCj": { type: "leads", amount: 5000 },
  "price_1T59aqRwW8qJ8nV6hxCkXHoK": { type: "leads", amount: 10000 },
  "price_1T59b2RwW8qJ8nV6DXbbJSAY": { type: "email", amount: 1000 },
  "price_1T59bHRwW8qJ8nV6GRbFCmT6": { type: "email", amount: 10000 },
  "price_1T59bYRwW8qJ8nV6iqRC9m2c": { type: "email", amount: 50000 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    
    // If webhook secret is set, verify signature
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    let event: Stripe.Event;
    
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const priceId = session.metadata?.price_id;

      if (userId && priceId && session.mode === "payment") {
        const pkg = CREDIT_PACKAGES[priceId];
        if (pkg) {
          const fnName = pkg.type === "leads" ? "add_leads_credits" 
            : pkg.type === "email" ? "add_email_credits" 
            : "add_phone_credits";
          
          await supabase.rpc(fnName, {
            p_user_id: userId,
            p_amount: pkg.amount,
            p_description: `Compra Stripe: ${pkg.amount} créditos de ${pkg.type}`,
          });
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
