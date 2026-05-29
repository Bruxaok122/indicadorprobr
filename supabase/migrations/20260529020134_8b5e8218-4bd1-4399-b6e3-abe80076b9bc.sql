
-- 1. New permission column on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_replay_admin_dispatch boolean DEFAULT false;

-- 2. Singleton table for the last admin dispatch snapshot
CREATE TABLE IF NOT EXISTS public.last_admin_dispatch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  template_language text NOT NULL DEFAULT 'pt_BR',
  list_name text NOT NULL,
  total integer NOT NULL DEFAULT 0,
  mode text NOT NULL DEFAULT 'batch',
  phone_number_id text,
  variable_mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
  phone_verified_name text,
  min_income numeric,
  batch_size integer,
  interval_seconds integer,
  turbo_limit integer,
  created_by_admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.last_admin_dispatch TO authenticated;
GRANT ALL ON public.last_admin_dispatch TO service_role;

ALTER TABLE public.last_admin_dispatch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view last admin dispatch"
  ON public.last_admin_dispatch
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage last admin dispatch"
  ON public.last_admin_dispatch
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
