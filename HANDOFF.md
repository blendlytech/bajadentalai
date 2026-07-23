# Handoff → Gemini (BajaDentalAI)

Owner of this doc: handed off from Claude. Read the **Orientation** and
**Don't redo / don't break** sections before writing any code. Then pick up the
**TODO** list.

**§0 is the running checkpoint (newest status first) — read it before the older
backlog in §3.**

---

## 0. Latest checkpoint — running log (newest first)

### 2026-07-23 (latest) — Sales packet drafted: contract, LFPDPPP annex, receipt, rep authorization, intake

Closes "**No contract exists**" — confirmed by search, not memory: there were zero
contract/agreement/convenio/receipt files in the repo. The only sale artifact was
`invoice-es.html` with `INV-2026-001` hardcoded for every clinic. New directory
**`legal/`**, print-ready HTML (screen-only instruction boxes are `@media print` hidden):

| File | Purpose |
| :-- | :-- |
| `contrato-de-servicio.html` | Services Agreement / order form, ES operative + EN courtesy |
| `anexo-a-datos-personales.html` | Annex A — LFPDPPP controller–processor (clinic = *responsable*, us = *encargado*) |
| `cuestionario-de-alta.html` | Onboarding questionnaire — fills the KB |
| `recibo-de-pago.html` | Numbered receipt, original + provider copy on one sheet |
| `carta-autorizacion-representante.html` | Authorizes a non-owner rep to sign and collect cash |

Signing order: contract → Annex A → receipt (if paying) → questionnaire.

**The design decision worth keeping: clause 3 is a "what this does NOT do" list**, and the
Client initials it. Every denial was verified against the code rather than the marketing
copy — no calendar/booking (`AVAILABILITY_UNKNOWN` + `status:'requested'`), no medical
advice, no credential claims the clinic didn't supply, no CRM/dashboard, no WhatsApp, and
SMS on urgent-or-border-concern calls only. That last one **caught a drafting error in my
own first pass**: I wrote "urgent only", but the code fires on
`emergency || anxious`, so clause 2.5 now states both cases and 3.6 cross-references it.
Clause 2.8 words reminder calls as "activated during implementation", never as running.

**The questionnaire is the technical unlock.** Each field is tagged with the exact
placeholder from `docs/dental_tourism_knowledge_base.txt`; **18/18 verified covered**
(re-check command is in `legal/README.md`). Without it the purged KB answers almost
nothing, since every unfilled placeholder routes to "a coordinator will confirm". It also
carries the veracity declaration that makes contract clause 7 enforceable.

Commercial terms taken from `terminos.html`, not invented: $499 setup (FUNDADOR waives) +
$499/mo, annual = 10 months prepaid, **800 minutes included, $0.22/min overage**, Zelle or
cash USD, cancel by email effective end of period. No-CFDI notice appears in the contract
**and printed on the receipt** — that is where a contador looks.

⚠️ **Two items need the lawyer, both flagged in `legal/README.md`:**

1. **Governing law.** The contract mirrors `terminos.html` clause 12 (Mexican law,
   Mexicali courts) while the seller is a US sole proprietor. Memory recorded this
   contradiction as resolved; **it is only half-resolved** — the entity language was
   fixed to "US sole proprietor" everywhere, but the *jurisdiction* clause still points
   at Mexico. `terminos.html`, `aviso-de-privacidad.html` and the contract currently
   agree with each other, so they must be changed together or not at all.
2. **Sensitive data.** Annex A treats volunteered symptom mentions as potentially
   sensitive under art. 3(VI) LFPDPPP (the system never solicits them, but transcripts
   capture them). Confirm the consent language and the US-transfer disclosure.

These are drafts for review, not legal advice — stated on every document.

### 2026-07-23 (latest) — Everything repo-only is now LIVE; Vapi was worse than documented

The repo had been ahead of production in three places for two sessions. All three
are closed. **`vapi-webhook` v8, `reminder-dispatch` v2** (were v7/v1), verified by
smoke test — `reminder-dispatch` now returns `503 cron_secret_not_configured`,
which is the fail-closed gate that only exists in the new build.

**The `requested` vs `confirmed` trap is fixed** (flagged in the entry below).
Migration `20260723080122_appointments_requested_status` — applied live and
mirrored in the repo: `status` CHECK now accepts `'requested'`, `DEFAULT` moved
`'confirmed'` → `'requested'`, and the column is `NOT NULL` (a NULL status would
sit outside every filter). The table was **empty (0 rows)**, so there was no
backfill ambiguity. `bookAppointment` now writes `status: 'requested'` explicitly
rather than leaning on the default, and `reminder-dispatch`'s `status='confirmed'`
filter is commented as load-bearing. **Reminders can no longer call a patient
about an appointment no human confirmed.**

**Vapi was in worse shape than any doc claimed.** Fetching the live account
turned up three things nothing had recorded:

1. **No tools existed in the Vapi account at all** — not detached, *never
   created*. `system_prompt.txt:39` orders Sofía to call `bookAppointment`, so
   she was being told to invoke a tool she did not have. The booking path in the
   webhook was unreachable in production. Both tools created from
   `tools_schema.json` and attached.
2. **The live KB was still the pre-purge file** (7124 b vs the repo's 5752 b) —
   i.e. "entirely painless", "identical to those used in the US", Beverly Hills
   comparisons were all still retrievable on every patient call. Purged KB
   uploaded (`39946922-…`) and the assistant repointed. ⚠️ The old file
   `ea0b6854-56b2-4686-b8ec-851d59391d5d` is **still in the Vapi account** — not
   deleted, since that is irreversible. Delete it so it cannot be reattached.
3. **The B2B assistant was fully disconnected**: no `server.url`, no
   `serverMessages`, no `structuredDataPlan`, no `campaign_type` metadata, and
   the old 2908-char overclaiming prompt. The webhook's entire `b2b_agency`
   branch could never fire — **every B2B lead was being dropped silently.** All
   four wired; prompt now byte-identical to `b2b_system_prompt.txt`.

The live persona had been serving `board-certified`, `VIP`, `shuttle` and
"experiencing pain" right up until this push. **All three** assistants (Sofía
inbound, Mateo B2B, Sofía–Recordatorios) now match the repo — verified by
re-fetching and comparing, not by trusting the write. 11/11 checks pass.

**`vapi_config/push_assistants.js` added** so this is never a manual step again —
idempotent (tools looked up by name, KB deduped by name+size), and it covers all
three assistants so none can drift unnoticed. It documents two traps found the
hard way: **`PATCH /assistant` REPLACES the whole `model` object rather than
merging** — a partial `{model:{knowledgeBase:…}}` patch wiped the system prompt
and tool attachments mid-session (caught by the verify step and restored) — and
Vapi returns `bytes` as a **string**, so a `===` size compare silently re-uploads
the KB every run.

The new `'requested'` state was verified against the live DB, not just deployed:
a bogus status is rejected by the CHECK, an omitted status defaults to
`'requested'`, and a NULL status is rejected by NOT NULL (probe rows cleaned up,
table back to 0).

Two notes for whoever extends this. **Migrations:** the repo file must stay
byte-identical to `schema_migrations` — I first shipped this one with an
explanatory header, which silently breaks the MD5 check `supabase/migrations/README.md`
tells you to re-run. Header stripped, rationale moved into that README's
provenance table; MD5 now matches (`12ffaf84…`, 471 b). **Comparing Vapi config:**
Vapi reorders JSON object keys on storage, so compare structured-data schemas
with an order-insensitive deep-equal — a `JSON.stringify` compare reports false
drift.

Also fixed: the staff SMS in `vapi-webhook` still told the human closer to "walk
them through the **VIP shuttle** and clinic safety" — the same claim the persona
purge removed, surviving one layer down in the brief the closer reads from.

**Still blocked on the owner (unchanged, all launch-gated):**

- **No phone numbers are registered in Vapi at all.** This is the single blocker
  for both directions: nothing routes inbound to Sofía, and
  `VAPI_OUTBOUND_PHONE_NUMBER_ID` cannot be set, so reminders stay dark.
- Secrets still unset: `CRON_SECRET` (value is in memory), `CLINIC_ALERT_PHONE`,
  `TELNYX_*` → emergency + hot-lead SMS remain inert, reminder loop 503s.
- Key rotation (Tier 1) still outstanding.

### 2026-07-23 — B2B pitch tightened to what the product actually does today

Closes the "**The B2B pitch now overclaims**" flag raised in the entry below. Chose
**align the pitch**, not build the calendar.

Ground truth was re-derived from the code, not the docs — `vapi-webhook/index.ts`,
`reminder-dispatch/index.ts`, `system_prompt.txt`, the migrations, and `.env`:

| Claim | Reality |
| :-- | :-- |
| 24/7 bilingual inbound answering | ✅ live |
| Qualification + transcript + recording + per-clinic isolation | ✅ live |
| Emergency stop → human handoff | ✅ live (in persona) |
| Appointment **booking** | ❌ **request only** — `checkCalendarAvailability` returns `AVAILABILITY_UNKNOWN`; no calendar exists |
| "drops the lead in your CRM" | ❌ no CRM integration, and no clinic-facing dashboard (`clinic_staff` RLS has no policy) |
| "texts your closer instantly" on every lead | ⚠️ built but **inert** (`CLINIC_ALERT_PHONE` unset) **and** only fires on emergency-or-border-anxiety, never on every lead |
| AI reminder calls | ⚠️ built + deployed, **not running** (no `VAPI_OUTBOUND_PHONE_NUMBER_ID`, `CRON_SECRET` unset → fails closed 503) |
| "sub-800ms latency", "patients can't tell it's AI" | ❌ unmeasured / unsubstantiated |

**`vapi_config/b2b_system_prompt.txt` rewritten.** The structural fix is that Mateo now
has an explicit **capability ban list** — the same shape as the medical-claim bans in
`system_prompt.txt`. That's why the pitch drifted: there was nothing telling the AE what
it may not say. Claims are now sorted into **LIVE TODAY** / **ACTIVATED DURING SETUP**
("we switch it on when we connect your number" — never "it's already running") /
**ROADMAP** / **NEVER CLAIM**. Dropped: CRM, dashboard, WhatsApp, latency figures,
"patients can't tell", ROI-as-fact, and "compliant"/certification claims (it now
*describes* consent + isolation + no-medical-advice instead of asserting a seal).

The calendar gap is reframed as the selling point rather than hidden: *"the AI doesn't
touch your calendar, and that's deliberate — I'm not going to let an AI double-book your
chair."* Capture fields in the close still match `b2b_structured_schema.json` exactly
(`owner_name`, `clinic_name`, `phone_number`, `current_reception_pain`,
`pilot_appointment` ∈ morning/afternoon/not_booked).

**Marketing site (`bajadental_site/index.html`) — same overclaims, fixed in ES + EN**
(inline copy *and* both i18n dicts): "agenda"/"books" → takes an appointment request;
"Alerta SMS instantánea de **cada lead**" → SMS on **urgent** calls; "tu agenda empieza a
llenarse sola" → "empiezas a recibir pacientes calificados"; website "para que te
encuentren y agenden" → "y te llamen". Verified: I18N parses, **98 ES / 98 EN keys, zero
parity gaps**. Left alone deliberately: "llenar la agenda" (hero) and "Agenda una llamada"
(CTA) — outcome copy and an imperative, not capability claims.

⚠️ **Not fixed — new finding, affects the reminder claim.** `appointments.status` is
`DEFAULT 'confirmed'` (`20260723033033_appointments.sql:12`), and `reminder-dispatch`
selects `status='confirmed'`. So an AI-captured *request* — which the patient was
explicitly told is **not** confirmed — is indistinguishable from a clinic-confirmed
appointment. Once the reminder secrets are set, reminder calls will go out on
appointments no human ever confirmed. Fix before activating reminders: default new
tool-inserted rows to a `requested` state and have the clinic promote them.

⚠️ **Still repo-only.** `b2b_system_prompt.txt` is not pushed to the B2B Vapi assistant;
the site change needs a deploy (push to `main` → Cloudflare Pages).

### 2026-07-22 (latest+1) — Edge Function deep dive: 8 real bugs found & fixed in repo

⚠️ **THESE FIXES ARE NOT DEPLOYED.** Live is still `vapi-webhook` v7 / `reminder-dispatch`
v1 — i.e. **the bugs below are live right now.** Redeploy both (keep
`verify_jwt=false`; pass `import_map_path: "deno.json"` if using MCP) before selling.

**Booking was broken end-to-end. The three worst:**

1. **Every AI-booked appointment was invisible to the clinic.** The `bookAppointment`
   branch read `payload.call`, but Vapi nests the call under `message` (which is why
   `msg.toolCalls` two lines above worked). So `clinic_id` **and** `call_id` were
   always `null`. With `clinic_id` NULL the per-clinic RLS policy
   (`clinic_id IN (...)`) can never match → **the clinic could never see the booking**,
   and `reminder-dispatch` couldn't attribute it. Fixed + regression test.
2. **The AI invented appointment slots.** `checkCalendarAvailability` returned the
   hard-coded string *"Available slots: Tomorrow at 10:00 AM and 2:00 PM."* to every
   caller, always. There is no calendar integration. Now returns an explicit
   `AVAILABILITY_UNKNOWN` instruction telling the model to ask the patient's
   preference and never imply a slot is open.
3. **Patients were told their appointment was confirmed when it wasn't.**
   `vapi_config/tools_schema.json` set a Vapi `request-complete` message
   *"¡Listo! Tu cita ha sido confirmada."* — Vapi speaks that automatically on tool
   success, silently overriding the persona rule at `system_prompt.txt:40` ("NEVER
   tell the patient they are officially booked or confirmed"). Removed the
   `request-complete` messages so the persona phrases it truthfully and bilingually;
   rewrote both tool descriptions to say "request", not "book".

**Also fixed:** `appointment_date_time` missing/unparseable silently booked the
appointment at *the moment of the call* (`?? new Date()`), now rejected; an unhandled
tool name returned no result for its `toolCallId` (stalls the assistant mid-call), now
always answered; `leads` upserted `onConflict:"call_id"` with a possibly-NULL
`call_id` (NULL never conflicts → duplicate leads on Vapi retry), now guarded;
`agency_leads.call_id` is NOT NULL but a null was insertable → insert throws and the
B2B lead is lost, now guarded so the SMS alert still fires; the reminder branch
computed `reminder_status = "cancelled"`, which the CHECK constraint rejects (it was
overwritten before use, but any reorder would have silently dropped call outcomes).

**Security:** `reminder-dispatch`'s `CRON_SECRET` gate was **optional** — unset meant
*no auth at all* on an endpoint that places real outbound calls (cost + patient
harassment vector). Now **fails closed** with 503 until the secret is set.

**Tests were fake.** The old `index.test.ts` re-implemented the logic inline
("simulating the logic block from index.ts") and never imported the handler — it
passed even when `index.ts` was wrong. Pure logic extracted to
`supabase/functions/vapi-webhook/logic.ts`; **11 real tests** now import and exercise
it, including a regression test for bug 1 and a property test that
`reminderStatusFor` can never return a value the CHECK constraint rejects.
All three functions `deno check` clean.

**NOT fixed — needs your decision, blocks a truthful sale:**

- ~~**No real calendar integration.**~~ **Pitch side RESOLVED 2026-07-23** (see top
  entry): the pitch now says "capture the request, your team confirms". There is still
  no calendar integration — that's now a deliberate, disclosed product boundary rather
  than a gap between the pitch and the build.
- **Emergency alerts are inert.** `CLINIC_ALERT_PHONE`/`TELNYX_*` are unset, so an
  `emergency_flag` call currently produces only a `console.warn`. CLAUDE.md requires a
  human handoff. Set the secrets before taking live patient calls.
- **`web-lead` has no rate limiting** (the header comment claims "basic rate cues";
  there are none). A public endpoint — consider Turnstile or a per-IP cap.

**Marketing-site pass (same session):**

- ✅ Contact form ↔ `web-lead` contract **verified field-by-field** (`name`,
  `clinic_name`, `whatsapp`, `email`, `plan_interest`, `website` honeypot) — they
  match. `web_leads.message` is simply unused; the form has no message field.
- ✅ **Fixed a pricing-disclosure gap.** The site showed `$8,900 MXN` (banner and the
  MXN toggle) while `terminos.html` says prices are "displayed and charged in USD"
  at `$499`, and `main.js` deliberately never converts between them. There was **no
  FX/billing-currency disclaimer anywhere** (grep-confirmed), so a clinic toggling to
  MXN could reasonably expect to pay pesos. Added a `billing_currency_note` line
  (ES + EN) under the price: we bill in USD, MXN is indicative and moves with FX.
  This also protects the LOCKED US-only/no-factura posture.
**Medical-claim purge (same session) — this was worse than it looked:**

The KB placeholders were only half the problem. `vapi_config/system_prompt.txt` — the
persona **live on the assistant right now** — literally instructed Sofía to "Reassure
them about your clinic's **board-certified specialists** and VIP border transportation."
That is an unconditional order to assert a credential and a service for *every* clinic,
true or not. A KB is a retrieval source; the system prompt is a command. Fixed:

- Removed the board-certified / VIP-transport assertion; replaced with explicit bans on
  stating any credential, certification, accreditation, training or safety standard —
  and on promising transport, shuttles, fast-passes or warranties — unless that exact
  claim is in **that clinic's** KB. Gaps go to a coordinator, never get filled in.
- Removed the symptom probe. Discovery said `"Have you been experiencing pain?"`, which
  solicits clinical detail as a sales lever and invites exactly the conversation the
  guardrail forbids. Now non-clinical, and points at the emergency-handoff rule.
- Stopped the assistant characterizing area safety, and removed the "VIP shuttle" from
  the hand-off script (it contradicted the new rule two lines above).

**`docs/dental_tourism_knowledge_base.txt` rewritten.** It carried hard claims *outside*
the brackets that the AI would say verbatim to every caller: "identical to those used in
the United States and Canada", "the Zona Médica is highly secure", "the exact same
high-end brands used in Beverly Hills", "predatory malpractice insurance", US price
comparisons as fact, "can easily last 15 to 20 years" — plus two straight guardrail
violations, "the procedure is entirely painless" (root canals) and "a very common,
painless procedure" (bone grafts). All removed; clinical questions now route to the
dentist and unverified details to a coordinator. Placeholders no longer carry `e.g.`
example claims at all, so there is nothing left for an LLM to paraphrase as fact.

The fill instructions moved to a **separate** file, `docs/knowledge_base_onboarding.md`,
which is NOT uploaded to Vapi — keep it that way, since anything in the KB can be spoken
to a patient. ("OSHA" was doubly wrong, incidentally: it's a US *workplace* regulator
that does not certify Mexican dental clinics.)

⚠️ **Both are repo-only.** The live assistant still has the old persona and old KB.
Re-push `system_prompt.txt`, `tools_schema.json`, and the KB before the next patient call.

- ⚠️ ~~**KB placeholder leak risk (not fixed — onboarding process issue).**~~ **FIXED —
  see above.** Original finding retained for context:
  `docs/dental_tourism_knowledge_base.txt` is correctly templated
  (`[CLINIC_NAME]`, `[CREDENTIALS, …]`) rather than asserting claims — but the
  placeholders embed *plausible example claims* ("e.g., board-certified",
  "e.g., OSHA-level sterilization", "e.g., a 5-year guarantee"). An LLM handed that
  file can paraphrase the **example** to a patient as fact. For a medical product
  that is a real liability. Either strip the `e.g.` examples or make filling every
  placeholder a hard gate in onboarding.
- ⚠️ ~~**The B2B pitch now overclaims.**~~ **RESOLVED 2026-07-23 — see the top entry.**
  Pitch aligned (not the integration built): `b2b_system_prompt.txt` and the site now
  sell an appointment *request*, and the AE has an explicit capability ban list.

### 2026-07-22 (latest) — Migration history reconciled + live security hardening

Closed the gap this doc flagged at the bottom of the 2026-07-22 reminder-loop entry:
the repo had **no `supabase/migrations/` directory at all**, so nothing in git
reproduced the live schema.

- **Live tracking table was already complete** for 6 migrations
  (`add_source_to_leads`, `create_enterprise_leads`, `tenant_isolation`,
  `appointments`, `appointments_reminders`, `web_leads`) — they'd been applied via
  MCP `apply_migration`, which records them. The DB side needed no repair; only the
  repo files were missing.
- **Mirrored those 6 byte-for-byte** from `supabase_migrations.schema_migrations`
  and **verified by MD5** (trailing-newline normalised) — all six match exactly.
  Left unmodified (no added headers) so the diff stays re-runnable.
  *(Counts in this bullet are as-of that moment. Two further migrations were applied
  later in the session — see below — so the directory ends at **9 files: the
  baseline plus 8 mirrored**.)*
- **Added `20260609000000_baseline_leads_agency.sql`** — reconstructed from live
  introspection for the objects that predate tracking: `leads` + the enum types
  `procedure_interest_enum`/`language_enum`, `agency_leads`, and the live-only
  `service_role_all` policy on `leads`. Without it a fresh push fails (the
  `add_source` migration ALTERs a table that wouldn't exist).
- Replay of baseline + the tracked migrations reproduces live **exactly —
  empirically verified, zero differences.** The chain was replayed into a throwaway
  schema on the live instance and diffed against `public` across columns (name,
  ordinal, type, nullability, default), indexes, constraints, policies (name, cmd,
  roles, USING, WITH CHECK) and RLS flags; the scratch schema was then dropped
  (0 objects left). Procedure is documented in `supabase/migrations/README.md`
  → "Verifying the replay" so it's repeatable. No Docker/psql on this box and a
  Supabase branch bills, so this was the free equivalent of `supabase db reset`.
  It validates the resulting *shape*, not Supabase's migration runner itself.

  Scope correction (caught on a later re-check of my own claim): that automated diff
  did **not** cover comments, grants, or database-level objects. Checked by hand
  instead — comments match (2 of them, both from migrations); table grants are
  uniform Supabase defaults needing no migration; but the event trigger
  **`ensure_rls`** (→ `public.rls_auto_enable()`) is live and **deliberately not in
  the migrations** (needs elevated privileges, and isn't load-bearing since every
  migration enables RLS explicitly). A fresh rebuild won't have it. Documented in
  `supabase/migrations/README.md` → "Live objects deliberately outside this history".

  ⚠️ Worth internalising: `anon` and `authenticated` hold **full table grants**
  (`arwdDxtm`) on all seven tables — that's the Supabase default. **RLS is the only
  thing keeping them out.** Never add a table here without a policy.

**Review caught a defect in the first cut:** the baseline **omitted the two `leads`
indexes** (`leads_created_at_idx`, `leads_clinic_name_idx`) — they exist live but are
created by no tracked migration, so mirroring the tracking table alone missed them.
Fixed. Lesson for anyone extending this: diff `pg_indexes` + `pg_constraint` against
live, don't trust `schema_migrations` to be complete.

**Also fixed this session (real problems, not cosmetics):**

1. **`supabase/config.toml` would have broken production on the next CLI deploy.**
   It declared `verify_jwt = true` for `vapi-webhook` (live is `false`) and omitted
   `reminder-dispatch` and `web-lead` entirely. A `supabase functions deploy` would
   have 401'd every call — silently killing lead ingestion, the reminder loop, and
   the web contact form. All three now explicitly `verify_jwt = false`, matching live.
2. **`agency_leads` was readable/writable by any signed-in user**
   (`FOR ALL TO authenticated USING(true) WITH CHECK(true)`). Once clinic staff get
   accounts, that exposes the founder's B2B pipeline to customers. Only `vapi-webhook`
   touches the table, via the service-role key (bypasses RLS), so the policy was
   dropped — same posture as `web_leads`.
3. **`public.rls_auto_enable()`** was a `SECURITY DEFINER` function executable by
   `anon`/`authenticated` via `/rest/v1/rpc/`. `EXECUTE` revoked; it's an event-trigger
   function, so its real job is unaffected.

Items 2–3 of that list were applied live as tracked migration `20260723055430_harden_agency_leads_and_rls_fn`
and mirrored into the repo. **These changed the production database** (schema/grants
only — no data touched, and `service_role` kept `EXECUTE` throughout, so ingestion was
never interrupted). Copy-paste rollback SQL for both is in
`supabase/migrations/README.md` → "Rolling back the hardening migration".

**Security advisors: 4 WARN → 1 WARN.** (An earlier draft of this entry said
"zero WARN, was 3" — both numbers were wrong; corrected here.) Fixed: the permissive
`agency_leads` policy and both `SECURITY DEFINER` RPC exposures. The 1 remaining WARN
is `pg_net` in the `public` schema, deliberately accepted (see below). 3 INFO remain
(`rls_enabled_no_policy` on `agency_leads`, `clinic_staff`, `web_leads`) — all
intentional service-role-only tables.

**Second audit pass — more real findings, all fixed:**

1. **Tenant-isolation read path was unindexed and re-evaluating auth per row.**
   All four per-clinic RLS policies filter on `clinic_id`, but **no `clinic_id`
   column had a covering index** (4× advisor `0001_unindexed_foreign_keys`), and each
   policy called bare `auth.uid()`, which Postgres re-evaluates **for every row**
   (4× WARN `0003_auth_rls_initplan`). Fixed in tracked migration
   `20260723060504_tenant_rls_performance`: added `clinic_id` indexes on `leads`,
   `enterprise_leads`, `appointments`, `clinic_staff`, and rewrote all four policies
   to `(select auth.uid())` so it's hoisted to an InitPlan. Identical semantics.
   **Performance advisors: 4 WARN → 0.**
2. **`database/*.sql` contained two live security landmines.**
   `enterprise_leads_schema.sql` and `agency_leads_schema.sql` each
   `CREATE POLICY ... USING(true) WITH CHECK(true)` for `authenticated`. Postgres ORs
   permissive policies, so running either against live would add blanket access
   *next to* the per-clinic policy and **silently defeat multi-tenancy** — on
   `enterprise_leads` that's the health-PII table. Their `CREATE TABLE IF NOT EXISTS`
   headers make them look re-runnable; the guard covers the table, not the policy.
   Added `database/README.md` + ⛔ in-file headers on both.
3. **`supabase/seed.sql` was missing** while `config.toml` had `[db.seed]
   enabled = true` with `sql_paths = ["./seed.sql"]` pointing at it. (Not verified to
   hard-fail `db reset` — the CLI may just warn and skip — so this is removing an
   ambiguity in the fresh-project rebuild, not fixing a proven breakage.) Created,
   with the clinic-onboarding insert template commented out: seeding a placeholder
   clinic would attach real inbound leads to a fake tenant.

Replay verification was **re-run after these changes — still zero differences.**

**Deliberately NOT fixed (both justified):**

- `pg_net` sits in the `public` schema (advisor WARN `0014_extension_in_public`). The
  `reminder-dispatch-20min` cron job calls `net.http_post`; moving the extension risks
  breaking the reminder loop for a lint-level warning. Revisit only with a tested
  cron rebuild.
- `unused_index` INFO on every **non-constraint** index (PK/unique indexes aren't
  flagged). All tables hold **zero rows**, so nothing has been used *yet*. Do not drop
  indexes on this signal until there's real traffic to judge against.

Non-finding worth recording so nobody re-chases it: `list_tables` reported
`web_leads` as having 1 row, but that's a stale planner estimate (`reltuples`) —
`select count(*)` returns **0**. The earlier "test rows deleted" note was accurate.

✅ **`supabase db push` footgun — FOUND, then FIXED (not just documented).**

The hazard: the baseline originally recreated the two pre-tenancy permissive policies
(on `leads` and `agency_leads`) for historical faithfulness. The migrations that drop
them were *already recorded as applied*, but the baseline was *not* — so `db push`
against live would have applied only the baseline, recreated both permissive policies,
and had nothing left to drop them. That **silently re-opens cross-tenant lead reads
and re-exposes the B2B pipeline.**

Fixed two independent ways:

1. **The baseline no longer creates any permissive policy.** The later migrations drop
   them with `DROP POLICY IF EXISTS`, so omitting them is end-state identical on a
   fresh replay (re-verified: zero diff) while making the file incapable of weakening
   RLS anywhere. The only policy it still creates is the `service_role` one.
2. **The baseline is now registered** in `supabase_migrations.schema_migrations`, so
   `db push` skips it.

Fix 1 is load-bearing — even if the tracking row were lost, the file can no longer
cause a regression. All **nine** files now hash-match the tracking table, so repo and
DB are fully consistent, and `supabase db push` is a safe no-op against live.

> Invariant to preserve if anyone edits the baseline: it must create **no policy
> granting anything to `anon` or `authenticated`.**

Also: **`database/supabase_schema.sql` marked SUPERSEDED / DO NOT APPLY** — it had
drifted from production (TEXT CHECK vs real enums, UTC `created_at` default, NOT NULL
`call_id`, missing `clinic_name`/`notes`). `supabase/migrations/` is now canonical.
Full notes in `supabase/migrations/README.md`. pg_cron/pg_net + the reminder job stay
out of migrations on purpose (the job command embeds `CRON_SECRET`).

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
~~Pre-existing advisor warnings (not from this work): `agency_leads` permissive
`USING(true)` policy; `public.rls_auto_enable()` is `SECURITY DEFINER` callable
by anon/authenticated.~~ **Both FIXED** — see the 2026-07-22 (latest) entry above.

> ~~The repo's `supabase/migrations` history is **not** updated to match these
> ad-hoc live migrations.~~ **RESOLVED** in the 2026-07-22 (latest) entry above —
> `supabase/migrations/` now exists and reproduces the live schema.

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
| Schema history | **`supabase/migrations/`** — canonical; reproduces live. See its `README.md` (incl. the baseline footgun). |
| DB schemas | `database/*.sql` = historical scratch files. `database/supabase_schema.sql` is marked **SUPERSEDED / DO NOT APPLY** (drifted from live). |
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
