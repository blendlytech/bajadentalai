-- Supabase Schema for Baja Dental AI CRM
--
-- ⚠️ SUPERSEDED / DO NOT APPLY. Kept for historical reference only.
-- The canonical schema history now lives in `supabase/migrations/`.
--
-- This file DRIFTED from production and no longer describes the live `leads`
-- table. Verified against project gldxvazsoqxyfuxeursn on 2026-07-22:
--   * live `procedure_interest` / `language_spoken` are real ENUM types
--     (procedure_interest_enum / language_enum), NOT the TEXT CHECK shown below
--   * live `created_at` defaults to now(), not timezone('utc', now())
--   * live `call_id` is NULLABLE (unique), not NOT NULL
--   * live also has `clinic_name` and `notes` columns, missing here
--   * live `clinic_id` FK has no ON DELETE CASCADE
-- See supabase/migrations/README.md.

-- Base leads table (receives standard inbound calls)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    call_id TEXT UNIQUE NOT NULL,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_name TEXT,
    phone_number TEXT,
    procedure_interest TEXT CHECK (procedure_interest IN ('veneers', 'implants', 'whitening', 'all_on_4', 'crowns', 'other')),
    language_spoken TEXT CHECK (language_spoken IN ('english', 'spanish', 'bilingual')),
    summary TEXT,
    transcript TEXT,
    recording_url TEXT,
    source TEXT,
    status TEXT DEFAULT 'new'
);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Policy for tenant isolation (relies on clinic_staff mapping)
CREATE POLICY "Staff access own clinic leads" ON public.leads
    FOR ALL
    USING (clinic_id IN (SELECT clinic_id FROM public.clinic_staff WHERE user_id = auth.uid()));
