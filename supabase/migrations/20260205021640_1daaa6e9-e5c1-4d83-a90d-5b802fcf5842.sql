-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can manage their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can manage their own conversations" ON public.conversations;

-- Create new policies for contacts - allow admins to see all (including where user_id is NULL)
CREATE POLICY "Users can manage their own contacts" 
ON public.contacts 
FOR ALL 
USING (
  (auth.uid() = user_id) OR 
  (user_id IS NULL AND is_admin(auth.uid())) OR
  is_admin(auth.uid())
)
WITH CHECK (
  (auth.uid() = user_id) OR 
  is_admin(auth.uid())
);

-- Create new policies for messages - allow admins to see all (including where user_id is NULL)
CREATE POLICY "Users can manage their own messages" 
ON public.messages 
FOR ALL 
USING (
  (auth.uid() = user_id) OR 
  (user_id IS NULL AND is_admin(auth.uid())) OR
  is_admin(auth.uid())
)
WITH CHECK (
  (auth.uid() = user_id) OR 
  is_admin(auth.uid())
);

-- Create new policies for conversations - allow admins to see all (including where user_id is NULL)
CREATE POLICY "Users can manage their own conversations" 
ON public.conversations 
FOR ALL 
USING (
  (auth.uid() = user_id) OR 
  (user_id IS NULL AND is_admin(auth.uid())) OR
  is_admin(auth.uid())
)
WITH CHECK (
  (auth.uid() = user_id) OR 
  is_admin(auth.uid())
);