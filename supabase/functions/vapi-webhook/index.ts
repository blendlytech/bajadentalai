import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ENT_FINANCIAL,
  ENT_LANGUAGE,
  ENT_PROCEDURE,
  ENT_URGENCY,
  baseLanguage,
  baseProcedure,
  inSet,
  parseAppointmentTime,
  parseToolArgs,
  reminderStatusFor,
  resolveClinicId,
  toBool,
  toNum,
} from "./logic.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Mid-call tool routing: intercept live bookings.
    if (msg?.type === "tool-calls") {
      const results: any[] = [];
      const toolCalls = msg?.toolCalls ?? [];

      // Vapi nests everything under `message` (that is why `msg.toolCalls` above
      // works). Read the call object from there. `payload.call` is kept only as a
      // defensive fallback in case a future payload shape hoists it.
      const toolCall = msg?.call ?? payload?.call ?? {};
      const clinicId = resolveClinicId(toolCall);

      for (const tc of toolCalls) {
        const name = tc?.function?.name;
        const args = parseToolArgs(tc?.function?.arguments);

        if (name === "checkCalendarAvailability") {
          // NOTE: there is no calendar integration yet. This deliberately does NOT
          // invent slots — quoting fabricated times to patients causes real-world
          // double-bookings and no-shows. Ask for the patient's preference instead
          // and let the clinic confirm.
          results.push({
            toolCallId: tc.id,
            result:
              "AVAILABILITY_UNKNOWN: real-time calendar access is not connected. " +
              "Do not state or imply specific open slots. Ask the patient which day " +
              "and rough time they prefer, then record it as a REQUEST that the " +
              "clinic will confirm.",
          });
        } else if (name === "bookAppointment") {
          const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          );

          // Never default a missing/!unparseable time to "now" — that silently
          // creates an appointment at the moment of the call.
          const when = parseAppointmentTime(args.appointment_date_time);
          if (!when) {
            results.push({
              toolCallId: tc.id,
              result:
                "Could not record: no valid date/time was captured. Ask the patient " +
                "to restate the day and time, then try again.",
            });
            continue;
          }

          const { error } = await supabase.from("appointments").insert({
            clinic_id: clinicId,
            call_id: toolCall?.id ?? null,
            patient_name: args.patient_name ?? "Unknown",
            phone_number: args.phone_number ?? "Unknown",
            appointment_time: when.toISOString(),
            // Explicit, not relying on the column default: the AI can only ever
            // record a REQUEST. Only a human at the clinic promotes it to
            // 'confirmed', which is what makes it eligible for a reminder call.
            status: "requested",
          });

          if (error) {
            console.error("bookAppointment DB error:", error.message);
            results.push({
              toolCallId: tc.id,
              result: "Error booking appointment. Please tell the user a coordinator will call them to manually schedule.",
            });
          } else {
            // Wording matches the persona rule: never tell a patient they are
            // officially booked. It is a request until the clinic confirms.
            results.push({
              toolCallId: tc.id,
              result:
                "Request recorded. Tell the patient the clinic will call to confirm " +
                "the time — do NOT say it is already confirmed or guaranteed.",
            });
          }
        } else {
          // Every toolCallId must get a result or the assistant stalls mid-call.
          console.warn(`vapi-webhook: unhandled tool call "${name}"`);
          results.push({
            toolCallId: tc?.id,
            result: "That action is not available. Offer to have a coordinator follow up.",
          });
        }
      }

      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

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

    // Multi-tenant routing: Extract the clinic_id from Vapi metadata so leads
    // are correctly isolated via Row Level Security.
    const clinicId =
      call.assistantOverrides?.metadata?.clinic_id ??
      call.metadata?.clinic_id ??
      msg?.assistant?.metadata?.clinic_id ??
      null;

    const campaignType = 
      call.assistantOverrides?.metadata?.campaign_type ??
      call.metadata?.campaign_type ??
      msg?.assistant?.metadata?.campaign_type ??
      null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- Reminder-call result branch ----------------------------------------
    // Outbound AI reminder/confirmation calls (from `reminder-dispatch`) carry
    // metadata.kind === "reminder". Record the outcome on the appointment
    // instead of treating the call as an inbound patient lead.
    const callKind =
      call.assistantOverrides?.metadata?.kind ??
      call.metadata?.kind ??
      msg?.metadata?.kind ??
      null;

    if (callKind === "reminder") {
      const appointmentId =
        call.assistantOverrides?.metadata?.appointment_id ??
        call.metadata?.appointment_id ??
        null;

      const outcome =
        typeof structured.reminder_outcome === "string" ? structured.reminder_outcome : "unknown";
      // Constrained to appointments_reminder_status_check — see logic.ts.
      const reminderStatus = reminderStatusFor(outcome);

      if (appointmentId) {
        const patch: Record<string, unknown> = { reminder_status: reminderStatus };
        if (outcome === "confirmed") patch.confirmed_at = new Date().toISOString();
        if (outcome === "cancel") patch.status = "cancelled";
        const { error: rErr } = await supabase.from("appointments").update(patch).eq("id", appointmentId);
        if (rErr) errors.push(`appointments reminder update: ${rErr.message}`);
      } else {
        errors.push("reminder call missing appointment_id metadata");
      }

      // A reschedule request needs a human — nudge staff by SMS (reuse Telnyx).
      const remindAlertTo =
        call.assistantOverrides?.metadata?.clinic_alert_phone ??
        call.metadata?.clinic_alert_phone ??
        Deno.env.get("CLINIC_ALERT_PHONE");
      if (remindAlertTo && outcome === "reschedule") {
        const who = structured.patient_name ?? "A patient";
        try {
          await sendTelnyxSms(
            remindAlertTo,
            `Reschedule request: ${who} (${phone ?? "no number"}) asked to move their appointment during the reminder call. Please call them to set a new time.`,
          );
        } catch (smsErr) {
          errors.push(`telnyx_sms_reschedule: ${smsErr instanceof Error ? smsErr.message : String(smsErr)}`);
        }
      }

      if (errors.length) console.error("vapi-webhook reminder partial failure:", errors.join(" | "));
      return new Response(
        JSON.stringify({ ok: errors.length === 0, kind: "reminder", outcome, errors }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // --- 0) B2B Agency Lead Branch ------------------------------------------
    if (campaignType === "b2b_agency") {
      const b2bLead = {
        call_id: callId,
        clinic_name: structured.clinic_name ?? null,
        owner_name: structured.owner_name ?? null,
        phone_number: phone ?? structured.phone_number ?? null,
        current_reception_pain: structured.current_reception_pain ?? null,
        pilot_appointment: structured.pilot_appointment ?? "not_booked",
        summary: summary
      };

      // agency_leads.call_id is NOT NULL — inserting a null would throw and lose the
      // lead entirely. Guard so the SMS alert below still reaches a human.
      if (!callId) {
        errors.push("agency_leads: missing call_id, row not stored (SMS alert still sent)");
      } else {
        const { error: b2bErr } = await supabase
          .from("agency_leads")
          .upsert(b2bLead, { onConflict: "call_id" });

        if (b2bErr) errors.push(`agency_leads: ${b2bErr.message}`);
      }

      // Fire B2B SMS Alert to the Agency Owner
      const alertTo = Deno.env.get("CLINIC_ALERT_PHONE"); // Assuming agency owner uses this env var
      if (alertTo) {
        const text = `HOT B2B LEAD: ${structured.owner_name ?? "An owner"} from ${structured.clinic_name ?? "a clinic"} wants a pilot setup (${structured.pilot_appointment}). Pain point: ${structured.current_reception_pain}. Call them ASAP: ${phone ?? structured.phone_number}`;
        try {
          await sendTelnyxSms(alertTo, text);
        } catch (smsErr) {
          errors.push(`telnyx_sms_b2b: ${smsErr instanceof Error ? smsErr.message : String(smsErr)}`);
        }
      }

      if (errors.length) console.error("vapi-webhook b2b partial failure:", errors.join(" | "));

      return new Response(
        JSON.stringify({ ok: errors.length === 0, errors }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

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

    // --- 1) Base `leads` table (backward compatible) -----------------------
    const lead = {
      call_id: callId,
      clinic_id: clinicId,
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

    // `call_id` is the idempotency key. With a NULL call_id, ON CONFLICT can never
    // match (in Postgres NULL is distinct from NULL), so a Vapi webhook retry would
    // silently create duplicate leads. Still store it — losing a lead is worse than
    // a duplicate — but make the degraded case visible in the logs.
    if (!callId) {
      console.warn("vapi-webhook: end-of-call-report with no call.id — lead stored without dedupe key");
    }
    const { error: leadErr } = callId
      ? await supabase.from("leads").upsert(lead, { onConflict: "call_id" })
      : await supabase.from("leads").insert(lead);
    if (leadErr) errors.push(`leads: ${leadErr.message}`);

    // --- 2) Enterprise profile (full qualification record) -----------------
    const enterprise = {
      call_id: callId,
      clinic_id: clinicId,
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
    const alertTo = 
      call.assistantOverrides?.metadata?.clinic_alert_phone ??
      call.metadata?.clinic_alert_phone ??
      msg?.assistant?.metadata?.clinic_alert_phone ??
      Deno.env.get("CLINIC_ALERT_PHONE");
      
    const anxious = toBool(structured.border_crossing_anxiety);
    if (alertTo && (emergency || anxious)) {
      const name = structured.patient_name ?? "Unknown caller";
      const proc = structured.procedure_interest ?? "an unknown procedure";
      const text = emergency
        ? `MEDICAL PRIORITY: ${name} (${phone ?? "no number"}) reported acute symptoms on the AI call. Have a clinician call back for care now — this is NOT a sales follow-up.`
        // Do not name services or safety assurances here: this text is the brief
        // the closer works from, and the persona is barred from promising
        // transport/shuttles or characterizing area safety unless that exact
        // claim is in the clinic's own KB. Same rule applies to the human.
        : `Hot lead: ${name} wants ${proc} (${structured.financial_status ?? "budget unknown"}, ${structured.urgency_timeline ?? "timeline unknown"}). They raised concerns about crossing the border — call ${phone ?? "them"} and answer their questions with what your clinic actually offers.`;
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
