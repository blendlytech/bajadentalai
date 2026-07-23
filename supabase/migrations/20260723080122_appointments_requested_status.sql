ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_status_check
    CHECK (status IN ('requested', 'confirmed', 'cancelled', 'completed'));

ALTER TABLE public.appointments
    ALTER COLUMN status SET DEFAULT 'requested';

UPDATE public.appointments SET status = 'requested' WHERE status IS NULL;

ALTER TABLE public.appointments
    ALTER COLUMN status SET NOT NULL;
