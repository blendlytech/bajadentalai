-- Appointment reminder tracking (AI voice reminders - Phase B).
-- Adds the columns the outbound reminder loop needs to public.appointments.
-- Idempotent: safe to re-run.

ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS reminder_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS reminder_call_id TEXT,
    ADD COLUMN IF NOT EXISTS reminder_attempted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_reminder_status_check;
ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_reminder_status_check
    CHECK (reminder_status IN ('pending', 'called', 'confirmed', 'reschedule', 'failed', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_appointments_reminder_due
    ON public.appointments (appointment_time)
    WHERE reminder_status = 'pending' AND status = 'confirmed';
