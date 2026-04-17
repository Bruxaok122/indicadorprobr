ALTER TABLE public.api_configs
  ADD COLUMN IF NOT EXISTS messaging_tier TEXT,
  ADD COLUMN IF NOT EXISTS quality_rating TEXT,
  ADD COLUMN IF NOT EXISTS tier_updated_at TIMESTAMPTZ;

ALTER TABLE public.waba_phone_numbers
  ADD COLUMN IF NOT EXISTS messaging_tier TEXT,
  ADD COLUMN IF NOT EXISTS tier_updated_at TIMESTAMPTZ;