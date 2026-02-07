
-- Table to store WABA phone numbers synced from Meta API
CREATE TABLE public.waba_phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id text NOT NULL UNIQUE,
  display_phone_number text NOT NULL,
  verified_name text,
  quality_rating text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.waba_phone_numbers ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active phone numbers
CREATE POLICY "Authenticated users can view phone numbers"
  ON public.waba_phone_numbers
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage phone numbers
CREATE POLICY "Admins can manage phone numbers"
  ON public.waba_phone_numbers
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Table to store which users can use which phone numbers
CREATE TABLE public.user_phone_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone_number_id uuid NOT NULL REFERENCES public.waba_phone_numbers(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, phone_number_id)
);

-- Enable RLS
ALTER TABLE public.user_phone_permissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own permissions
CREATE POLICY "Users can view their own phone permissions"
  ON public.user_phone_permissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Only admins can manage permissions
CREATE POLICY "Admins can manage phone permissions"
  ON public.user_phone_permissions
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Trigger for updated_at on waba_phone_numbers
CREATE TRIGGER update_waba_phone_numbers_updated_at
  BEFORE UPDATE ON public.waba_phone_numbers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
