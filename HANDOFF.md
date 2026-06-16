# Handoff → Gemini (BajaDentalAI)

Owner of this doc: handed off from Claude. Read the **Orientation** and **Don't redo / don't break** sections before writing any code. Then pick up the **TODO** list.

---

## 1. Orientation — the actual deployed architecture

```
Caller → Telnyx number (+1 760…) ──SIP──► Vapi assistant "Sofía"
       → Vapi POSTs end-of-call-report ──► Supabase Edge Function `vapi-webhook` (Deno)
       → writes Postgres: `leads` (base) + `enterprise_leads` (enterprise profile)
       → fires Telnyx SMS staff alert (emergency = care callback; border-anxiety = hot-lead nudge)
```

- **We do NOT use n8n. We do NOT use Twilio.** Telephony = **Telnyx**; automation/ingestion = the **Edge Function** only. (Both were fully removed from the repo — don't reintroduce them.)
- Canonical architecture note lives in `CLAUDE.md` → "Current Architecture (AUTHORITATIVE)".

### Key facts / where things live
| Thing | Value |
| :-- | :-- |
| Supabase project ref | `gldxvazsoqxyfuxeursn` |
| Edge Function | `supabase/functions/vapi-webhook/index.ts` — **deployed v5**, `verify_jwt=false` |
| Vapi assistant | "Dental_Demo" / "Sofía", id in `.env` `VAPI_ASSISTANT_ID`; model `gpt-4o-mini`; voice ElevenLabs; knowledge base attached; `analysisPlan.structuredDataPlan` = enterprise schema; `server.url` → the Edge Function |
| Persona prompt | `vapi_config/system_prompt.txt` (this IS what's live on the assistant) |
| Enterprise capture schema | `vapi_config/enterprise_structured_data_schema.json` |
| DB schemas | `database/enterprise_leads_schema.sql` (current). NOTE `database/supabase_schema.sql` is STALE vs the live `leads` table. |
| Git remote | `origin` = github.com/nourish2cure2-code/Dental_AI_Receptionist, branch `main` |

---

## 2. Don't redo / don't break (this already exists & is live)

- ✅ **Lead capture + enterprise profiling is BUILT and deployed.** The Edge Function already extracts the full enterprise schema (`border_crossing_anxiety`, `urgency_timeline`, `financial_status`, `pain_points`, etc.), coerces out-of-range enums so inserts never throw, **always returns 200**, and **upserts idempotently on `call_id`** into both tables. Do not "gut" it to re-add extraction.
- ✅ **Telnyx SMS staff alert is BUILT** (in the Edge Function): emergency takes priority (care callback), else border-anxiety hot-lead nudge. It's **inert until secrets are set** (see TODO).
- ✅ **Persona already patched + live:** bilingual recording consent in `firstMessage`, and a top-priority **emergency-handoff** block (acute symptoms → stop, no medical advice, human handoff). Don't remove these.
- ✅ **Marketing claims softened** in `bajadental_site/index.html` to match reality (no WhatsApp/auto-booking promises).

### Collision rules (two agents edit this repo)
- **`supabase/functions/vapi-webhook/index.ts` and `vapi_config/system_prompt.txt` are shared edit points.** EXTEND them; do not regenerate from scratch. `git pull` first. Repo HEAD == what's deployed.
- When you redeploy the Edge Function you MUST keep **`verify_jwt=false`** (Vapi posts unauthenticated). `supabase/config.toml` says `verify_jwt=true` — if you deploy via CLI use `--no-verify-jwt`, or it will 401 every webhook and break ingestion.
- When you PATCH the Vapi assistant, send the full `model` object back (preserve `knowledgeBase`, tools, etc.); set `firstMessage` separately.

---

## 3. TODO (prioritized)

### Tier 1 — before pitching another clinic
- [x] **Per-clinic KB.** `docs/dental_tourism_knowledge_base.txt` states hard claims as fact (board-certified, OSHA-level, lifetime warranties, specific prices). These must be TRUE for the specific clinic or they're liability. Make KB customization part of onboarding.
- [ ] **Rotate exposed keys** (Vapi / Telnyx / Supabase / ElevenLabs) — they were shared in chat. Update `.env` + Supabase secrets after.

### Tier 2 — productization (needed to sell to clinic #2, #3…)
- [ ] **Decide the tenancy model:** bespoke per-clinic deployments vs. one multi-tenant platform.
- [x] **Tenant isolation.** Today the `enterprise_leads`/`leads` RLS policy is "any authenticated user sees ALL rows" — clinic A could read clinic B's leads. Add a `clinic_id` (the `leads` table already has an unused `clinic_name`) and **per-tenant RLS**.
- [x] **Repeatable onboarding runbook/script:** provision Telnyx number → clone Vapi assistant → load that clinic's KB + prompt → set that clinic's secrets → point `server.url`.

### Tier 3 — make the pitch fully true + polish
- [ ] **Activate the Telnyx SMS** (it's built, just unconfigured). Set Supabase Edge Function secrets:
      `supabase secrets set TELNYX_API_KEY=… TELNYX_PHONE_NUMBER=+1760… CLINIC_ALERT_PHONE=+1… [TELNYX_MESSAGING_PROFILE_ID=…] --project-ref gldxvazsoqxyfuxeursn`
      (`CLINIC_ALERT_PHONE` = the clinic closer's number. The `from` number must be SMS-enabled on Telnyx.)
- [x] **Live booking (the big differentiator).** This is your plan from `implementation_plan.md`:
      add Vapi tools `checkCalendarAvailability` + `bookAppointment`, a `appointments` table, route `tool-calls` in the Edge Function, and **restore the booking close** in `system_prompt.txt` (it was reverted to qualify+capture because the tools didn't exist yet — Sofía was told to confirm bookings that couldn't happen). Re-add it once the tools are real, and make the confirmation contingent on the tool's actual result.
- [ ] **WhatsApp follow-up** — only if you want it back; if so, build it (fires from the Edge Function via a provider) and re-add the marketing claim. Otherwise leave it as the SMS alert.
- [ ] **Model eval:** assistant runs `gpt-4o-mini`. Confirm it handles Spanglish + objection-handling well enough for a premium product, or upgrade.
- [x] **Fix stale docs:** `database/supabase_schema.sql` no longer matches the live `leads` table; `CLAUDE.md` references `fable5_bajadentalai_prd.md` which does not exist.
- [x] **Conversion mechanics:** landing CTA is a `mailto:` only — add a booking link (Calendly) and/or Stripe payment link.
- [x] **Tests** for the Edge Function (the only real logic) — a couple of payload tests to protect it from edit churn.
- [x] **Deploy the site:** confirmed Cloudflare Pages source is `bajadental_site/` (push deploys). No build step needed since it uses Tailwind CDN. Softened copy shipped.
- [ ] *(Optional)* git history scrub of old n8n/Twilio refs.

### Owner: USER (do not do)
- [x] ~~Image compression~~ — the 6.4 MB favicon / 5.4 MB logo. **User is handling this.** Skip.

---

## 4. Hard constraints (from CLAUDE.md — non-negotiable)
- **No medical advice.** Pain/bleeding/swelling/infection → emergency human handoff (already wired in the persona). Keep it.
- **Webhook never crashes** — always return 200 (already done).
- **Never hardcode keys** — use `.env` / Supabase secrets. (`vapi_config/telnyx_sip_setup.sh` was refactored to source `.env`.)
- `enterprise_leads` holds health-adjacent PII — **keep RLS enabled**.
