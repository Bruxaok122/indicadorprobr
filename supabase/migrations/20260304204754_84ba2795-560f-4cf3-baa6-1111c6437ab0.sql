
-- Stores successful interaction patterns the AI can learn from
CREATE TABLE public.ai_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'objection', -- 'objection', 'data_extraction', 'closing', 'general'
  client_message text NOT NULL,
  ai_response text NOT NULL,
  result text NOT NULL DEFAULT 'success', -- 'success' (client advanced), 'failure' (client dropped), 'neutral'
  from_stage text, -- which stage this happened in
  to_stage text, -- which stage client moved to (null if failure)
  times_used integer NOT NULL DEFAULT 1,
  approved boolean NOT NULL DEFAULT false, -- admin must approve before it enters the prompt
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_learning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ai_learning" ON public.ai_learning
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Tracks conversion metrics per stage
CREATE TABLE public.ai_conversion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  from_stage text NOT NULL,
  to_stage text NOT NULL,
  response_time_seconds integer, -- how fast the AI closed this stage
  messages_in_stage integer DEFAULT 1, -- how many messages it took
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_conversion_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage conversion logs" ON public.ai_conversion_logs
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Index for fast learning queries
CREATE INDEX idx_ai_learning_approved ON public.ai_learning(approved, result, category);
CREATE INDEX idx_ai_conversion_contact ON public.ai_conversion_logs(contact_id);
