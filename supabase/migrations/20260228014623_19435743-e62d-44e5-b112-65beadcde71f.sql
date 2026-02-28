
-- Create table for multiple API configurations
CREATE TABLE public.api_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  access_token text NOT NULL,
  waba_id text NOT NULL,
  phone_number_id text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  is_validated boolean NOT NULL DEFAULT false,
  status_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_configs ENABLE ROW LEVEL SECURITY;

-- Only admins can manage API configs
CREATE POLICY "Only admins can manage api_configs"
  ON public.api_configs FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Add api_config_id to contacts to track which API created them
ALTER TABLE public.contacts ADD COLUMN api_config_id uuid REFERENCES public.api_configs(id);

-- Add api_config_id to conversations
ALTER TABLE public.conversations ADD COLUMN api_config_id uuid REFERENCES public.api_configs(id);

-- Add api_config_id to waba_phone_numbers
ALTER TABLE public.waba_phone_numbers ADD COLUMN api_config_id uuid REFERENCES public.api_configs(id);

-- Trigger for updated_at
CREATE TRIGGER update_api_configs_updated_at
  BEFORE UPDATE ON public.api_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to ensure only one API is active at a time
CREATE OR REPLACE FUNCTION public.ensure_single_active_api()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.api_configs SET is_active = false WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER ensure_single_active_api_trigger
  BEFORE INSERT OR UPDATE ON public.api_configs
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION public.ensure_single_active_api();
