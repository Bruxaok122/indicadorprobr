
CREATE TABLE public.admin_audio_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  audio_url text NOT NULL,
  audio_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.admin_audio_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage audio config"
  ON public.admin_audio_config FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Authenticated users can read audio config"
  ON public.admin_audio_config FOR SELECT
  USING (auth.uid() IS NOT NULL);
