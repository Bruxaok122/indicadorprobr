
-- Add last_message_preview column
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_message_preview text;

-- Create trigger function to auto-update last_message_preview
CREATE OR REPLACE FUNCTION public.update_contact_last_message_preview()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.contacts
  SET last_message_preview = LEFT(NEW.content, 100),
      last_message_at = NEW.created_at
  WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_last_message_preview ON public.messages;
CREATE TRIGGER trg_update_last_message_preview
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contact_last_message_preview();
