-- Fix FK constraint on waba_phone_numbers.created_by to allow user deletion
ALTER TABLE public.waba_phone_numbers
  DROP CONSTRAINT IF EXISTS waba_phone_numbers_created_by_fkey;

ALTER TABLE public.waba_phone_numbers
  ADD CONSTRAINT waba_phone_numbers_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id)
  ON DELETE SET NULL;