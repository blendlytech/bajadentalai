ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN public.leads.source IS 'Entry point that originated the call (e.g. homepage_hero, walkin_demo). Set from Vapi call.metadata.source.';
