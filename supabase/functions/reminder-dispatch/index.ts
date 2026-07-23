import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// reminder-dispatch — outbound AI voice appointment reminders (Phase B).
//
// Triggered on a schedule (Supabase pg_cron → pg_net, see
// database/appointments_reminders_schema.sql). For each appointment ~24h out
// that hasn't been reminded yet, it places an outbound Vapi call over the
// clinic's Telnyx number using the reminder assistant. The reminder call's
// end-of-call-report returns to `vapi-webhook`, which records the outcome on
// the appointment.
//
// This is deliberately VOICE, not WhatsApp. Never throws to the caller — like
// vapi-webhook it always returns 200 with a summary, so a scheduler never gets
// disabled by a transient error.
//
// Required Edge Function secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (provided by the platform)
//   VAPI_API_KEY                              (Vapi PRIVATE key)
//   VAPI_REMINDER_ASSISTANT_ID                ("Sofía – Recordatorios" assistant)
//   VAPI_OUTBOUND_PHONE_NUMBER_ID             (Telnyx number registered in Vapi)
// Optional:
//   CRON_SECRET        — if set, callers must send header x-cron-secret to match
//   DEFAULT_CLINIC_NAME — fallback clinic name when an appointment has no clinic
// ---------------------------------------------------------------------------

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const REMIND_LEAD_MIN_HOURS = 23; // start of the "due" window (hours from now)
const REMIND_LEAD_MAX_HOURS = 25; // end of the "due" window
const MAX_PER_RUN = 100;

// Human, localized appointment time for the voice ("martes, 23 de julio, 10:00 a.m.").
function formatApptTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Tijuana",
    }).format(d);
  } catch {
    return iso;
  }
}

// Place one outbound reminder call. Returns the Vapi call id on success.
async function placeReminderCall(appt: {
  id: string;
  patient_name: string | null;
  phone_number: string | null;
  appointment_time: string;
  clinic_id: string | null;
  clinicName: string;
}, apiKey: string, assistantId: string, phoneNumberId: string): Promise<string> {
  const res = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      phoneNumberId,
      assistantId,
      customer: { number: appt.phone_number },
      assistantOverrides: {
        variableValues: {
          patient_name: appt.patient_name ?? "",
          clinic_name: appt.clinicName,
          appointment_time: formatApptTime(appt.appointment_time),
        },
        // Read back by vapi-webhook on the end-of-call-report to record the outcome.
        metadata: {
          kind: "reminder",
          appointment_id: appt.id,
          clinic_id: appt.clinic_id,
        },
      },
    }),
  });

  if (!res.ok) throw new Error(`Vapi ${res.status}: ${await res.text()}`);
  const data = await res.json().catch(() => ({}));
  return data?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  }

  // Optional shared-secret gate (the pg_cron job sends x-cron-secret).
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const summary = { dispatched: 0, failed: 0, skipped: 0, errors: [] as string[] };

  try {
    const apiKey = Deno.env.get("VAPI_API_KEY");
    const assistantId = Deno.env.get("VAPI_REMINDER_ASSISTANT_ID");
    const phoneNumberId = Deno.env.get("VAPI_OUTBOUND_PHONE_NUMBER_ID");
    const fallbackClinic = Deno.env.get("DEFAULT_CLINIC_NAME") ?? "la clínica";

    if (!apiKey || !assistantId || !phoneNumberId) {
      console.warn("reminder-dispatch skipped: VAPI_API_KEY / VAPI_REMINDER_ASSISTANT_ID / VAPI_OUTBOUND_PHONE_NUMBER_ID not all set");
      return new Response(JSON.stringify({ ok: true, skipped: "vapi_not_configured" }), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = Date.now();
    const windowStart = new Date(now + REMIND_LEAD_MIN_HOURS * 3600_000).toISOString();
    const windowEnd = new Date(now + REMIND_LEAD_MAX_HOURS * 3600_000).toISOString();

    // Due & not yet reminded (matches idx_appointments_reminder_due).
    const { data: appts, error: qErr } = await supabase
      .from("appointments")
      .select("id, patient_name, phone_number, appointment_time, clinic_id, clinics(name)")
      .eq("status", "confirmed")
      .eq("reminder_status", "pending")
      .gte("appointment_time", windowStart)
      .lte("appointment_time", windowEnd)
      .limit(MAX_PER_RUN);

    if (qErr) {
      summary.errors.push(`query: ${qErr.message}`);
      console.error("reminder-dispatch query error:", qErr.message);
      return new Response(JSON.stringify({ ok: false, ...summary }), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    for (const row of appts ?? []) {
      // No dialable number → mark skipped so we don't rescan it forever.
      if (!row.phone_number || row.phone_number === "Unknown") {
        summary.skipped++;
        await supabase.from("appointments")
          .update({ reminder_status: "skipped", reminder_attempted_at: new Date().toISOString() })
          .eq("id", row.id);
        continue;
      }

      const clinicName =
        (row as { clinics?: { name?: string } | null }).clinics?.name ?? fallbackClinic;

      try {
        const callId = await placeReminderCall(
          { ...row, clinicName },
          apiKey, assistantId, phoneNumberId,
        );
        await supabase.from("appointments")
          .update({
            reminder_status: "called",
            reminder_call_id: callId,
            reminder_attempted_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        summary.dispatched++;
      } catch (callErr) {
        const msg = callErr instanceof Error ? callErr.message : String(callErr);
        summary.failed++;
        summary.errors.push(`appt ${row.id}: ${msg}`);
        await supabase.from("appointments")
          .update({ reminder_status: "failed", reminder_attempted_at: new Date().toISOString() })
          .eq("id", row.id);
      }
    }

    if (summary.errors.length) console.error("reminder-dispatch partial:", summary.errors.join(" | "));
    return new Response(JSON.stringify({ ok: summary.failed === 0, ...summary }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    // Never surface a non-200 to the scheduler; log for diagnosis.
    console.error("reminder-dispatch fatal:", String(err));
    return new Response(JSON.stringify({ ok: false, error: String(err), ...summary }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
