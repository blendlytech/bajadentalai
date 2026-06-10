import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  }

  try {
    const payload = await req.json();
    const msg = payload?.message;

    // Only process end-of-call-report events
    if (msg?.type !== "end-of-call-report") {
      return new Response(JSON.stringify({ skipped: true, type: msg?.type }), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const structured = msg?.analysis?.structuredData ?? {};
    const artifact   = msg?.artifact ?? {};
    const call       = msg?.call ?? {};

    // Entry point that originated the call, set via the Vapi Web SDK call metadata
    // ( vapi.start(id, { metadata: { source: "..." } }) ). Check the likely
    // locations so it works regardless of where Vapi nests it in the payload.
    const source =
      call.metadata?.source ??
      call.assistantOverrides?.metadata?.source ??
      msg?.metadata?.source ??
      structured.source ??
      null;

    const lead = {
      call_id:            call.id ?? null,
      patient_name:       structured.patient_name ?? null,
      procedure_interest: structured.procedure_interest ?? null,
      language_spoken:    structured.language_spoken ?? null,
      phone_number:       call.customer?.number ?? null,
      summary:            structured.call_summary ?? null,
      transcript:         artifact.transcript ?? null,
      recording_url:      artifact.recordingUrl ?? null,
      source:             source,
      status:             "new",
    };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await supabase.from("leads").insert(lead);

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, source }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
