CREATE OR REPLACE FUNCTION public.list_admin_devices() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) OR NOT EXISTS(SELECT 1 FROM public.admin_login_sessions l JOIN public.admin_computers c ON c.id=l.computer_id WHERE l.id=public.admin_current_session_id() AND l.user_id=auth.uid() AND l.is_active AND NOT c.is_blocked) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 WITH real_sessions AS (
 SELECT s.id,s.user_id,s.created_at,COALESCE(s.refreshed_at AT TIME ZONE 'UTC',s.updated_at,s.created_at) AS last_seen_at,s.user_agent,(s.not_after IS NULL OR s.not_after>now()) AS valid FROM auth.sessions s WHERE public.is_admin(s.user_id)
 ), tracked AS (
 SELECT c.id,c.user_id,c.device_info,c.is_blocked,p.full_name,p.email,
 (SELECT max(l.last_seen_at) FROM public.admin_login_sessions l WHERE l.computer_id=c.id) AS last_seen_at,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'last_seen_at',l.last_seen_at)) FROM public.admin_login_sessions l LEFT JOIN real_sessions r ON r.id=l.id WHERE l.computer_id=c.id AND l.is_active AND (r.valid OR (l.last_seen_at>now()-interval '2 minutes' AND NOT EXISTS(SELECT 1 FROM auth.sessions a WHERE a.id=l.id)))),'[]'::jsonb) AS sessions
 FROM public.admin_computers c LEFT JOIN public.profiles p ON p.user_id=c.user_id WHERE public.is_admin(c.user_id)
 ), legacy AS (
 SELECT DISTINCT ON(d.user_id,d.device_fingerprint) d.* FROM public.device_sessions d WHERE public.is_admin(d.user_id) AND NOT EXISTS(SELECT 1 FROM public.admin_computers c WHERE c.user_id=d.user_id AND c.fingerprint=d.device_fingerprint) ORDER BY d.user_id,d.device_fingerprint,d.last_seen_at DESC
 ), rows AS (
 SELECT jsonb_build_object('id',id,'device_info',device_info,'is_blocked',is_blocked,'profile',jsonb_build_object('full_name',full_name,'email',email),'sessions',sessions,'last_seen_at',last_seen_at,'registered',true) AS item FROM tracked
 UNION ALL
 SELECT jsonb_build_object('id',r.id,'registered',false,'is_blocked',false,'last_seen_at',r.last_seen_at,'device_info',jsonb_build_object('browser',CASE WHEN r.user_agent LIKE '%Edg/%' THEN 'Edge' WHEN r.user_agent LIKE '%OPR/%' THEN 'Opera' WHEN r.user_agent LIKE '%Firefox%' THEN 'Firefox' WHEN r.user_agent LIKE '%Chrome%' THEN 'Chrome' WHEN r.user_agent LIKE '%Safari%' THEN 'Safari' ELSE 'Não identificado' END,'os',CASE WHEN r.user_agent LIKE '%Android%' THEN 'Android' WHEN r.user_agent ~ 'iPhone|iPad' THEN 'iOS' WHEN r.user_agent LIKE '%Windows%' THEN 'Windows' WHEN r.user_agent LIKE '%Mac%' THEN 'macOS' WHEN r.user_agent LIKE '%Linux%' THEN 'Linux' ELSE 'Não identificado' END,'model',CASE WHEN r.user_agent LIKE '%iPhone%' THEN 'iPhone (geração não informada)' WHEN r.user_agent LIKE '%iPad%' THEN 'iPad (geração não informada)' ELSE 'Modelo não informado pelo navegador' END,'device',CASE WHEN r.user_agent ~ 'Mobile|Android|iPhone|iPad' THEN 'Mobile' ELSE 'Desktop' END),'profile',jsonb_build_object('full_name',p.full_name,'email',p.email),'sessions',CASE WHEN r.valid THEN jsonb_build_array(jsonb_build_object('id',r.id,'last_seen_at',r.last_seen_at)) ELSE '[]'::jsonb END)
 FROM real_sessions r LEFT JOIN public.profiles p ON p.user_id=r.user_id WHERE NOT EXISTS(SELECT 1 FROM public.admin_login_sessions l WHERE l.id=r.id)
 UNION ALL
 SELECT jsonb_build_object('id',d.id,'registered',false,'is_blocked',false,'last_seen_at',d.last_seen_at,'device_info',COALESCE(d.device_info,'{}'::jsonb),'profile',jsonb_build_object('full_name',p.full_name,'email',p.email),'sessions','[]'::jsonb) FROM legacy d LEFT JOIN public.profiles p ON p.user_id=d.user_id
 ) SELECT COALESCE(jsonb_agg(item ORDER BY jsonb_array_length(item->'sessions') DESC,item->>'last_seen_at' DESC NULLS LAST),'[]'::jsonb) INTO result FROM rows;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.list_admin_devices() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_admin_devices() TO authenticated;

CREATE OR REPLACE FUNCTION public.check_admin_computer(p_fingerprint text,p_device_info jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_sid uuid; v_computer public.admin_computers; v_session public.admin_login_sessions;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 v_sid:=public.admin_current_session_id();
 IF p_fingerprint IS NULL OR length(p_fingerprint)<>64 OR jsonb_typeof(p_device_info)<>'object' THEN RAISE EXCEPTION 'Invalid device'; END IF;
 INSERT INTO public.admin_computers(user_id,fingerprint,device_info) VALUES(auth.uid(),p_fingerprint,p_device_info-'location') ON CONFLICT(user_id,fingerprint) DO UPDATE SET device_info=admin_computers.device_info || (EXCLUDED.device_info-'location'),updated_at=now() RETURNING * INTO v_computer;
 IF v_computer.is_blocked THEN RETURN jsonb_build_object('allowed',false,'reason','blocked'); END IF;
 INSERT INTO public.admin_login_sessions(id,computer_id,user_id) VALUES(v_sid,v_computer.id,auth.uid()) ON CONFLICT(id) DO NOTHING;
 SELECT * INTO v_session FROM public.admin_login_sessions WHERE id=v_sid;
 IF NOT v_session.is_active OR v_session.computer_id<>v_computer.id OR v_session.user_id<>auth.uid() THEN RETURN jsonb_build_object('allowed',false,'reason','logged_out'); END IF;
 UPDATE public.admin_login_sessions SET last_seen_at=now() WHERE id=v_sid;
 RETURN jsonb_build_object('allowed',true,'computer_id',v_computer.id);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_location_context() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT jsonb_build_object('computer_id',c.id,'ip',host(s.ip),'cached',COALESCE((c.device_info->'location'->>'updated_at')::timestamptz>now()-interval '1 day',false)) INTO result
 FROM public.admin_login_sessions l JOIN public.admin_computers c ON c.id=l.computer_id LEFT JOIN auth.sessions s ON s.id=l.id AND s.user_id=l.user_id
 WHERE l.id=public.admin_current_session_id() AND l.user_id=auth.uid() AND l.is_active AND NOT c.is_blocked;
 IF result IS NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.admin_location_context() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_location_context() TO authenticated;

CREATE OR REPLACE FUNCTION public.save_admin_device_location(p_computer_id uuid,p_location jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.admin_computers SET device_info=jsonb_set(device_info,'{location}',jsonb_build_object('city',left(p_location->>'city',100),'region',left(p_location->>'region',100),'country',left(p_location->>'country',100),'updated_at',now(),'source','IP')),updated_at=now() WHERE id=p_computer_id;
END; $$;
REVOKE ALL ON FUNCTION public.save_admin_device_location(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_admin_device_location(uuid,jsonb) TO service_role;