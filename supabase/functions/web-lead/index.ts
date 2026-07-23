import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// web-lead — receives contact-form submissions from the marketing site
// (bajadental_site/contacto.html) and persists them to the `web_leads` table
// with the service-role key, then fires an optional Telnyx SMS alert to the
// closer. Deployed with verify_jwt=false: it is called directly from the
// browser on the public site (no Supabase session), and protects itself with
// a honeypot + field validation + basic rate cues rather than a JWT.
//
// Required Edge Function secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (provided by the platform)
// Optional (reused from vapi-webhook — if unset the SMS is skipped, never fatal):
//   TELNYX_API_KEY, TELNYX_PHONE_NUMBER, CLINIC_ALERT_PHONE,
//   TELNYX_MESSAGING_PROFILE_ID
// ---------------------------------------------------------------------------

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// Trim + cap length so a pasted essay or an attack can't bloat a row.
const clean = (v: unknown, max = 2000): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
};

// Fire a staff SMS via Telnyx. Mirrors vapi-webhook so behaviour/secrets match.
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  // Honeypot: real users never fill the hidden `website` field. If it's present,
  // pretend success so bots don't learn they were caught — but store nothing.
  if (clean(payload.website)) {
    console.warn("web-lead honeypot triggered — dropping submission");
    return json({ ok: true });
  }

  const name = clean(payload.name, 200);
  const clinic_name = clean(payload.clinic_name, 200);
  const whatsapp = clean(payload.whatsapp, 40);
  const email = clean(payload.email, 320);
  const plan_interest = clean(payload.plan_interest, 60);
  const message = clean(payload.message, 4000);

  // Minimum viable lead: a name plus at least one way to reach them.
  if (!name || (!whatsapp && !email)) {
    return json({ ok: false, error: "missing_required_fields" }, 400);
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: "invalid_email" }, 400);
  }

  const errors: string[] = [];
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: insErr } = await supabase.from("web_leads").insert({
      name,
      clinic_name,
      whatsapp,
      email,
      plan_interest,
      message,
      source: "web_contact_form",
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      status: "new",
    });

    if (insErr) {
      // A failed insert is the one thing we must not silently swallow — the
      // whole point is to stop losing leads. Surface a 500 so the form shows
      // its error/WhatsApp fallback instead of a false success.
      console.error("web-lead insert error:", insErr.message);
      return json({ ok: false, error: "storage_failed" }, 500);
    }

    // Best-effort staff alert. Never blocks or fails the lead capture.
    const alertTo = Deno.env.get("CLINIC_ALERT_PHONE");
    if (alertTo) {
      const reach = [whatsapp, email].filter(Boolean).join(" / ");
      const text =
        `Nuevo lead web: ${name}${clinic_name ? ` (${clinic_name})` : ""} — ` +
        `interés: ${plan_interest ?? "n/d"}. Contacto: ${reach}. ` +
        `Escríbeles por WhatsApp pronto.`;
      try {
        await sendTelnyxSms(alertTo, text);
      } catch (smsErr) {
        errors.push(`telnyx_sms: ${smsErr instanceof Error ? smsErr.message : String(smsErr)}`);
      }
    }

    if (errors.length) console.error("web-lead partial (lead saved):", errors.join(" | "));
    // Lead is safely stored even if the SMS failed — report success.
    return json({ ok: true });
  } catch (err) {
    console.error("web-lead fatal:", String(err));
    return json({ ok: false, error: "server_error" }, 500);
  }
});
