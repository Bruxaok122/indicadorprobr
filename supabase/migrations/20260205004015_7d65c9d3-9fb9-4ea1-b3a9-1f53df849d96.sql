-- Create user roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  is_blocked BOOLEAN DEFAULT false,
  can_use_shared_api BOOLEAN DEFAULT false,
  device_fingerprint TEXT,
  last_device_info JSONB,
  last_login_at TIMESTAMP WITH TIME ZONE,
  messages_sent INTEGER DEFAULT 0,
  templates_sent INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Create device_sessions table for tracking unique devices
CREATE TABLE public.device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_info JSONB,
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, device_fingerprint)
);

-- Create user_whatsapp_config table for users with their own API
CREATE TABLE public.user_whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT,
  waba_id TEXT,
  phone_number_id TEXT,
  is_validated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add user_id to contacts table
ALTER TABLE public.contacts ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to messages table
ALTER TABLE public.messages ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to conversations table
ALTER TABLE public.conversations ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to import_logs table
ALTER TABLE public.import_logs ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add image_url column to messages for storing image media
ALTER TABLE public.messages ADD COLUMN image_url TEXT;

-- Enable RLS on new tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_whatsapp_config ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Function to check if user is blocked
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

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Only admins can insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()) OR auth.uid() = user_id);

CREATE POLICY "Only admins can delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- User roles policies
CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Device sessions policies
CREATE POLICY "Users can view their own sessions"
ON public.device_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can manage their own sessions"
ON public.device_sessions FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- User WhatsApp config policies
CREATE POLICY "Users can manage their own WhatsApp config"
ON public.user_whatsapp_config FOR ALL
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all WhatsApp configs"
ON public.user_whatsapp_config FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Update contacts policies to filter by user_id
DROP POLICY IF EXISTS "Allow all access to contacts" ON public.contacts;
CREATE POLICY "Users can manage their own contacts"
ON public.contacts FOR ALL
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Update messages policies
DROP POLICY IF EXISTS "Allow all access to messages" ON public.messages;
CREATE POLICY "Users can manage their own messages"
ON public.messages FOR ALL
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Update conversations policies
DROP POLICY IF EXISTS "Allow all access to conversations" ON public.conversations;
CREATE POLICY "Users can manage their own conversations"
ON public.conversations FOR ALL
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Update import_logs policies
DROP POLICY IF EXISTS "Allow all access to import_logs" ON public.import_logs;
CREATE POLICY "Users can manage their own import_logs"
ON public.import_logs FOR ALL
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- WhatsApp config remains accessible by admins only
DROP POLICY IF EXISTS "Allow all access to whatsapp_config" ON public.whatsapp_config;
CREATE POLICY "Only admins can manage whatsapp_config"
ON public.whatsapp_config FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- Message templates accessible by all authenticated users
DROP POLICY IF EXISTS "Allow all access to message_templates" ON public.message_templates;
CREATE POLICY "Authenticated users can read templates"
ON public.message_templates FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can manage templates"
ON public.message_templates FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Trigger to update profiles updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update user_whatsapp_config updated_at
CREATE TRIGGER update_user_whatsapp_config_updated_at
BEFORE UPDATE ON public.user_whatsapp_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for device_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;