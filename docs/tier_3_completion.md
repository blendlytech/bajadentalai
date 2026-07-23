# Tier 3 Completion Report: Live Booking & Core Polish

> ⚠️ **Historical / superseded** — predates the current AI-voice architecture
> (single "Consultorio Completo" plan; reminders/win-backs by outbound Vapi
> voice call, not WhatsApp). Kept for history. See `CLAUDE.md` → "Current
> Architecture (AUTHORITATIVE)".

**Objective:** Finalize the revenue-generating features (Live Calendar Booking,
Conversion CTA) and lock down the production architecture.

## 1. Live Calendar Booking (The Differentiator)

* **What was done:** We evolved the AI from a lead-qualifier to a true
  appointment setter. We added the `checkCalendarAvailability` and
  `bookAppointment` tools to Vapi, created the strict multi-tenant `appointments`
  database schema, and built the tool-call interception routing in the Edge Function.
* **Why it was done:** Booking live on the call removes the friction of "we'll call
  you back to schedule." For the MVP, the availability check returns a hardcoded
  "Tomorrow at 10 AM or 2 PM" to guarantee demo success during sales pitches.

## 2. Edge Function Hardening

* **What was done:** Added a `deno test` suite (`index.test.ts`) that asserts the
  webhook correctly routes `tool-calls` vs `end-of-call-report` payloads and skips
  irrelevent pings.
* **Why it was done:** The webhook is the single point of failure for the entire
  system. Automated payload tests protect it from edit-churn and regressions.

## 3. Documentation & Schema Alignment

* **What was done:** Updated `database/supabase_schema.sql` so that it accurately
  reflects the live schema built in Tier 1 and 2. Purged references to the
  non-existent PRD from `CLAUDE.md`.
* **Why it was done:** Stale documentation leads to corrupted migrations later on.
  The architecture is now the single source of truth.

## 4. Deployment Mechanics

* **What was done:** The landing page's passive `mailto:` CTA was replaced with a
  direct Calendly booking link to capture agency sales. Verified that Cloudflare
  Pages should target the raw `bajadental_site/` directory (no build step
  necessary).

## Pending Manual Steps (Ops)

To take the platform fully live, you will need to execute the following operational steps:

1. **Inject Telnyx Secrets:** Run the Supabase CLI command to set `TELNYX_API_KEY`,
   `TELNYX_PHONE_NUMBER`, and `CLINIC_ALERT_PHONE` to activate the SMS alerts.
2. **Model Evaluation:** The assistant is currently running `gpt-4o-mini`. For the
   MVP this is acceptable, but if the Spanglish switching proves too slow or robotic
   during your local testing, it should be bumped to `gpt-4o`.
