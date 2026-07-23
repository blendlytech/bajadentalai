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
    emergency_flag BOOLEAN DEFAULT false,
    travel_origin TEXT,
    pain_points TEXT,
    competitors_mentioned TEXT,
    language_spoken TEXT
        CHECK (language_spoken IN ('english', 'spanish', 'spanglish')),
    bot_cost_usd NUMERIC(6, 4),
    call_duration_minutes NUMERIC(6, 2)
);

CREATE INDEX IF NOT EXISTS idx_enterprise_procedure ON public.enterprise_leads(procedure_interest);
CREATE INDEX IF NOT EXISTS idx_enterprise_urgency   ON public.enterprise_leads(urgency_timeline);
CREATE INDEX IF NOT EXISTS idx_enterprise_anxiety   ON public.enterprise_leads(border_crossing_anxiety);
CREATE INDEX IF NOT EXISTS idx_enterprise_emergency ON public.enterprise_leads(emergency_flag);

ALTER TABLE public.enterprise_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access" ON public.enterprise_leads
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
