-- Create function to increment messages_sent counter
CREATE OR REPLACE FUNCTION public.increment_messages_sent(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles 
  SET messages_sent = COALESCE(messages_sent, 0) + 1
  WHERE user_id = _user_id;
$$;

-- Create function to increment templates_sent counter
CREATE OR REPLACE FUNCTION public.increment_templates_sent(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles 
  SET templates_sent = COALESCE(templates_sent, 0) + 1
  WHERE user_id = _user_id;
$$;