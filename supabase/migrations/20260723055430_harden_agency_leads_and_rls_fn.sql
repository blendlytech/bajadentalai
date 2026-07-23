-- Security hardening.
--
-- 1. public.agency_leads carried "Allow authenticated access to agency leads"
--    (FOR ALL TO authenticated USING (true) WITH CHECK (true)), so ANY signed-in
--    user could read and write the founder's B2B pipeline. Once clinic staff get
--    accounts via public.clinic_staff, that is a cross-account leak. Only the
--    vapi-webhook Edge Function touches this table and it uses the service-role
--    key, which bypasses RLS -- so removing the policy costs nothing. This leaves
--    agency_leads in the same posture as public.web_leads: RLS on, no policy,
--    service-role writes only. A future staff dashboard must add an explicit
--    SELECT policy.
--
-- 2. public.rls_auto_enable() is an event-trigger function, but was EXECUTE-able
--    by anon/authenticated via /rest/v1/rpc/rls_auto_enable. Event triggers fire
--    through the DDL mechanism, not through caller privileges, so revoking
--    EXECUTE does not affect its real job.
--
-- Idempotent: safe to re-run.

DROP POLICY IF EXISTS "Allow authenticated access to agency leads" ON public.agency_leads;

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM authenticated;
