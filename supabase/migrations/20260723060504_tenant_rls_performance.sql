-- Performance work on the multi-tenant read path. No semantic change.
--
-- 1. Every tenant-scoped RLS policy filters on clinic_id via
--    clinic_id IN (SELECT clinic_id FROM clinic_staff WHERE user_id = auth.uid()),
--    but no clinic_id column had a covering index, so each check drove a scan and
--    every FK also paid on cascade/lookup. Supabase advisor
--    0001_unindexed_foreign_keys.
--
-- 2. A bare auth.uid() in a policy is re-evaluated for EVERY row. Wrapping it in a
--    scalar subquery -- (select auth.uid()) -- lets Postgres hoist it into an
--    InitPlan and evaluate it once per query. Identical semantics, materially
--    better plans once a clinic has real lead volume. Supabase advisor
--    0003_auth_rls_initplan.
--
-- Note: the DROP/CREATE window is fail-safe. RLS with no policy denies all, so a
-- transient state is more restrictive, never more permissive.
--
-- Idempotent: safe to re-run.

CREATE INDEX IF NOT EXISTS leads_clinic_id_idx ON public.leads (clinic_id);
CREATE INDEX IF NOT EXISTS enterprise_leads_clinic_id_idx ON public.enterprise_leads (clinic_id);
CREATE INDEX IF NOT EXISTS appointments_clinic_id_idx ON public.appointments (clinic_id);
CREATE INDEX IF NOT EXISTS clinic_staff_clinic_id_idx ON public.clinic_staff (clinic_id);

DROP POLICY IF EXISTS "Staff view their clinics" ON public.clinics;
CREATE POLICY "Staff view their clinics" ON public.clinics
    FOR SELECT USING (id IN (SELECT clinic_id FROM public.clinic_staff WHERE user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Staff access own clinic leads" ON public.leads;
CREATE POLICY "Staff access own clinic leads" ON public.leads
    FOR ALL USING (clinic_id IN (SELECT clinic_id FROM public.clinic_staff WHERE user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Staff access own clinic enterprise leads" ON public.enterprise_leads;
CREATE POLICY "Staff access own clinic enterprise leads" ON public.enterprise_leads
    FOR ALL USING (clinic_id IN (SELECT clinic_id FROM public.clinic_staff WHERE user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Staff access own clinic appointments" ON public.appointments;
CREATE POLICY "Staff access own clinic appointments" ON public.appointments
    FOR ALL USING (clinic_id IN (SELECT clinic_id FROM public.clinic_staff WHERE user_id = (select auth.uid())));
