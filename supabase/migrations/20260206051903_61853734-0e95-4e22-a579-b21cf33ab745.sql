-- Fix device_sessions RLS policies (change from RESTRICTIVE to PERMISSIVE)
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.device_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.device_sessions;

-- Create PERMISSIVE policies for device_sessions
CREATE POLICY "Users can insert their own sessions"
ON public.device_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
ON public.device_sessions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
ON public.device_sessions
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own sessions"
ON public.device_sessions
FOR SELECT
USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- Fix login_attempts RLS policies
DROP POLICY IF EXISTS "Users can insert their own attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Admins can view all login attempts" ON public.login_attempts;

-- Create PERMISSIVE policies for login_attempts
CREATE POLICY "Users can insert their own attempts"
ON public.login_attempts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all login attempts"
ON public.login_attempts
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their own attempts"
ON public.login_attempts
FOR SELECT
USING (auth.uid() = user_id);

-- Clean up any stale/orphan device sessions to start fresh
DELETE FROM public.device_sessions;