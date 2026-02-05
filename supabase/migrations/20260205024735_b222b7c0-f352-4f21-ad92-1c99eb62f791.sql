-- Create login_attempts table to track suspicious activity
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_fingerprint text NOT NULL,
  ip_address text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Only admins can view login attempts
CREATE POLICY "Admins can view all login attempts" 
ON public.login_attempts 
FOR SELECT 
USING (is_admin(auth.uid()));

-- Users can insert their own attempts (for logging)
CREATE POLICY "Users can insert their own attempts" 
ON public.login_attempts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add temp ban fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS temp_banned_until timestamp with time zone,
ADD COLUMN IF NOT EXISTS ban_reason text,
ADD COLUMN IF NOT EXISTS failed_device_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_failed_attempt_at timestamp with time zone;

-- Create function to check if user is temporarily banned
CREATE OR REPLACE FUNCTION public.is_temp_banned(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT temp_banned_until > now() FROM public.profiles WHERE user_id = _user_id),
    false
  )
$$;

-- Create function to increment failed attempts and apply temp ban if needed
CREATE OR REPLACE FUNCTION public.record_failed_device_attempt(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_attempts integer;
  last_attempt timestamp with time zone;
  ban_duration interval;
  result json;
BEGIN
  -- Get current failed attempts
  SELECT failed_device_attempts, last_failed_attempt_at 
  INTO current_attempts, last_attempt
  FROM public.profiles 
  WHERE user_id = _user_id;
  
  -- Reset counter if last attempt was more than 1 hour ago
  IF last_attempt IS NULL OR last_attempt < now() - interval '1 hour' THEN
    current_attempts := 0;
  END IF;
  
  -- Increment attempts
  current_attempts := current_attempts + 1;
  
  -- Apply temp ban based on attempts
  IF current_attempts >= 5 THEN
    -- 24 hour ban after 5 attempts
    ban_duration := interval '24 hours';
  ELSIF current_attempts >= 3 THEN
    -- 1 hour ban after 3 attempts
    ban_duration := interval '1 hour';
  ELSE
    ban_duration := NULL;
  END IF;
  
  -- Update profile
  UPDATE public.profiles 
  SET 
    failed_device_attempts = current_attempts,
    last_failed_attempt_at = now(),
    temp_banned_until = CASE WHEN ban_duration IS NOT NULL THEN now() + ban_duration ELSE temp_banned_until END,
    ban_reason = CASE WHEN ban_duration IS NOT NULL THEN 'Múltiplas tentativas de acesso de dispositivos diferentes' ELSE ban_reason END
  WHERE user_id = _user_id;
  
  result := json_build_object(
    'attempts', current_attempts,
    'is_banned', ban_duration IS NOT NULL,
    'ban_duration_hours', EXTRACT(EPOCH FROM ban_duration) / 3600
  );
  
  RETURN result;
END;
$$;

-- Create function to clear failed attempts on successful login
CREATE OR REPLACE FUNCTION public.clear_failed_attempts(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles 
  SET failed_device_attempts = 0, last_failed_attempt_at = NULL
  WHERE user_id = _user_id;
$$;