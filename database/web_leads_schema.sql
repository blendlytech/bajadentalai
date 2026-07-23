-- Supabase Schema for Baja Dental AI — Web Contact-Form Leads
-- Marketing-site contact form submissions (bajadental_site/contacto.html),
-- written by the `web-lead` Edge Function using the service-role key.
-- Applied to the live DB 2026-07-22 as migration `web_leads`.

CREATE TABLE IF NOT EXISTS public.web_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    clinic_name TEXT,
    whatsapp TEXT,
    email TEXT,
    plan_interest TEXT,
    message TEXT,
    source TEXT DEFAULT 'web_contact_form',
    user_agent TEXT,
    status TEXT DEFAULT 'new'
);

-- Keep PII private. The service-role Edge Function bypasses RLS; with no
-- anon/authenticated policy, nothing client-side can read or write.
-- A future staff dashboard will need e.g.:
--   CREATE POLICY "staff read web leads" ON public.web_leads
--     FOR SELECT TO authenticated USING (true);
ALTER TABLE public.web_leads ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.web_leads IS 'Marketing-site contact form submissions via the web-lead Edge Function.';
