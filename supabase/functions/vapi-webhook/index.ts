import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Enum guards. The live `leads` table and the `enterprise_leads` table use
// different, fixed value sets. Vapi's extracted structuredData can contain
// values that are valid for the enterprise schema but NOT for the base `leads`
// enums (e.g. full_mouth_restoration / unknown / spanglish). Coerce defensively
// so a single out-of-range value can never make the insert throw and lose a lead.
// ---------------------------------------------------------------------------
const LEADS_PROCEDURE = new Set(["veneers", "implants", "whitening", "all_on_4", "crowns", "other"]);
const LEADS_LANGUAGE = new Set(["english", "spanish", "bilingual"]);

const ENT_PROCEDURE = new Set(["all_on_4", "veneers", "implants", "full_mouth_restoration", "whitening", "unknown"]);
const ENT_URGENCY = new Set(["asap", "within_30_days", "within_6_months", "just_browsing"]);
const ENT_FINANCIAL = new Set(["cash_ready", "needs_financing", "price_shopping", "unknown"]);
const ENT_LANGUAGE = new Set(["english", "spanish", "spanglish"]);

const inSet = (set: Set<string>, v: unknown): string | null =>
  typeof v === "string" && set.has(v) ? v : null;

// Map an enterprise procedure/language value onto the closest base `leads` enum.
function baseProcedure(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (LEADS_PROCEDURE.has(v)) return v;
  if (v === "full_mouth_restoration") return "other";
  return null; // e.g. "unknown"
}
function baseLanguage(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (LEADS_LANGUAGE.has(v)) return v;
  if (v === "spanglish") return "bilingual";
  return null;
}

const toBool = (v: unknown): boolean => v === true || v === "true";
const toNum = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

// ---------------------------------------------------------------------------
// Outbound staff alerts via Telnyx SMS, fired natively from this function (no
// n8n). Configure as Supabase Edge Function secrets:
//   TELNYX_API_KEY, TELNYX_PHONE_NUMBER (the "from"), CLINIC_ALERT_PHONE (the
//   staff "to"), and optionally TELNYX_MESSAGING_PROFILE_ID.
// If they are not set the alert is skipped (and logged) — never fatal.
// ---------------------------------------------------------------------------
async function sendTelnyxSms(to: string, text: string): Promise<void> {
  const apiKey = Deno.env.get("TELNYX_API_KEY");
  const from = Deno.env.get("TELNYX_PHONE_NUMBER");
  if (!apiKey || !from) {
    console.warn("Telnyx SMS skipped: TELNYX_API_KEY / TELNYX_PHONE_NUMBER not set");
    return;
  }
  const body: Record<string, unknown> = { from, to, text };
  const profileId = Deno.env.get("TELNYX_MESSAGING_PROFILE_ID");
  if (profileId) body.messaging_profile_id = profileId;

  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Telnyx ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  }

  // CLAUDE.md guardrail: never let the webhook crash. Always return 200 so Meta/
  // Vapi do not disable the webhook. Errors are logged, not surfaced as non-200.
  const errors: string[] = [];

  try {
    const payload = await req.json();
    const msg = payload?.message;

    // Only process end-of-call-report events (carries analysis + artifact).
    if (msg?.type !== "end-of-call-report") {
      return new Response(JSON.stringify({ skipped: true, type: msg?.type }), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const analysis = msg?.analysis ?? {};
    const structured = analysis?.structuredData ?? {};
    const artifact = msg?.artifact ?? {};
    const call = msg?.call ?? {};

    const callId = call.id ?? null;
    const phone = call.customer?.number ?? null;
    const summary = analysis.summary ?? structured.call_summary ?? null;
    const durationMinutes =
      toNum(msg?.durationMinutes) ??
      (toNum(msg?.durationSeconds) !== null ? (msg.durationSeconds as number) / 60 : null);

    // Entry point that originated the call, set via the Vapi Web SDK call metadata.
    const source =
      call.metadata?.source ??
      call.assistantOverrides?.metadata?.source ??
      msg?.metadata?.source ??
      structured.source ??
      null;

    // Safety guardrail (CLAUDE.md): acute symptoms must reach a human for care,
    // never an automated sales follow-up. Surface it loudly in the logs so an
    // operator/alerting integration can pick it up.
    const emergency = toBool(structured.emergency_flag);
    if (emergency) {
      console.warn(
        `[EMERGENCY] call_id=${callId} patient=${structured.patient_name ?? "?"} ` +
          `phone=${phone ?? "?"} — caller reported acute symptoms. Route to a clinician for a CARE callback, not sales.`,
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- 1) Base `leads` table (backward compatible) -----------------------
    const lead = {
      call_id: callId,
      patient_name: structured.patient_name ?? null,
      procedure_interest: baseProcedure(structured.procedure_interest),
      language_spoken: baseLanguage(structured.language_spoken),
      phone_number: phone,
      summary,
      transcript: artifact.transcript ?? null,
      recording_url: artifact.recordingUrl ?? null,
      source,
      status: "new",
    };

    const { error: leadErr } = await supabase
      .from("leads")
      .upsert(lead, { onConflict: "call_id" });
    if (leadErr) errors.push(`leads: ${leadErr.message}`);

    // --- 2) Enterprise profile (full qualification record) -----------------
    const enterprise = {
      call_id: callId,
      patient_name: structured.patient_name ?? null,
      phone_number: phone,
      procedure_interest: inSet(ENT_PROCEDURE, structured.procedure_interest),
      urgency_timeline: inSet(ENT_URGENCY, structured.urgency_timeline),
      financial_status: inSet(ENT_FINANCIAL, structured.financial_status),
      border_crossing_anxiety: toBool(structured.border_crossing_anxiety),
      emergency_flag: emergency,
      travel_origin: structured.travel_origin ?? null,
      pain_points: structured.pain_points ?? null,
      competitors_mentioned: structured.competitors_mentioned ?? null,
      language_spoken: inSet(ENT_LANGUAGE, structured.language_spoken),
      bot_cost_usd: toNum(msg?.cost),
      call_duration_minutes: durationMinutes,
    };

    if (callId) {
      const { error: entErr } = await supabase
        .from("enterprise_leads")
        .upsert(enterprise, { onConflict: "call_id" });
      if (entErr) errors.push(`enterprise_leads: ${entErr.message}`);
    } else {
      errors.push("enterprise_leads: missing call_id, skipped");
    }

    // --- 3) Outbound staff alert via Telnyx SMS (fired from this function) ---
    // Emergency (acute symptoms) takes priority and routes to CARE, never sales.
    // Otherwise a border-anxiety lead gets a factual "address their concern"
    // nudge. SMS failure is recorded but never breaks the 200 response.
    const alertTo = Deno.env.get("CLINIC_ALERT_PHONE");
    const anxious = toBool(structured.border_crossing_anxiety);
    if (alertTo && (emergency || anxious)) {
      const name = structured.patient_name ?? "Unknown caller";
      const proc = structured.procedure_interest ?? "an unknown procedure";
      const text = emergency
        ? `MEDICAL PRIORITY: ${name} (${phone ?? "no number"}) reported acute symptoms on the AI call. Have a clinician call back for care now — this is NOT a sales follow-up.`
        : `Hot lead: ${name} wants ${proc} (${structured.financial_status ?? "budget unknown"}, ${structured.urgency_timeline ?? "timeline unknown"}). They're anxious about the border — call ${phone ?? "them"} and walk them through the VIP shuttle and clinic safety.`;
      try {
        await sendTelnyxSms(alertTo, text);
      } catch (smsErr) {
        errors.push(`telnyx_sms: ${smsErr instanceof Error ? smsErr.message : String(smsErr)}`);
      }
    } else if (emergency || anxious) {
      console.warn("Alert condition met but CLINIC_ALERT_PHONE not set — Telnyx SMS skipped");
    }

    if (errors.length) console.error("vapi-webhook partial failure:", errors.join(" | "));

    return new Response(
      JSON.stringify({ ok: errors.length === 0, errors, emergency, source }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    // Still return 200 so the webhook is never disabled; log for diagnosis.
    console.error("vapi-webhook fatal:", String(err));
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
