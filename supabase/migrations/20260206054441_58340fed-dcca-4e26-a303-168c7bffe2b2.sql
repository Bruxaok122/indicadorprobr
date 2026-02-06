-- Drop and recreate RLS policies as PERMISSIVE for contacts, conversations, messages, and device_sessions

-- =====================
-- CONTACTS
-- =====================
DROP POLICY IF EXISTS "Users can manage their own contacts" ON public.contacts;

CREATE POLICY "Users can view contacts"
ON public.contacts
FOR SELECT
USING (
  auth.uid() = user_id 
  OR user_id IS NULL 
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can insert contacts"
ON public.contacts
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can update contacts"
ON public.contacts
FOR UPDATE
USING (
  auth.uid() = user_id 
  OR user_id IS NULL 
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can delete contacts"
ON public.contacts
FOR DELETE
USING (
  auth.uid() = user_id 
  OR is_admin(auth.uid())
);

-- =====================
-- CONVERSATIONS
-- =====================
DROP POLICY IF EXISTS "Users can manage their own conversations" ON public.conversations;

CREATE POLICY "Users can view conversations"
ON public.conversations
FOR SELECT
USING (
  auth.uid() = user_id 
  OR user_id IS NULL 
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can insert conversations"
ON public.conversations
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can update conversations"
ON public.conversations
FOR UPDATE
USING (
  auth.uid() = user_id 
  OR user_id IS NULL 
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can delete conversations"
ON public.conversations
FOR DELETE
USING (
  auth.uid() = user_id 
  OR is_admin(auth.uid())
);

-- =====================
-- MESSAGES
-- =====================
DROP POLICY IF EXISTS "Users can manage their own messages" ON public.messages;

CREATE POLICY "Users can view messages"
ON public.messages
FOR SELECT
USING (
  auth.uid() = user_id 
  OR user_id IS NULL 
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can insert messages"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can update messages"
ON public.messages
FOR UPDATE
USING (
  auth.uid() = user_id 
  OR user_id IS NULL 
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can delete messages"
ON public.messages
FOR DELETE
USING (
  auth.uid() = user_id 
  OR is_admin(auth.uid())
);

-- =====================
-- DEVICE_SESSIONS (fix admin update access)
-- =====================
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.device_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.device_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.device_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.device_sessions;

CREATE POLICY "Users can view sessions"
ON public.device_sessions
FOR SELECT
USING (
  auth.uid() = user_id 
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can insert sessions"
ON public.device_sessions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "Users can update sessions"
ON public.device_sessions
FOR UPDATE
USING (
  auth.uid() = user_id 
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can delete sessions"
ON public.device_sessions
FOR DELETE
USING (
  auth.uid() = user_id 
  OR is_admin(auth.uid())
);

-- Add unique constraint for upsert if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'device_sessions_user_fingerprint_unique'
  ) THEN
    ALTER TABLE public.device_sessions 
    ADD CONSTRAINT device_sessions_user_fingerprint_unique 
    UNIQUE (user_id, device_fingerprint);
  END IF;
END $$;