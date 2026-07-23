-- Appointments table (booked via vapi-webhook bookAppointment tool; read by reminder-dispatch).
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
    call_id TEXT,
    patient_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    appointment_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed'))
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff access own clinic appointments" ON public.appointments;
CREATE POLICY "Staff access own clinic appointments" ON public.appointments
    FOR ALL USING (clinic_id IN (SELECT clinic_id FROM public.clinic_staff WHERE user_id = auth.uid()));
