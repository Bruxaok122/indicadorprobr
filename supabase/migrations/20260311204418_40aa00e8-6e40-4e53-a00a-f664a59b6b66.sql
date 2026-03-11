
-- Allow operators to manage their own dispatches
CREATE POLICY "Operators can insert own dispatches"
ON public.active_dispatches
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = operator_id);

CREATE POLICY "Operators can update own dispatches"
ON public.active_dispatches
FOR UPDATE
TO authenticated
USING (auth.uid() = operator_id);

CREATE POLICY "Operators can view own dispatches"
ON public.active_dispatches
FOR SELECT
TO authenticated
USING (auth.uid() = operator_id OR is_admin(auth.uid()));

CREATE POLICY "Operators can delete own dispatches"
ON public.active_dispatches
FOR DELETE
TO authenticated
USING (auth.uid() = operator_id OR is_admin(auth.uid()));
