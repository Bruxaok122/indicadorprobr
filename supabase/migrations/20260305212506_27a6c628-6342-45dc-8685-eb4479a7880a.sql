ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS whatsapp_profile_name text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS name_verified boolean DEFAULT NULL;