
-- Add user_id column to admin_audio_config to support per-operator audio
ALTER TABLE public.admin_audio_config
ADD COLUMN user_id uuid NULL;

-- Make audio_name and audio_url accept potential updates per row
-- Create index for faster lookup by user
CREATE INDEX idx_admin_audio_config_user_id ON public.admin_audio_config (user_id);
