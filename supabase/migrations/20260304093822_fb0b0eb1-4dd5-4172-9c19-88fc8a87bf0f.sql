
CREATE TABLE public.active_dispatches (
  id text PRIMARY KEY,
  operator_name text NOT NULL,
  operator_id uuid NOT NULL,
  template_name text NOT NULL,
  list_name text NOT NULL,
  mode text NOT NULL DEFAULT 'batch',
  total integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  current integer NOT NULL DEFAULT 0,
  is_paused boolean NOT NULL DEFAULT false,
  is_cancelled boolean NOT NULL DEFAULT false,
  is_finished boolean NOT NULL DEFAULT false,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.active_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage dispatches" ON public.active_dispatches
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
