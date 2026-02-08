
-- Add authorized device columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS authorized_fingerprint text,
ADD COLUMN IF NOT EXISTS authorized_device_info jsonb;

-- Add a comment for documentation
COMMENT ON COLUMN public.profiles.authorized_fingerprint IS 'Admin-approved device fingerprint. User can only access from this device.';
COMMENT ON COLUMN public.profiles.authorized_device_info IS 'Device info (browser, OS, etc.) of the authorized device.';
