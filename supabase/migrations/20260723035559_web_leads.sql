-- Marketing-site contact form submissions (bajadental_site/contacto.html).
-- Written by the `web-lead` Edge Function using the service-role key.
create table if not exists public.web_leads (
    id uuid default gen_random_uuid() primary key,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    name text not null,
    clinic_name text,
    whatsapp text,
    email text,
    plan_interest text,
    message text,
    source text default 'web_contact_form',
    user_agent text,
    status text default 'new'
);

-- Keep health-adjacent/PII private. Service-role (Edge Function) bypasses RLS;
-- with no anon/authenticated policy, nothing else can read or write.
-- A future staff dashboard will need: FOR SELECT USING (true) TO authenticated
-- (or a per-clinic policy once these leads carry a clinic_id).
alter table public.web_leads enable row level security;

comment on table public.web_leads is 'Marketing-site contact form submissions via the web-lead Edge Function.';
