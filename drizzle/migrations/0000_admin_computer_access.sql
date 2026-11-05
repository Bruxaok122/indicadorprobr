CREATE TABLE public.admin_computers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, fingerprint text NOT NULL, device_info jsonb NOT NULL DEFAULT '{}', is_blocked boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id, fingerprint));
GRANT SELECT ON public.admin_computers TO authenticated;
GRANT ALL ON public.admin_computers TO service_role;
ALTER TABLE public.admin_computers ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_computers_read ON public.admin_computers FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE TABLE public.admin_login_sessions (id uuid PRIMARY KEY, computer_id uuid NOT NULL REFERENCES public.admin_computers(id) ON DELETE CASCADE, user_id uuid NOT NULL, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.admin_login_sessions TO authenticated;
GRANT ALL ON public.admin_login_sessions TO service_role;
ALTER TABLE public.admin_login_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_login_sessions_read ON public.admin_login_sessions FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX admin_login_sessions_computer_idx ON public.admin_login_sessions(computer_id);
CREATE OR REPLACE FUNCTION public.check_admin_computer(p_fingerprint text, p_device_info jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sid uuid; v_computer public.admin_computers; v_session public.admin_login_sessions;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 v_sid := NULLIF(auth.jwt()->>'session_id','')::uuid;
 IF v_sid IS NULL THEN RAISE EXCEPTION 'Missing session'; END IF;
 IF p_fingerprint IS NULL OR length(p_fingerprint) <> 64 THEN RAISE EXCEPTION 'Invalid fingerprint'; END IF;
 INSERT INTO public.admin_computers(user_id,fingerprint,device_info) VALUES(auth.uid(),p_fingerprint,p_device_info) ON CONFLICT(user_id,fingerprint) DO UPDATE SET device_info=EXCLUDED.device_info,updated_at=now() RETURNING * INTO v_computer;
 IF v_computer.is_blocked THEN RETURN jsonb_build_object('allowed',false,'reason','blocked'); END IF;
 INSERT INTO public.admin_login_sessions(id,computer_id,user_id) VALUES(v_sid,v_computer.id,auth.uid()) ON CONFLICT(id) DO NOTHING;
 SELECT * INTO v_session FROM public.admin_login_sessions WHERE id=v_sid;
 IF NOT v_session.is_active OR v_session.computer_id <> v_computer.id OR v_session.user_id <> auth.uid() THEN RETURN jsonb_build_object('allowed',false,'reason','logged_out'); END IF;
 UPDATE public.admin_login_sessions SET last_seen_at=now() WHERE id=v_sid;
 RETURN jsonb_build_object('allowed',true,'computer_id',v_computer.id);
END; $$;
REVOKE ALL ON FUNCTION public.check_admin_computer(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_admin_computer(text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.manage_admin_computer(p_computer_id uuid,p_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) OR NOT EXISTS(SELECT 1 FROM public.admin_login_sessions s JOIN public.admin_computers c ON c.id=s.computer_id WHERE s.id=NULLIF(auth.jwt()->>'session_id','')::uuid AND s.user_id=auth.uid() AND s.is_active AND NOT c.is_blocked) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_action NOT IN ('logout','block','unblock') THEN RAISE EXCEPTION 'Invalid action'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.admin_computers WHERE id=p_computer_id) THEN RAISE EXCEPTION 'Computer not found'; END IF;
 IF p_action IN ('block','unblock') THEN UPDATE public.admin_computers SET is_blocked=(p_action='block'),updated_at=now() WHERE id=p_computer_id; END IF;
 IF p_action IN ('logout','block') THEN UPDATE public.admin_login_sessions SET is_active=false WHERE computer_id=p_computer_id; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.manage_admin_computer(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_admin_computer(uuid,text) TO authenticated;