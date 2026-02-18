import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("[EMAIL_NOTIFY] RESEND_API_KEY not configured");
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { to_email: string; lead_name: string; original_url: string; clicked_at: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400, headers: corsHeaders });
  }

  const { to_email, lead_name, original_url, clicked_at } = body;
  const date = new Date(clicked_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb;">
      <h2 style="color: #111827; margin-bottom: 8px;">🔗 Link clicado!</h2>
      <p style="color: #374151;"><strong>${lead_name}</strong> clicou em um link que você enviou.</p>
      <table style="width:100%; margin-top: 16px; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #6b7280;">Contato</td><td style="color:#111827;">${lead_name}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Link</td><td style="word-break:break-all; color:#111827;">${original_url}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Horário</td><td style="color:#111827;">${date}</td></tr>
      </table>
      <hr style="margin: 24px 0; border-color: #f3f4f6;" />
      <p style="font-size: 12px; color: #9ca3af;">Enviado automaticamente pelo seu sistema de prospecção.</p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Notificações <notificacoes@elev.app>",
        to: [to_email],
        subject: `🔗 ${lead_name} clicou no seu link`,
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[EMAIL_NOTIFY] Resend error:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[EMAIL_NOTIFY] Fetch failed:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
