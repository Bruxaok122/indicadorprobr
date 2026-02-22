
CREATE OR REPLACE FUNCTION public.update_contact_last_message_preview()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.contacts
  SET last_message_preview = LEFT(NEW.content, 100),
      last_message_at = NEW.created_at
  WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
