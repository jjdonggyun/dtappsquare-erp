create or replace function public.attendance_verification_prepare(p_user_id uuid,p_event_type text,p_client_ip inet)
returns jsonb language plpgsql security definer set search_path='' as $$
declare mode_value text; matched_network uuid; exception_row uuid; network_state text; state text; code text; target uuid;
begin
 if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_event_type not in ('CHECK_IN','CHECK_OUT') or not exists(select 1 from public.employees where id=p_user_id and user_status='ACTIVE')
 then raise exception 'ValidationError' using errcode='22023'; end if;
 select value->>'mode' into mode_value from public.company_settings where key='attendance.verification';
 if mode_value is null then mode_value:='DEVICE_AND_NETWORK'; end if;
 select id into matched_network from public.attendance_network_policies where active and p_client_ip <<= cidr order by masklen(cidr) desc limit 1;
 select id into exception_row from public.attendance_remote_exceptions where user_id=p_user_id and active
   and (now() at time zone 'Asia/Seoul')::date between starts_on and ends_on order by created_at desc limit 1;
 network_state:=case when mode_value in ('OFF','DEVICE_ONLY') then 'NOT_REQUIRED'
   when mode_value='REMOTE_APPROVED' and exception_row is not null then 'EXEMPT'
   when matched_network is not null then 'VERIFIED'
   when exception_row is not null and mode_value='DEVICE_AND_NETWORK' then 'EXEMPT'
   when p_client_ip is null then 'UNKNOWN' else 'FAILED' end;
 code:=case when mode_value='REMOTE_APPROVED' and exception_row is null then 'REMOTE_APPROVAL_REQUIRED'
   when mode_value in ('NETWORK_ONLY','DEVICE_AND_NETWORK') and network_state not in ('VERIFIED','EXEMPT') then
     case when p_client_ip is null then 'NETWORK_SOURCE_UNKNOWN' else 'NETWORK_MISMATCH' end else null end;
 state:=case when code is not null then 'FAILED'
   when mode_value in ('OFF','NETWORK_ONLY') and network_state<>'EXEMPT' then 'READY'
   else 'PENDING' end;
 insert into public.attendance_verifications(user_id,event_type,mode,client_ip,network_policy_id,network_status,
   device_status,remote_exception_id,status,reason_code,expires_at)
 values(p_user_id,p_event_type,mode_value,p_client_ip,matched_network,network_state,
   case when mode_value in ('OFF','NETWORK_ONLY') and network_state<>'EXEMPT' then 'NOT_REQUIRED' else 'UNKNOWN' end,
   exception_row,state,code,clock_timestamp()+interval '90 seconds') returning id into target;
 return jsonb_build_object('id',target,'mode',mode_value,'status',state,'network_status',network_state,
   'device_status',case when mode_value in ('OFF','NETWORK_ONLY') and network_state<>'EXEMPT' then 'NOT_REQUIRED' else 'UNKNOWN' end,
   'expires_in_seconds',90);
end;
$$;

revoke execute on function public.attendance_verification_prepare(uuid,text,inet) from public,anon,authenticated;
grant execute on function public.attendance_verification_prepare(uuid,text,inet) to service_role;
