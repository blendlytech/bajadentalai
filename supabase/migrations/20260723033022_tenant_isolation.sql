-- Multi-tenant base: clinics + clinic_staff, clinic_id on leads tables, strict RLS.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.clinics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.clinic_staff (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
    UNIQUE(user_id, clinic_id)
);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id);
ALTER TABLE public.enterprise_leads ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id);

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view their clinics" ON public.clinics;
CREATE POLICY "Staff view their clinics" ON public.clinics
    FOR SELECT USING (id IN (SELECT clinic_id FROM public.clinic_staff WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Allow authenticated access" ON public.leads;
DROP POLICY IF EXISTS "Staff access own clinic leads" ON public.leads;
CREATE POLICY "Staff access own clinic leads" ON public.leads
    FOR ALL USING (clinic_id IN (SELECT clinic_id FROM public.clinic_staff WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Allow authenticated access" ON public.enterprise_leads;
DROP POLICY IF EXISTS "Staff access own clinic enterprise leads" ON public.enterprise_leads;
CREATE POLICY "Staff access own clinic enterprise leads" ON public.enterprise_leads
    FOR ALL USING (clinic_id IN (SELECT clinic_id FROM public.clinic_staff WHERE user_id = auth.uid()));
