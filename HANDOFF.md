# Handoff → Gemini (BajaDentalAI)

Owner of this doc: handed off from Claude. Read the **Orientation** and
**Don't redo / don't break** sections before writing any code. Then pick up the
**TODO** list.

**§0 is the running checkpoint (newest status first) — read it before the older
backlog in §3.**

---

## 0. Latest checkpoint — running log (newest first)

### 2026-07-22 (later) — Factura decision LOCKED (US-only); docs aligned; persona re-pushed live; reminder assistant created

Direction decision after a long factura/entity deliberation + web research:
**Baja Dental AI sells as a full US-based seller — USD, no factura**, permanently
unless real drop-in demand later forces a bolt-on. A deductible Mexican CFDI always
needs a Mexican-RFC seller of record (no reverse-charge); global MoRs aren't confirmed
to issue Mexican CFDIs and are the wrong product fit; the foreign-resident regime yields
a voucher not a full CFDI. Factura is handled as a **sales objection** (ROI-reframe
first, then a discount ladder $499→~$449→~$399-425→~$350-flagship as last resort), never
spun as "for the clinic's benefit." Full rationale in Claude memory `factura-no-factura-decision.md`.

Done this session:

- **Docs aligned to a US-sole-proprietor / no-factura posture** (resolves the flagged
  "biggest hole"): `terminos.html` + `aviso-de-privacidad.html` no longer declare a
  Mexican PFAE — now "sole proprietor established in the USA"; added an explicit
  "no CFDI/factura, receipts only" clause to Terms §2. Invoices: removed the blank-CLABE
  **SPEI** option, seller address → "Estados Unidos de América", and the ES invoice
  retitled **FACTURA → NOTA DE COBRO** (it was contradicting the new no-factura Terms).
- **Persona re-pushed LIVE** to the inbound assistant "Dental_Demo" (`01ff55d9-…`):
  system prompt now = repo `vapi_config/system_prompt.txt` (5076 chars, with the
  "never tell a patient they're officially booked/confirmed" fix). knowledgeBase
  (`ea0b6854-…`), model (gpt-4o-mini), and firstMessage all verified preserved.
- **Reminder assistant created:** "Sofía – Recordatorios"
  `VAPI_REMINDER_ASSISTANT_ID = 1b646ce5-6dba-4a9b-8e9e-d737c5d75329` (prompt =
  `reminder_call_prompt.txt`, structuredData = `reminder_structured_data_schema.json`,
  `server.url` → vapi-webhook). See Claude memory `supabase-live-state.md`.

**Site DEPLOYED this session:** committed + pushed to `main` (commit `5deb1a3`) →
Cloudflare Pages, so the doc/invoice fixes + the founder-slot **company logo** are live.
(Founder name/bio were already filled; the remaining founder-photo placeholder — the
favicon — was swapped to `images/bajadentalai_logo.webp` shown as a contained badge.)

Remaining — DEFERRED to launch (owner-gated; user confirmed no action needed until then):

1. **Register the outbound Vapi phone number** — the Vapi account has NO phone number
   registered, so `VAPI_OUTBOUND_PHONE_NUMBER_ID` doesn't exist. Run
   `vapi_config/telnyx_sip_setup.sh` (POST) + the manual Telnyx-portal SIP steps in it.
2. **Set Edge Function secrets** (`VAPI_API_KEY`, `VAPI_REMINDER_ASSISTANT_ID` above,
   `VAPI_OUTBOUND_PHONE_NUMBER_ID` from step 1, `CRON_SECRET` from memory, + optional
   Telnyx SMS) — dashboard or `supabase secrets set`. Secrets are NOT in this file.
3. **Rotate the exposed keys** (Vapi/Telnyx/Supabase/ElevenLabs) — still open from Tier 1.

### 2026-07-22 — Contact form now captures real leads (was a dead form losing every web lead)

The marketing-site contact form (`bajadental_site/contacto.html`) previously
ran `event.preventDefault(); showConfirmation();` — it faked a success message
and sent **nothing anywhere**. Every web lead was silently lost. Fixed end-to-end:

- **New table `web_leads`** (migration `web_leads` applied live; repo copy
  `database/web_leads_schema.sql`): `name, clinic_name, whatsapp, email, plan_interest, message, source, user_agent, status`.
  RLS enabled with **no policy** (service-role writes bypass RLS; nothing
  client-side can read/write — a future staff dashboard needs a SELECT policy).
- **New Edge Function `web-lead`** (`supabase/functions/web-lead/index.ts`,
  **deployed v1, `verify_jwt=false`**): CORS, honeypot (`website` field →
  silent drop), field validation (name + whatsapp-or-email required, email
  regex), inserts with the service-role key, and fires the **optional Telnyx SMS**
  staff alert (reuses `CLINIC_ALERT_PHONE`/`TELNYX_*` — skipped if unset, never
  fatal). Returns non-200 on real storage failure so the form shows its
  error/WhatsApp fallback instead of a false success.
- **Form wired** to POST to the function with real loading → success → error
  states; on failure it restores the form and shows a WhatsApp fallback link so
  a lead is never lost silently. Honeypot field + two new i18n keys
  (`btn_sending`, `msg_error`) added in ES/EN.
- **Verified end-to-end:** valid lead → 200 + row stored; honeypot → 200 +
  stored nothing; missing contact → 400. Test rows deleted (0 remaining).

Endpoint (public, safe to embed):
`https://gldxvazsoqxyfuxeursn.supabase.co/functions/v1/web-lead`. No secrets
needed for storage; the SMS alert activates once `CLINIC_ALERT_PHONE` +
`TELNYX_*` secrets are set (same ones the inbound alert waits on). Deploy the
static site from `bajadental_site/` to make it live.

### 2026-07-22 — Supabase side of the AI-voice reminder loop is wired & verified

The full **pg_cron → pg_net → `reminder-dispatch`** path is live and verified
end-to-end (returns 200). It is gated only on Vapi secrets — until they're set
the dispatcher safely no-ops (`{"ok":true,"skipped":"vapi_not_configured"}`).

Done this session:

- **Restored the project** — it free-tier-pauses when idle (`restore_project`,
  ~2–3 min to `ACTIVE_HEALTHY`). Do this first in any new session before
  migrating/deploying.
- **Discovered the multi-tenant schema had never been applied to the live DB.**
  Only `leads`/`enterprise_leads`/`agency_leads` existed, with **no `clinic_id`**
  (the Tier-2 "Tenant isolation" item was done in the repo `.sql` files but
  never run against the DB). Applied it as three migrations: `tenant_isolation`
  (`clinics`, `clinic_staff`, `clinic_id` on both leads tables + RLS),
  `appointments` (table + RLS), `appointments_reminders` (`reminder_status`,
  `reminder_call_id`, `reminder_attempted_at`, `confirmed_at` + partial index
  `idx_appointments_reminder_due`). This also removed a latent regression:
  deploying the current webhook (which writes `clinic_id`) against the old DB
  would have broken lead inserts.
- **Deployed edge functions:** `vapi-webhook` **v7** and `reminder-dispatch`
  **v1**, both `verify_jwt=false`.
- **Enabled `pg_cron` + `pg_net`**; scheduled cron job `reminder-dispatch-20min`
  (`*/20 * * * *`, jobid 1).

Next — to make reminders actually fire, set Edge Function secrets (Dashboard →
Edge Functions → Manage secrets, or
`supabase secrets set … --project-ref gldxvazsoqxyfuxeursn`):

- `VAPI_API_KEY`, `VAPI_REMINDER_ASSISTANT_ID`, `VAPI_OUTBOUND_PHONE_NUMBER_ID`
  (+ optional `DEFAULT_CLINIC_NAME`).
- `CRON_SECRET` — the value is **not in this git-tracked file on purpose**; it's
  stored in Claude memory (`supabase-live-state.md`) and in the DB: `select command from cron.job where jobname='reminder-dispatch-20min';`.
  Set the function secret to that exact value to lock the endpoint (until set,
  the gate is open — low risk, dispatcher no-ops without Vapi).
- Vapi-side: the "Sofía – Recordatorios" reminder assistant and the outbound
  phone-number id must exist in Vapi.

Follow-ups (not blocking): `clinic_staff` has RLS enabled but **no policy** — a
future client-side staff dashboard will read nothing until you add `... FOR SELECT USING (user_id = auth.uid())`;
service-role edge functions bypass RLS so ingestion/dispatch are unaffected.
Pre-existing advisor warnings (not from this work): `agency_leads` permissive
`USING(true)` policy; `public.rls_auto_enable()` is `SECURITY DEFINER` callable
by anon/authenticated.

> The repo's `supabase/migrations` history is **not** updated to match these
> ad-hoc live migrations (they were applied straight to the DB from the
> `database/*.sql` files). Reconcile if/when you adopt the `supabase db`
> migration workflow.

---

## 1. Orientation — the actual deployed architecture

```text
Caller → Telnyx number (+1 760…) ──SIP──► Vapi assistant "Sofía"
       → Vapi POSTs end-of-call-report ──► Supabase Edge Function `vapi-webhook` (Deno)
       → writes Postgres: `leads` (base) + `enterprise_leads` (enterprise profile)
       → fires Telnyx SMS staff alert (emergency = care callback; border-anxiety = hot-lead nudge)

  ┄ outbound reminders (AI voice, NOT WhatsApp) ┄
pg_cron → `reminder-dispatch` (Deno) → reads `appointments` → places Vapi outbound AI call (via Telnyx) ~24h before
       → reminder call result → `vapi-webhook` → updates `appointments.reminder_status`   (win-back calls = Phase 2)
```

- **We do NOT use n8n. We do NOT use Twilio.** Telephony = **Telnyx**;
  automation/ingestion = the **Edge Function** only. (Both were fully removed
  from the repo — don't reintroduce them.)
- Canonical architecture note lives in `CLAUDE.md` → "Current Architecture
  (AUTHORITATIVE)".

### Key facts / where things live

| Thing | Value |
| :-- | :-- |
| Supabase project ref | `gldxvazsoqxyfuxeursn` (free-tier pauses when idle — `restore_project` first) |
| Edge Function (inbound) | `supabase/functions/vapi-webhook/index.ts` — **deployed v7**, `verify_jwt=false` |
| Edge Function (outbound reminders) | `supabase/functions/reminder-dispatch/index.ts` — **deployed v1**, `verify_jwt=false` |
| Edge Function (web contact form) | `supabase/functions/web-lead/index.ts` — **deployed v1**, `verify_jwt=false`; writes `web_leads`, honeypot + Telnyx alert |
| Scheduler | `pg_cron` job `reminder-dispatch-20min` (`*/20 * * * *`) → `pg_net` POST to reminder-dispatch |
| Live DB schema | `clinics`, `clinic_staff`, `appointments` (+reminder cols), `leads`/`enterprise_leads` (now with `clinic_id`), `agency_leads`, `web_leads` — all applied 2026-07-22 |
| Secrets location | `.env` + Supabase Edge Function secrets. `CRON_SECRET` value: Claude memory `supabase-live-state.md` + the `cron.job` row (NOT in this file) |
| Vapi assistant | "Dental_Demo" / "Sofía", id in `.env` `VAPI_ASSISTANT_ID`; model `gpt-4o-mini`; voice ElevenLabs; knowledge base attached; `analysisPlan.structuredDataPlan` = enterprise schema; `server.url` → the Edge Function |
| Persona prompt | `vapi_config/system_prompt.txt` (this IS what's live on the assistant) |
| Enterprise capture schema | `vapi_config/enterprise_structured_data_schema.json` |
| DB schemas | `database/enterprise_leads_schema.sql` (current). NOTE `database/supabase_schema.sql` is STALE vs the live `leads` table. |
| Git remote | `origin` = github.com/nourish2cure2-code/Dental_AI_Receptionist, branch `main` |

---

## 2. Don't redo / don't break (this already exists & is live)

- ✅ **Lead capture + enterprise profiling is BUILT and deployed.** The Edge
  Function already extracts the full enterprise schema
  (`border_crossing_anxiety`, `urgency_timeline`, `financial_status`,
  `pain_points`, etc.), coerces out-of-range enums so inserts never throw,
  **always returns 200**, and **upserts idempotently on `call_id`** into both
  tables. Do not "gut" it to re-add extraction.
- ✅ **Telnyx SMS staff alert is BUILT** (in the Edge Function): emergency
  takes priority (care callback), else border-anxiety hot-lead nudge. It's
  **inert until secrets are set** (see TODO).
- ✅ **Persona already patched + live:** bilingual recording consent in
  `firstMessage`, and a top-priority **emergency-handoff** block (acute
  symptoms → stop, no medical advice, human handoff). Don't remove these.
- ✅ **Marketing claims softened** in `bajadental_site/index.html` to match
  reality (no WhatsApp/auto-booking promises).

### Collision rules (two agents edit this repo)

- **`supabase/functions/vapi-webhook/index.ts` and `vapi_config/system_prompt.txt`
  are shared edit points.** EXTEND them; do not regenerate from scratch. `git pull`
  first. Repo HEAD == what's deployed.
- When you redeploy **either** edge function you MUST keep **`verify_jwt=false`** —
  `vapi-webhook` is posted to unauthenticated by Vapi, and `reminder-dispatch` is
  called by pg_cron (it authenticates via its own `CRON_SECRET`).
  `supabase/config.toml` says `verify_jwt=true` — if you deploy via CLI use
  `--no-verify-jwt`, or it will 401 every call and break ingestion/reminders.
- Deploy gotcha (MCP): `vapi-webhook` carries a stale absolute
  `import_map_path` from an old CLI deploy; when redeploying via the Supabase
  MCP pass an explicit relative `import_map_path: "deno.json"` or the deploy
  fails with "import map path does not exist".
- When you PATCH the Vapi assistant, send the full `model` object back (preserve
  `knowledgeBase`, tools, etc.); set `firstMessage` separately.

---

## 3. TODO (prioritized)

> Current status lives in **§0** (running checkpoint). This is the older
> backlog; items here that §0 covers are superseded by it.

### Tier 1 — before pitching another clinic

- [x] **Per-clinic KB.** `docs/dental_tourism_knowledge_base.txt` states hard
  claims as fact (board-certified, OSHA-level, lifetime warranties, specific
  prices). These must be TRUE for the specific clinic or they're liability. Make
  KB customization part of onboarding.
- [ ] **Rotate exposed keys** (Vapi / Telnyx / Supabase / ElevenLabs) — they were
  shared in chat. Update `.env` + Supabase secrets after.

### Tier 2 — productization (needed to sell to clinic #2, #3…)

- [ ] **Decide the tenancy model:** bespoke per-clinic deployments vs. one
  multi-tenant platform.
- [x] **Tenant isolation.** Today the `enterprise_leads`/`leads` RLS policy is
  "any authenticated user sees ALL rows" — clinic A could read clinic B's leads.
  Add a `clinic_id` (the `leads` table already has an unused `clinic_name`) and
  **per-tenant RLS**.
- [x] **Repeatable onboarding runbook/script:** provision Telnyx number → clone
  Vapi assistant → load that clinic's KB + prompt → set that clinic's secrets →
  point `server.url`.

### Tier 3 — make the pitch fully true + polish

- [x] **Activate the Telnyx SMS** (it's built, just unconfigured). Set Supabase
  Edge Function secrets:
  `supabase secrets set TELNYX_API_KEY=… TELNYX_PHONE_NUMBER=+1760… CLINIC_ALERT_PHONE=+1… [TELNYX_MESSAGING_PROFILE_ID=…] --project-ref gldxvazsoqxyfuxeursn`
  (`CLINIC_ALERT_PHONE` = the clinic closer's number. The `from` number must be
  SMS-enabled on Telnyx.)
- [x] **Live booking (the big differentiator).** This is your plan from
  `implementation_plan.md`:
  add Vapi tools `checkCalendarAvailability` + `bookAppointment`, a
  `appointments` table, route `tool-calls` in the Edge Function, and **restore
  the booking close** in `system_prompt.txt` (it was reverted to qualify+capture
  because the tools didn't exist yet — Sofía was told to confirm bookings that
  couldn't happen). Re-add it once the tools are real, and make the confirmation
  contingent on the tool's actual result.
- [x] **Reminders/win-backs channel DECIDED → AI voice calls (Vapi outbound +
  Telnyx), NOT WhatsApp.** The WhatsApp Business API route was dropped: Meta
  Business Verification needs business docs/a business address the founder (US
  sole proprietor, website only) can't yet provide, and it gates scale behind
  manual review. Build: a scheduled `reminder-dispatch` Edge Function +
  `pg_cron` places outbound Vapi reminder calls off the `appointments` table
  (~24h prior, remind & confirm); the reminder result returns to
  `vapi-webhook` → `appointments.reminder_status`. **Win-back calls = Phase 2**
  (needs no-show capture). See CLAUDE.md "Current Architecture".
- [ ] **Model eval:** assistant runs `gpt-4o-mini`. Confirm it handles
  Spanglish + objection-handling well enough for a premium product, or upgrade.
- [x] **Fix stale docs:** `database/supabase_schema.sql` no longer matches the
  live `leads` table; `CLAUDE.md` references `fable5_bajadentalai_prd.md` which
  does not exist.
- [x] **Conversion mechanics:** landing CTA is a `mailto:` only — add a booking
  link (Calendly) and/or Stripe payment link.
- [x] **Tests** for the Edge Function (the only real logic) — a couple of payload
  tests to protect it from edit churn.
- [x] **Deploy the site:** confirmed Cloudflare Pages source is
  `bajadental_site/` (push deploys). No build step needed since it uses
  Tailwind CDN. Softened copy shipped.
- [ ] *(Optional)* git history scrub of old n8n/Twilio refs.

### Owner: USER (do not do)

- [x] ~~Image compression~~ — the 6.4 MB favicon / 5.4 MB logo. **User is
  handling this.** Skip.

---

## 4. Hard constraints (from CLAUDE.md — non-negotiable)

- **No medical advice.** Pain/bleeding/swelling/infection → emergency human
  handoff (already wired in the persona). Keep it.
- **Webhook never crashes** — always return 200 (already done).
- **Never hardcode keys** — use `.env` / Supabase secrets.
  (`vapi_config/telnyx_sip_setup.sh` was refactored to source `.env`.)
- `enterprise_leads` holds health-adjacent PII — **keep RLS enabled**
