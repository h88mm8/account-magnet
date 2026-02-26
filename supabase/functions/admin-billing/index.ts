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

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Usuário não autenticado");
    const userId = userData.user.id;

    // Admin check
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) throw new Error("Acesso negado: usuário não é admin");

    const { action, ...payload } = await req.json();

    // --- Actions ---
    if (action === "get_welcome_config") {
      const { data } = await supabaseAdmin.from("billing_welcome_config").select("*").limit(1).single();
      return json({ data });
    }

    if (action === "save_welcome_config") {
      const { leads_credits, email_credits, phone_credits } = payload;
      const { data: existing } = await supabaseAdmin.from("billing_welcome_config").select("id").limit(1).single();
      if (existing) {
        await supabaseAdmin.from("billing_welcome_config").update({
          leads_credits, email_credits, phone_credits, updated_at: new Date().toISOString(), updated_by: userId
        }).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("billing_welcome_config").insert({
          leads_credits, email_credits, phone_credits, updated_by: userId
        });
      }
      return json({ success: true });
    }

    if (action === "get_products") {
      const { data } = await supabaseAdmin.from("billing_products").select("*").order("product_type");
      return json({ data });
    }

    if (action === "update_price") {
      const { product_id, new_price } = payload;
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

      // Get current product
      const { data: product } = await supabaseAdmin.from("billing_products").select("*").eq("id", product_id).single();
      if (!product) throw new Error("Produto não encontrado");

      // Create new price on Stripe
      const newStripePrice = await stripe.prices.create({
        product: product.stripe_product_id,
        unit_amount: new_price,
        currency: product.currency || "brl",
        ...(product.billing_type === "subscription" ? { recurring: { interval: "month" } } : {}),
      });

      // Deactivate old price
      if (product.stripe_price_id) {
        await stripe.prices.update(product.stripe_price_id, { active: false });
      }

      // Save history
      await supabaseAdmin.from("billing_price_history").insert({
        billing_product_id: product_id,
        old_price: product.unit_price,
        new_price,
        old_stripe_price_id: product.stripe_price_id,
        new_stripe_price_id: newStripePrice.id,
        changed_by: userId,
      });

      // Update product
      await supabaseAdmin.from("billing_products").update({
        unit_price: new_price,
        stripe_price_id: newStripePrice.id,
        updated_at: new Date().toISOString(),
      }).eq("id", product_id);

      return json({ success: true, new_price_id: newStripePrice.id });
    }

    if (action === "toggle_product") {
      const { product_id, active } = payload;
      await supabaseAdmin.from("billing_products").update({
        active, updated_at: new Date().toISOString()
      }).eq("id", product_id);
      return json({ success: true });
    }

    if (action === "sync_stripe") {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
      const { data: products } = await supabaseAdmin.from("billing_products").select("*");

      const results = [];
      for (const p of products || []) {
        if (!p.stripe_price_id) {
          results.push({ id: p.id, status: "no_price_id" });
          continue;
        }
        try {
          const stripePrice = await stripe.prices.retrieve(p.stripe_price_id);
          const isActive = stripePrice.active;
          if (p.active !== isActive) {
            await supabaseAdmin.from("billing_products").update({ active: isActive, updated_at: new Date().toISOString() }).eq("id", p.id);
          }
          results.push({ id: p.id, status: "synced", active: isActive });
        } catch {
          results.push({ id: p.id, status: "price_not_found" });
          await supabaseAdmin.from("billing_products").update({ active: false, updated_at: new Date().toISOString() }).eq("id", p.id);
        }
      }
      return json({ results });
    }

    if (action === "create_product") {
      const { product_type, billing_type, unit_price, stripe_product_id } = payload;
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

      const stripePrice = await stripe.prices.create({
        product: stripe_product_id,
        unit_amount: unit_price,
        currency: "brl",
        ...(billing_type === "subscription" ? { recurring: { interval: "month" } } : {}),
      });

      const { data } = await supabaseAdmin.from("billing_products").insert({
        product_type,
        billing_type,
        stripe_product_id,
        stripe_price_id: stripePrice.id,
        unit_price,
        currency: "brl",
        active: true,
      }).select().single();

      return json({ data });
    }

    throw new Error("Ação desconhecida: " + action);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: msg.includes("negado") || msg.includes("admin") ? 403 : 500,
    });
  }
});

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}
