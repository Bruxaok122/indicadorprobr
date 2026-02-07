
-- Add subscription plan fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN subscription_plan text DEFAULT NULL,
ADD COLUMN subscription_expires_at timestamp with time zone DEFAULT NULL;

-- Create a function to check if user subscription is expired
CREATE OR REPLACE FUNCTION public.is_subscription_expired(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT subscription_expires_at IS NOT NULL AND subscription_expires_at < now() 
     FROM public.profiles WHERE user_id = _user_id),
    false
  )
$$;

-- Create a function for admin to set subscription plan
CREATE OR REPLACE FUNCTION public.set_subscription_plan(_user_id uuid, _plan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _expires_at timestamp with time zone;
BEGIN
  IF _plan = 'semanal' THEN
    _expires_at := now() + interval '7 days';
  ELSIF _plan = 'mensal' THEN
    _expires_at := now() + interval '30 days';
  ELSIF _plan IS NULL OR _plan = '' THEN
    _expires_at := NULL;
  ELSE
    RAISE EXCEPTION 'Plano inválido: %', _plan;
  END IF;

  UPDATE public.profiles
  SET subscription_plan = CASE WHEN _plan = '' THEN NULL ELSE _plan END,
      subscription_expires_at = _expires_at,
      is_blocked = false
  WHERE user_id = _user_id;
END;
$$;
