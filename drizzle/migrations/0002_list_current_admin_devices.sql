CREATE OR REPLACE FUNCTION public.list_admin_devices() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) OR NOT EXISTS(SELECT 1 FROM public.admin_login_sessions l JOIN public.admin_computers c ON c.id=l.computer_id WHERE l.id=public.admin_current_session_id() AND l.user_id=auth.uid() AND l.is_active AND NOT c.is_blocked) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 WITH real_sessions AS (
 SELECT s.id,s.user_id,s.created_at,COALESCE(s.refreshed_at AT TIME ZONE 'UTC',s.updated_at,s.created_at) AS last_seen_at,s.user_agent
 FROM auth.sessions s WHERE public.is_admin(s.user_id) AND (s.not_after IS NULL OR s.not_after>now())
 ), tracked AS (
 SELECT c.id,c.user_id,c.device_info,c.is_blocked,p.full_name,p.email,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'last_seen_at',l.last_seen_at)) FROM public.admin_login_sessions l LEFT JOIN real_sessions r ON r.id=l.id WHERE l.computer_id=c.id AND l.is_active AND (r.id IS NOT NULL OR (l.last_seen_at>now()-interval '2 minutes' AND NOT EXISTS(SELECT 1 FROM auth.sessions a WHERE a.id=l.id)))), '[]'::jsonb) AS sessions
 FROM public.admin_computers c LEFT JOIN public.profiles p ON p.user_id=c.user_id WHERE public.is_admin(c.user_id)
 ), rows AS (
 SELECT jsonb_build_object('id',id,'device_info',device_info,'is_blocked',is_blocked,'profile',jsonb_build_object('full_name',full_name,'email',email),'sessions',sessions,'registered',true) AS item FROM tracked WHERE is_blocked OR jsonb_array_length(sessions)>0
 UNION ALL
 SELECT jsonb_build_object('id',r.id,'registered',false,'is_blocked',false,'device_info',jsonb_build_object('browser',CASE WHEN r.user_agent LIKE '%Edg%' THEN 'Edge' WHEN r.user_agent LIKE '%Firefox%' THEN 'Firefox' WHEN r.user_agent LIKE '%Chrome%' THEN 'Chrome' WHEN r.user_agent LIKE '%Safari%' THEN 'Safari' ELSE 'Navegador não identificado' END,'os',CASE WHEN r.user_agent LIKE '%Android%' THEN 'Android' WHEN r.user_agent ~ 'iPhone|iPad' THEN 'iOS' WHEN r.user_agent LIKE '%Windows%' THEN 'Windows' WHEN r.user_agent LIKE '%Mac%' THEN 'macOS' WHEN r.user_agent LIKE '%Linux%' THEN 'Linux' ELSE 'Sistema não identificado' END,'device',CASE WHEN r.user_agent ~ 'Mobile|Android|iPhone|iPad' THEN 'Mobile' ELSE 'Desktop' END),'profile',jsonb_build_object('full_name',p.full_name,'email',p.email),'sessions',jsonb_build_array(jsonb_build_object('id',r.id,'last_seen_at',r.last_seen_at)))
 FROM real_sessions r LEFT JOIN public.profiles p ON p.user_id=r.user_id WHERE NOT EXISTS(SELECT 1 FROM public.admin_login_sessions l WHERE l.id=r.id)
 ) SELECT COALESCE(jsonb_agg(item),'[]'::jsonb) INTO result FROM rows;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.list_admin_devices() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_admin_devices() TO authenticated;