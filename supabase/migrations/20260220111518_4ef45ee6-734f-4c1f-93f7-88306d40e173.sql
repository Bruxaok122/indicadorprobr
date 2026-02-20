-- Add lawyer_name to waba_phone_numbers
ALTER TABLE public.waba_phone_numbers ADD COLUMN IF NOT EXISTS lawyer_name text;

-- Add conversation_transferred_at and transferred_to_user_id to conversations
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS transferred_at timestamp with time zone;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS transferred_by uuid;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS original_user_id uuid;
