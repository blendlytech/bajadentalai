-- Supabase Schema for Baja Dental AI — Enterprise CRM tier
--
-- ⛔ SUPERSEDED — DO NOT RUN THIS FILE. See ../supabase/migrations/ (canonical)
--    and this directory's README.md.
--
--    DANGER: the CREATE POLICY at the bottom grants `authenticated` USING(true)
--    WITH CHECK(true). Postgres ORs permissive policies together, so running this
--    against the live DB re-adds blanket access ALONGSIDE the per-clinic policy —
--    letting ANY signed-in user read EVERY clinic's rows. This table holds
--    health-adjacent PII (pain points, transcripts, recording URLs).
--    The `CREATE TABLE IF NOT EXISTS` guard does NOT protect the policy.
--    Live equivalent: migrations 20260615224801 + 20260723033022 + 20260723060504.
--
-- (original header follows)
-- Stores the richer qualification profile captured by the Vapi assistant.
-- Run this in the Supabase SQL editor.
--
-- NOTE: This table holds health-adjacent PII (procedure interest, pain points,
-- and links to call recordings/transcripts). Row Level Security is kept ENABLED
-- to match the base `leads` table — do not ship this table publicly readable.
-- Uses gen_random_uuid() (built-in, pgcrypto) rather than uuid_generate_v4()
-- so no uuid-ossp extension is required.

CREATE TABLE IF NOT EXISTS public.enterprise_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    call_id TEXT UNIQUE NOT NULL,
    patient_name TEXT,
    phone_number TEXT,
    procedure_interest TEXT
        CHECK (procedure_interest IN ('all_on_4', 'veneers', 'implants', 'full_mouth_restoration', 'whitening', 'unknown')),
    urgency_timeline TEXT
        CHECK (urgency_timeline IN ('asap', 'within_30_days', 'within_6_months', 'just_browsing')),
    financial_status TEXT
        CHECK (financial_status IN ('cash_ready', 'needs_financing', 'price_shopping', 'unknown')),
    border_crossing_anxiety BOOLEAN DEFAULT false,
    -- Safety guardrail (see CLAUDE.md): acute symptoms must trigger human
    -- medical handoff, never an automated sales follow-up.
    emergency_flag BOOLEAN DEFAULT false,
    travel_origin TEXT,
    pain_points TEXT,
    competitors_mentioned TEXT,
    language_spoken TEXT
        CHECK (language_spoken IN ('english', 'spanish', 'spanglish')),
    bot_cost_usd NUMERIC(6, 4),          -- Vapi spend per call
    call_duration_minutes NUMERIC(6, 2)
);

-- Indexes for the clinic's sales team to query and triage quickly.
CREATE INDEX IF NOT EXISTS idx_enterprise_procedure ON public.enterprise_leads(procedure_interest);
CREATE INDEX IF NOT EXISTS idx_enterprise_urgency   ON public.enterprise_leads(urgency_timeline);
CREATE INDEX IF NOT EXISTS idx_enterprise_anxiety   ON public.enterprise_leads(border_crossing_anxiety);
CREATE INDEX IF NOT EXISTS idx_enterprise_emergency ON public.enterprise_leads(emergency_flag);

-- Row Level Security: keep parity with the base `leads` table. Sensitive PII
-- must not be world-readable; only authenticated clinic staff may access it.
ALTER TABLE public.enterprise_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access" ON public.enterprise_leads
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
