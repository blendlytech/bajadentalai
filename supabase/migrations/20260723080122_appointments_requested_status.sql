-- Distinguish an AI-captured appointment REQUEST from a clinic-CONFIRMED appointment.
--
-- Why: `bookAppointment` (vapi-webhook) records what the patient asked for, and the
-- persona explicitly tells the patient it is NOT confirmed until a coordinator calls
-- back. But `status` defaulted to 'confirmed', so those rows were indistinguishable
-- from appointments a human had actually confirmed — and `reminder-dispatch` selects
-- `status = 'confirmed'`, so once the reminder secrets are set, outbound reminder
-- calls would have gone out on appointments nobody ever confirmed.
--
-- After this migration: the AI writes 'requested', the clinic promotes it to
-- 'confirmed', and only 'confirmed' rows are ever eligible for a reminder call.
--
-- Idempotent: safe to re-run.

ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_status_check
    CHECK (status IN ('requested', 'confirmed', 'cancelled', 'completed'));

ALTER TABLE public.appointments
    ALTER COLUMN status SET DEFAULT 'requested';

-- A NULL status is not a meaningful state and would silently sit outside every
-- status filter. The default covers all inserts, so pin it closed.
UPDATE public.appointments SET status = 'requested' WHERE status IS NULL;

ALTER TABLE public.appointments
    ALTER COLUMN status SET NOT NULL;
