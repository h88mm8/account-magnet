import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // Auth
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { phone_credits = 0, email_credits = 0 } = await req.json();
    if (phone_credits <= 0 && email_credits <= 0) {
      throw new Error("Selecione pelo menos um tipo de crédito");
    }

    // Fetch unit prices
    const { data: prices, error: pricesError } = await supabaseAdmin
      .from("credit_unit_prices")
      .select("credit_type, unit_price_cents, currency");
    if (pricesError) throw pricesError;

    const priceMap: Record<string, number> = {};
    for (const p of prices || []) {
      priceMap[p.credit_type] = p.unit_price_cents;
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (phone_credits > 0) {
      lineItems.push({
        price_data: {
          currency: "brl",
          product_data: { name: `${phone_credits} Créditos de Telefone` },
          unit_amount: priceMap["phone"] || 50,
        },
        quantity: phone_credits,
      });
    }

    if (email_credits > 0) {
      lineItems.push({
        price_data: {
          currency: "brl",
          product_data: { name: `${email_credits} Créditos de Email` },
          unit_amount: priceMap["email"] || 10,
        },
        quantity: email_credits,
      });
    }

    const origin = req.headers.get("origin") || "https://account-magnet.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/billing/success`,
      cancel_url: `${origin}/billing?checkout=canceled`,
      metadata: {
        user_id: user.id,
        phone_credits: String(phone_credits),
        email_credits: String(email_credits),
        flow: "dynamic",
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
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
