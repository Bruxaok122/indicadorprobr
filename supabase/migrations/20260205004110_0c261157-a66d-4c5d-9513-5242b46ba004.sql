-- Fix function search_path for is_user_blocked
CREATE OR REPLACE FUNCTION public.is_user_blocked(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_blocked FROM public.profiles WHERE user_id = _user_id),
    false
  )
$$;