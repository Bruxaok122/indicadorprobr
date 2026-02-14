
-- Add created_by column to track who registered each number
ALTER TABLE public.waba_phone_numbers 
ADD COLUMN created_by uuid REFERENCES auth.users(id) DEFAULT NULL;

-- Allow users who created a number to also view it (already covered by existing SELECT policy for authenticated)
-- But we need users to be able to manage (update/sync) their own numbers
CREATE POLICY "Creators can update their own phone numbers"
ON public.waba_phone_numbers
FOR UPDATE
USING (auth.uid() = created_by);
