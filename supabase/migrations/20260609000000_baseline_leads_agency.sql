-- Baseline: the pre-migration-tracking schema.
--
-- RECONSTRUCTED (2026-07-22) by introspecting the live DB (project gldxvazsoqxyfuxeursn).
-- `public.leads` (+ its enum types) and `public.agency_leads` were created before
-- migration tracking began, so no recorded migration exists for them. Without this
-- file the tracked migrations below cannot replay on a fresh project --
-- `20260610221716_add_source_to_leads` ALTERs a `leads` table that would not exist.
--
-- This reproduces the state as it was BEFORE the tracked migrations ran, so it
-- deliberately omits `leads.source` (added by 20260610221716) and `leads.clinic_id`
-- (added by 20260723033022).
--
-- SAFETY: idempotent AND safe to run against a database already at head. It creates
-- no permissive policy, so it cannot weaken RLS on an existing deployment (see the
-- two NOTE blocks below). Every statement is guarded (IF NOT EXISTS / DROP-then-
-- CREATE of a policy identical to the live one), so running it at head is a no-op.

-- Enum types backing public.leads. NOTE: the live table uses real enum types, NOT
-- the `TEXT CHECK (...)` form that database/supabase_schema.sql shows -- that file
-- had drifted from production.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'procedure_interest_enum' AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.procedure_interest_enum AS ENUM
            ('veneers', 'implants', 'whitening', 'all_on_4', 'crowns', 'other');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'language_enum' AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.language_enum AS ENUM
            ('english', 'spanish', 'bilingual');
    END IF;
END
$$;

-- Base leads table (receives standard inbound calls from the vapi-webhook function).
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    call_id TEXT UNIQUE,
    patient_name TEXT,
    procedure_interest public.procedure_interest_enum,
    language_spoken public.language_enum,
    clinic_name TEXT,
    phone_number TEXT,
    notes TEXT,
    status TEXT DEFAULT 'new' NOT NULL,
    summary TEXT,
    transcript TEXT,
    recording_url TEXT
);

-- Present on the live table; index names are intentionally the live ones
-- (`leads_*_idx`, not the `idx_*` convention used by enterprise_leads).
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON public.leads USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS leads_clinic_name_idx ON public.leads USING btree (clinic_name);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- NOTE: the real pre-tenancy schema also had a permissive policy here
--   CREATE POLICY "Allow authenticated access" ON public.leads
--       FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- It is deliberately NOT recreated. 20260723033022_tenant_isolation.sql drops it
-- immediately (DROP POLICY IF EXISTS, so the drop is a harmless no-op), which means
-- omitting it produces an IDENTICAL end state while making this file safe to run
-- against a database that is already at head. Recreating it here would re-open
-- cross-tenant lead reads on any DB where tenant_isolation had already been applied.

-- Service-role escape hatch used by the Edge Functions. Present on the live DB but
-- not created by any tracked migration, so it is captured here. (The service-role
-- key already bypasses RLS; this policy is belt-and-braces.)
DROP POLICY IF EXISTS "service_role_all" ON public.leads;
CREATE POLICY "service_role_all" ON public.leads
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- B2B agency leads: clinic owners inquiring about the AI Receptionist itself.
CREATE TABLE IF NOT EXISTS public.agency_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    call_id TEXT UNIQUE NOT NULL,
    clinic_name TEXT,
    owner_name TEXT,
    phone_number TEXT,
    current_reception_pain TEXT,
    pilot_appointment TEXT,
    summary TEXT
);

ALTER TABLE public.agency_leads ENABLE ROW LEVEL SECURITY;

-- Same reasoning as public.leads above: the original schema had
--   CREATE POLICY "Allow authenticated access to agency leads" ON public.agency_leads
--       FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- 20260723055430_harden_agency_leads_and_rls_fn.sql drops it, so omitting it here is
-- end-state identical and keeps this file safe to run at head. Live has NO policy on
-- this table -- service-role writes only.
