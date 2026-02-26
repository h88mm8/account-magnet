import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ──────────────────────────────────────────────
// Variable replacement
// ──────────────────────────────────────────────
function replaceVariables(template: string, contact: Record<string, any>): string {
  const firstName = (contact.name || "").split(" ")[0] || "";
  const lastName = (contact.name || "").split(" ").slice(1).join(" ") || "";
  return template
    .replace(/\{\{FIRST_NAME\}\}/gi, firstName)
    .replace(/\{\{LAST_NAME\}\}/gi, lastName)
    .replace(/\{\{NAME\}\}/gi, contact.name || "")
    .replace(/\{\{EMAIL\}\}/gi, contact.email || "")
    .replace(/\{\{COMPANY\}\}/gi, contact.company || "")
    .replace(/\{\{POSITION\}\}/gi, contact.title || "");
}

// ──────────────────────────────────────────────
// Schedule checking
// ──────────────────────────────────────────────
function isWithinSchedule(workflow: any): boolean {
  const days = workflow.schedule_days || ["mon", "tue", "wed", "thu", "fri"];
  const tz = workflow.schedule_timezone || "America/Sao_Paulo";
  const startTime = workflow.schedule_start_time || "08:00";
  const endTime = workflow.schedule_end_time || "18:00";

  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase().slice(0, 3) || "";
  const hour = parts.find((p) => p.type === "hour")?.value || "00";
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  const currentTime = `${hour}:${minute}`;

  if (!days.includes(weekday)) return false;
  if (currentTime < startTime || currentTime > endTime) return false;
  return true;
}

// Random delay between min and max seconds
function randomDelay(min = 10, max = 50): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ──────────────────────────────────────────────
// Logging helper
// ──────────────────────────────────────────────
async function logExecution(
  supabase: any,
  executionId: string,
  nodeId: string | null,
  action: string,
  details: Record<string, any> = {}
) {
  await supabase.from("workflow_execution_logs").insert({
    execution_id: executionId,
    node_id: nodeId,
    action,
    details,
  });
}

// ──────────────────────────────────────────────
// Record event
// ──────────────────────────────────────────────
async function recordEvent(
  supabase: any,
  userId: string,
  contactId: string,
  workflowId: string,
  executionId: string,
  channel: string,
  eventType: string,
  metadata: Record<string, any> = {}
) {
  await supabase.from("events").insert({
    user_id: userId,
    contact_id: contactId,
    workflow_id: workflowId,
    workflow_execution_id: executionId,
    channel,
    event_type: eventType,
    metadata,
  });
}

// ──────────────────────────────────────────────
// Node processors
// ──────────────────────────────────────────────

async function processStartNode(
  supabase: any,
  execution: any,
  node: any
): Promise<{ nextNodeId: string | null; delay: number }> {
  await logExecution(supabase, execution.id, node.id, "start", { message: "Workflow started" });
  return { nextNodeId: node.next_node_id, delay: 0 };
}

async function processWaitNode(
  supabase: any,
  execution: any,
  node: any
): Promise<{ nextNodeId: string | null; delay: number }> {
  const config = node.config || {};
  const hours = config.hours || 0;
  const days = config.days || 0;
  const totalMs = (hours * 3600 + days * 86400) * 1000;

  await logExecution(supabase, execution.id, node.id, "wait", { hours, days });
  return { nextNodeId: node.next_node_id, delay: totalMs };
}

async function processEndNode(
  supabase: any,
  execution: any,
  node: any
): Promise<{ nextNodeId: string | null; delay: number }> {
  await logExecution(supabase, execution.id, node.id, "end", { message: "Workflow completed" });
  await supabase
    .from("workflow_executions")
    .update({ status: "completed", current_node_id: node.id })
    .eq("id", execution.id);
  return { nextNodeId: null, delay: 0 };
}

async function processSendEmailNode(
  supabase: any,
  execution: any,
  node: any,
  contact: any,
  workflow: any
): Promise<{ nextNodeId: string | null; delay: number }> {
  const config = node.config || {};
  const subject = replaceVariables(config.subject || "", contact);
  let body = replaceVariables(config.body || "", contact);

  if (!contact.email) {
    await logExecution(supabase, execution.id, node.id, "send_email_skip", { reason: "No email" });
    return { nextNodeId: node.next_node_id, delay: 0 };
  }

  // Check blocklist
  const { data: blocked } = await supabase
    .from("email_blocklist")
    .select("id, bounce_count")
    .eq("user_id", execution.user_id)
    .eq("email", contact.email.toLowerCase().trim())
    .maybeSingle();

  if (blocked && blocked.bounce_count >= 3) {
    await logExecution(supabase, execution.id, node.id, "send_email_blocked", { email: contact.email });
    return { nextNodeId: node.next_node_id, delay: 0 };
  }

  // Get Resend config for this user
  const { data: resendCfg } = await supabase
    .from("resend_settings")
    .select("resend_api_key_encrypted, sender_email, sender_name")
    .eq("user_id", execution.user_id)
    .single();

  if (!resendCfg?.resend_api_key_encrypted || !resendCfg?.sender_email) {
    await logExecution(supabase, execution.id, node.id, "send_email_fail", { reason: "Resend not configured" });
    return { nextNodeId: node.next_node_id, delay: 0 };
  }

  // Convert plain text to HTML
  if (!body.includes("<p>") && !body.includes("<br") && !body.includes("<div")) {
    body = body.replace(/\n/g, "<br>");
  }

  // Append signature if available
  const { data: emailSettings } = await supabase
    .from("email_settings")
    .select("email_signature")
    .eq("user_id", execution.user_id)
    .single();

  if (emailSettings?.email_signature) {
    let sig = emailSettings.email_signature;
    if (!sig.includes("<p>") && !sig.includes("<br")) sig = sig.replace(/\n/g, "<br>");
    body += `<br/><br/><div style="border-top:1px solid #e2e8f0;padding-top:12px;color:#64748b;font-size:13px;">${sig}</div>`;
  }

  try {
    const fromAddress = `${resendCfg.sender_name} <${resendCfg.sender_email}>`;
    console.log(`[WF] Sending email to ${contact.email} via Resend from ${fromAddress}`);

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendCfg.resend_api_key_encrypted}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [contact.email],
        subject,
        html: body,
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      throw new Error(`Resend send failed [${resp.status}]: ${errBody.slice(0, 200)}`);
    }

    const resendData = await resp.json();
    const resendId = resendData?.id || null;

    // Record in messages_sent
    await supabase.from("messages_sent").insert({
      user_id: execution.user_id,
      lead_id: execution.contact_id,
      content: body,
      message_type: "email",
      status: "sent",
      sent_at: new Date().toISOString(),
      unipile_message_id: resendId, // reusing field for Resend ID
    });

    await recordEvent(supabase, execution.user_id, execution.contact_id, execution.workflow_id, execution.id, "email", "sent", { subject, resend_id: resendId });
    await logExecution(supabase, execution.id, node.id, "send_email_ok", { to: contact.email });

    return { nextNodeId: node.next_node_id, delay: randomDelay() * 1000 };
  } catch (e) {
    await logExecution(supabase, execution.id, node.id, "send_email_fail", { error: e.message });
    await recordEvent(supabase, execution.user_id, execution.contact_id, execution.workflow_id, execution.id, "email", "failed", { error: e.message });
    return { nextNodeId: node.next_node_id, delay: 0 };
  }
}

async function processSendLinkedInNode(
  supabase: any,
  execution: any,
  node: any,
  contact: any,
  workflow: any
): Promise<{ nextNodeId: string | null; delay: number }> {
  const config = node.config || {};
  const linkedinType = config.linkedin_type || "message"; // "message" | "invite"
  const message = replaceVariables(config.message || "", contact);

  if (!contact.linkedin_url && !contact.provider_id) {
    await logExecution(supabase, execution.id, node.id, "send_linkedin_skip", { reason: "No LinkedIn URL" });
    return { nextNodeId: node.next_node_id, delay: 0 };
  }

  const UNIPILE_BASE_URL = Deno.env.get("UNIPILE_BASE_URL");
  const UNIPILE_API_KEY = Deno.env.get("UNIPILE_API_KEY");

  const { data: integration } = await supabase
    .from("user_integrations")
    .select("unipile_account_id")
    .eq("user_id", execution.user_id)
    .eq("provider", "linkedin")
    .eq("status", "connected")
    .single();

  if (!integration?.unipile_account_id || !UNIPILE_BASE_URL || !UNIPILE_API_KEY) {
    await logExecution(supabase, execution.id, node.id, "send_linkedin_fail", { reason: "LinkedIn not connected" });
    return { nextNodeId: node.next_node_id, delay: 0 };
  }

  // Resolve provider_id if needed
  let providerId = contact.provider_id;
  if (!providerId && contact.linkedin_url) {
    const linkedinId = contact.linkedin_url.includes("/") 
      ? (contact.linkedin_url.match(/\/in\/([^/?#]+)/)?.[1] || contact.linkedin_url)
      : contact.linkedin_url;

    try {
      const lookupResp = await fetch(
        `${UNIPILE_BASE_URL}/api/v1/users/${encodeURIComponent(linkedinId)}?account_id=${integration.unipile_account_id}`,
        { headers: { "X-API-KEY": UNIPILE_API_KEY, accept: "application/json" } }
      );
      if (lookupResp.ok) {
        const data = await lookupResp.json();
        providerId = data.provider_id || data.id || null;
        if (providerId) {
          await supabase.from("prospect_list_items").update({ provider_id: providerId }).eq("id", execution.contact_id);
        }
      }
    } catch (e) {
      console.error(`[WF] LinkedIn resolve error: ${e.message}`);
    }
  }

  if (!providerId) {
    await logExecution(supabase, execution.id, node.id, "send_linkedin_fail", { reason: "Could not resolve provider_id" });
    return { nextNodeId: node.next_node_id, delay: 0 };
  }

  try {
    let resp: Response;

    if (linkedinType === "invite") {
      const formData = new FormData();
      formData.append("account_id", integration.unipile_account_id);
      formData.append("provider_id", providerId);
      if (message) formData.append("message", message);

      resp = await fetch(`${UNIPILE_BASE_URL}/api/v1/users/invite`, {
        method: "POST",
        headers: { "X-API-KEY": UNIPILE_API_KEY },
        body: formData,
      });
    } else {
      const formData = new FormData();
      formData.append("account_id", integration.unipile_account_id);
      formData.append("attendees_ids", JSON.stringify([providerId]));
      formData.append("text", message);

      resp = await fetch(`${UNIPILE_BASE_URL}/api/v1/chats`, {
        method: "POST",
        headers: { "X-API-KEY": UNIPILE_API_KEY },
        body: formData,
      });
    }

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      throw new Error(`LinkedIn ${linkedinType} failed [${resp.status}]: ${errBody.slice(0, 200)}`);
    }

    const eventType = linkedinType === "invite" ? "sent" : "sent";
    await recordEvent(supabase, execution.user_id, execution.contact_id, execution.workflow_id, execution.id, "linkedin", eventType, { linkedin_type: linkedinType });
    await logExecution(supabase, execution.id, node.id, `send_linkedin_ok`, { linkedin_type: linkedinType });

    return { nextNodeId: node.next_node_id, delay: randomDelay() * 1000 };
  } catch (e) {
    await logExecution(supabase, execution.id, node.id, "send_linkedin_fail", { error: e.message });
    return { nextNodeId: node.next_node_id, delay: 0 };
  }
}

async function processSendWhatsAppNode(
  supabase: any,
  execution: any,
  node: any,
  contact: any,
  workflow: any
): Promise<{ nextNodeId: string | null; delay: number }> {
  const config = node.config || {};
  const message = replaceVariables(config.message || "", contact);

  if (!contact.phone) {
    await logExecution(supabase, execution.id, node.id, "send_whatsapp_skip", { reason: "No phone" });
    return { nextNodeId: node.next_node_id, delay: 0 };
  }

  try {
    // Use existing unipile-messages edge function
    const resp = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/unipile-messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          userId: execution.user_id,
          phone: contact.phone,
          content: message,
          leadId: execution.contact_id,
          workflowInstanceId: execution.id,
        }),
      }
    );

    const result = await resp.json();

    if (!resp.ok || result.error) {
      throw new Error(result.error || `WhatsApp send failed [${resp.status}]`);
    }

    await recordEvent(supabase, execution.user_id, execution.contact_id, execution.workflow_id, execution.id, "whatsapp", "sent", {});
    await logExecution(supabase, execution.id, node.id, "send_whatsapp_ok", { phone: contact.phone });

    return { nextNodeId: node.next_node_id, delay: randomDelay() * 1000 };
  } catch (e) {
    await logExecution(supabase, execution.id, node.id, "send_whatsapp_fail", { error: e.message });
    return { nextNodeId: node.next_node_id, delay: 0 };
  }
}

async function processConditionNode(
  supabase: any,
  execution: any,
  node: any,
  contact: any
): Promise<{ nextNodeId: string | null; delay: number }> {
  const config = node.config || {};
  const channel = config.channel || "email";
  const eventType = config.event_type || "replied";
  const lookbackHours = config.lookback_hours || 48;

  const since = new Date(Date.now() - lookbackHours * 3600000).toISOString();

  let conditionMet = false;

  if (channel === "site") {
    // Web tracking conditions
    let query = supabase
      .from("events")
      .select("id, metadata", { count: "exact" })
      .eq("contact_id", execution.contact_id)
      .eq("channel", "site")
      .eq("event_type", eventType)
      .gte("created_at", since);

    const { data: siteEvents, count } = await query;

    if (eventType === "page_visit" && config.url_contains) {
      // Filter by URL pattern
      const matchingEvents = (siteEvents || []).filter((e: any) => {
        const url = e.metadata?.url || "";
        return url.includes(config.url_contains);
      });
      const minCount = config.min_count || 1;
      conditionMet = matchingEvents.length >= minCount;
    } else if (eventType === "scroll_depth") {
      const minScroll = config.min_scroll || 50;
      const matching = (siteEvents || []).filter((e: any) => {
        return (e.metadata?.scroll_percent || 0) >= minScroll;
      });
      conditionMet = matching.length > 0;
    } else if (eventType === "cta_click" && config.cta_id) {
      const matching = (siteEvents || []).filter((e: any) => {
        return e.metadata?.cta_id === config.cta_id;
      });
      conditionMet = matching.length > 0;
    } else {
      conditionMet = (count || 0) > 0;
    }
  } else {
    // Standard channel conditions
    const { count } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", execution.contact_id)
      .eq("channel", channel)
      .eq("event_type", eventType)
      .gte("created_at", since);

    conditionMet = (count || 0) > 0;
  }

  await logExecution(supabase, execution.id, node.id, "condition_eval", {
    channel,
    event_type: eventType,
    result: conditionMet,
  });

  return {
    nextNodeId: conditionMet ? node.true_node_id : node.false_node_id,
    delay: 0,
  };
}

async function processActionNode(
  supabase: any,
  execution: any,
  node: any,
  contact: any
): Promise<{ nextNodeId: string | null; delay: number }> {
  const config = node.config || {};
  // config: { action: "add_to_list"|"remove_from_list", list_id: "..." }
  const action = config.action || "";

  if (action === "add_to_list" && config.list_id) {
    // Copy contact to target list
    await supabase.from("prospect_list_items").insert({
      list_id: config.list_id,
      user_id: execution.user_id,
      item_type: contact.item_type || "lead",
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      title: contact.title,
      linkedin_url: contact.linkedin_url,
      location: contact.location,
      industry: contact.industry,
    });
    await logExecution(supabase, execution.id, node.id, "action_add_to_list", { list_id: config.list_id });
  } else if (action === "remove_from_list" && config.list_id) {
    await supabase
      .from("prospect_list_items")
      .delete()
      .eq("id", execution.contact_id)
      .eq("list_id", config.list_id);
    await logExecution(supabase, execution.id, node.id, "action_remove_from_list", { list_id: config.list_id });
  } else {
    await logExecution(supabase, execution.id, node.id, "action_unknown", { config });
  }

  return { nextNodeId: node.next_node_id, delay: 0 };
}

// ──────────────────────────────────────────────
// Main processor
// ──────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const BATCH_SIZE = 100;
    const MAX_RETRIES = 3;

    // Fetch pending executions
    const { data: executions, error: execErr } = await supabase
      .from("workflow_executions")
      .select("*, workflows(*)")
      .eq("status", "running")
      .lte("next_run_at", new Date().toISOString())
      .limit(BATCH_SIZE);

    if (execErr) throw execErr;
    if (!executions || executions.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const execution of executions) {
      const workflow = execution.workflows;
      if (!workflow || workflow.status !== "active") {
        // Workflow paused/deleted — pause execution
        await supabase
          .from("workflow_executions")
          .update({ status: "paused" })
          .eq("id", execution.id);
        skipped++;
        continue;
      }

      // Check schedule
      if (!isWithinSchedule(workflow)) {
        skipped++;
        continue;
      }

      // Get current node
      if (!execution.current_node_id) {
        await supabase
          .from("workflow_executions")
          .update({ status: "completed" })
          .eq("id", execution.id);
        continue;
      }

      const { data: node } = await supabase
        .from("workflow_nodes")
        .select("*")
        .eq("id", execution.current_node_id)
        .single();

      if (!node) {
        await logExecution(supabase, execution.id, null, "node_not_found", { node_id: execution.current_node_id });
        await supabase
          .from("workflow_executions")
          .update({ status: "failed", error_message: "Node not found" })
          .eq("id", execution.id);
        failed++;
        continue;
      }

      // Get contact data
      const { data: contact } = await supabase
        .from("prospect_list_items")
        .select("*")
        .eq("id", execution.contact_id)
        .single();

      if (!contact) {
        await supabase
          .from("workflow_executions")
          .update({ status: "failed", error_message: "Contact not found" })
          .eq("id", execution.id);
        failed++;
        continue;
      }

      try {
        let result: { nextNodeId: string | null; delay: number };

        switch (node.type) {
          case "start":
            result = await processStartNode(supabase, execution, node);
            break;
          case "send_email":
            result = await processSendEmailNode(supabase, execution, node, contact, workflow);
            break;
          case "send_linkedin":
            result = await processSendLinkedInNode(supabase, execution, node, contact, workflow);
            break;
          case "send_whatsapp":
            result = await processSendWhatsAppNode(supabase, execution, node, contact, workflow);
            break;
          case "wait":
            result = await processWaitNode(supabase, execution, node);
            break;
          case "condition":
            result = await processConditionNode(supabase, execution, node, contact);
            break;
          case "action":
            result = await processActionNode(supabase, execution, node, contact);
            break;
          case "end":
            result = await processEndNode(supabase, execution, node);
            break;
          default:
            await logExecution(supabase, execution.id, node.id, "unknown_node_type", { type: node.type });
            result = { nextNodeId: node.next_node_id, delay: 0 };
        }

        if (node.type !== "end") {
          if (result.nextNodeId) {
            const nextRunAt = new Date(Date.now() + result.delay).toISOString();
            await supabase
              .from("workflow_executions")
              .update({
                current_node_id: result.nextNodeId,
                next_run_at: nextRunAt,
                retry_count: 0,
              })
              .eq("id", execution.id);
          } else {
            // No next node — complete
            await supabase
              .from("workflow_executions")
              .update({ status: "completed" })
              .eq("id", execution.id);
          }
        }

        processed++;
      } catch (e) {
        console.error(`[WF] Execution ${execution.id} error:`, e.message);
        const newRetry = (execution.retry_count || 0) + 1;

        if (newRetry >= MAX_RETRIES) {
          await supabase
            .from("workflow_executions")
            .update({ status: "failed", error_message: e.message, retry_count: newRetry })
            .eq("id", execution.id);
          await logExecution(supabase, execution.id, node.id, "max_retries", { error: e.message });
        } else {
          // Exponential backoff: 1min, 4min, 9min
          const backoffMs = newRetry * newRetry * 60000;
          await supabase
            .from("workflow_executions")
            .update({
              retry_count: newRetry,
              next_run_at: new Date(Date.now() + backoffMs).toISOString(),
            })
            .eq("id", execution.id);
          await logExecution(supabase, execution.id, node.id, "retry", { attempt: newRetry, error: e.message });
        }
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed, skipped, failed, total: executions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[WF] Fatal error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
