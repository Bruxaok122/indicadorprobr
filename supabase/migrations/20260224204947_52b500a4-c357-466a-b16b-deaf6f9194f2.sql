
-- Add has_whatsapp column to contacts table
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS has_whatsapp boolean DEFAULT NULL;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_contacts_has_whatsapp ON public.contacts(has_whatsapp);
