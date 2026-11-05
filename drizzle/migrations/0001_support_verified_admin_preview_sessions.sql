CREATE OR REPLACE FUNCTION public.admin_current_session_id() RETURNS uuid LANGUAGE sql STABLE SET search_path=public AS $$ SELECT COALESCE(NULLIF(auth.jwt()->>'session_id','')::uuid, md5(auth.jwt()::text)::uuid) $$;
REVOKE ALL ON FUNCTION public.admin_current_session_id() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_current_session_id() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.check_admin_computer(p_fingerprint text, p_device_info jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sid uuid; v_computer public.admin_computers; v_session public.admin_login_sessions;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 v_sid := public.admin_current_session_id();
 IF p_fingerprint IS NULL OR length(p_fingerprint) <> 64 THEN RAISE EXCEPTION 'Invalid fingerprint'; END IF;
 INSERT INTO public.admin_computers(user_id,fingerprint,device_info) VALUES(auth.uid(),p_fingerprint,p_device_info) ON CONFLICT(user_id,fingerprint) DO UPDATE SET device_info=EXCLUDED.device_info,updated_at=now() RETURNING * INTO v_computer;
 IF v_computer.is_blocked THEN RETURN jsonb_build_object('allowed',false,'reason','blocked'); END IF;
 INSERT INTO public.admin_login_sessions(id,computer_id,user_id) VALUES(v_sid,v_computer.id,auth.uid()) ON CONFLICT(id) DO NOTHING;
 SELECT * INTO v_session FROM public.admin_login_sessions WHERE id=v_sid;
 IF NOT v_session.is_active OR v_session.computer_id <> v_computer.id OR v_session.user_id <> auth.uid() THEN RETURN jsonb_build_object('allowed',false,'reason','logged_out'); END IF;
 UPDATE public.admin_login_sessions SET last_seen_at=now() WHERE id=v_sid;
 RETURN jsonb_build_object('allowed',true,'computer_id',v_computer.id);
END; $$;
CREATE OR REPLACE FUNCTION public.manage_admin_computer(p_computer_id uuid,p_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) OR NOT EXISTS(SELECT 1 FROM public.admin_login_sessions s JOIN public.admin_computers c ON c.id=s.computer_id WHERE s.id=public.admin_current_session_id() AND s.user_id=auth.uid() AND s.is_active AND NOT c.is_blocked) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_action NOT IN ('logout','block','unblock') THEN RAISE EXCEPTION 'Invalid action'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.admin_computers WHERE id=p_computer_id) THEN RAISE EXCEPTION 'Computer not found'; END IF;
 IF p_action IN ('block','unblock') THEN UPDATE public.admin_computers SET is_blocked=(p_action='block'),updated_at=now() WHERE id=p_computer_id; END IF;
 IF p_action IN ('logout','block') THEN UPDATE public.admin_login_sessions SET is_active=false WHERE computer_id=p_computer_id; END IF;
END; $$;