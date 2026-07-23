-- =====================================================================
-- Appointment reminder tracking (AI voice reminders — Phase B)
-- =====================================================================
-- Adds the columns the outbound reminder loop needs to the existing
-- public.appointments table (see appointments_schema.sql). Reminders are
-- delivered by outbound AI voice call (Vapi + Telnyx) via the
-- `reminder-dispatch` Edge Function — NOT WhatsApp.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

ALTER TABLE public.appointments
    -- Lifecycle of the 24h reminder call for this appointment:
    --   pending    → not yet attempted (default)
    --   called     → outbound call placed (awaiting outcome)
    --   confirmed  → patient confirmed on the call
    --   reschedule → patient asked to move it (staff alerted by SMS)
    --   failed     → Vapi call could not be placed
    --   skipped    → intentionally not called (e.g. cancelled appt)
    ADD COLUMN IF NOT EXISTS reminder_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS reminder_call_id TEXT,          -- Vapi call id of the reminder call
    ADD COLUMN IF NOT EXISTS reminder_attempted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Constrain reminder_status to the known set (drop-then-add so re-runs are clean).
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_reminder_status_check;
ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_reminder_status_check
    CHECK (reminder_status IN ('pending', 'called', 'confirmed', 'reschedule', 'failed', 'skipped'));

-- The dispatcher scans "due & not yet reminded" rows every ~20 min; index that path.
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_due
    ON public.appointments (appointment_time)
    WHERE reminder_status = 'pending' AND status = 'confirmed';

-- =====================================================================
-- Scheduler (Supabase pg_cron + pg_net) — OPTIONAL, run once, edit first.
-- =====================================================================
-- Requires the pg_cron and pg_net extensions (enable in the Supabase
-- dashboard → Database → Extensions, or uncomment below).
--
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- Then schedule the dispatcher. Replace <PROJECT_REF> and <CRON_SECRET>
-- (CRON_SECRET must match the secret set on the reminder-dispatch function).
--
--   SELECT cron.schedule(
--     'reminder-dispatch-20min',
--     '*/20 * * * *',
--     $$
--       SELECT net.http_post(
--         url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/reminder-dispatch',
--         headers := jsonb_build_object(
--                      'Content-Type', 'application/json',
--                      'x-cron-secret', '<CRON_SECRET>'
--                    ),
--         body    := '{}'::jsonb
--       );
--     $$
--   );
--
-- To remove:  SELECT cron.unschedule('reminder-dispatch-20min');
