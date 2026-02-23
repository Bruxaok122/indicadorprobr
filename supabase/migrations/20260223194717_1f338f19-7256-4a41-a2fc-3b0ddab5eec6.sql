
-- Add error tracking columns to messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS error_code text,
ADD COLUMN IF NOT EXISTS error_details text;
