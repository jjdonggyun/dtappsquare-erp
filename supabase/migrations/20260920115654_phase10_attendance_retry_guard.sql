begin;

create or replace function private.attendance_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy public.work_policies; event_row public.attendance_events; summary public.attendance_daily_summaries;
  proof public.attendance_verifications; device_row public.registered_devices;
  moment timestamptz:=clock_timestamp(); work_day date; event_kind text; current_mode text;
begin
 perform private.require_permission('ATTENDANCE_READ_SELF');
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_action not in ('attendance.check_in','attendance.check_out')
 then raise exception 'ValidationError' using errcode='22023'; end if;
 if p_request_id is null or length(p_request_id) not between 16 and 100 then raise exception 'ValidationError' using errcode='22023'; end if;
 perform set_config('app.request_id',p_request_id,true);
 policy:=private.resolve_work_policy(auth.uid(),moment);
 work_day:=(moment at time zone policy.timezone)::date;
 event_kind:=case when p_action='attendance.check_in' then 'CHECK_IN' else 'CHECK_OUT' end;
 select * into event_row from public.attendance_events where user_id=auth.uid() and idempotency_key=p_request_id;
 if found then
   if event_row.event_type<>event_kind then raise exception 'Idempotency key already used for another action' using errcode='22023'; end if;
   summary:=private.calculate_attendance_summary(auth.uid(),event_row.work_date);
   return jsonb_build_object('message','이미 기록된 요청입니다.','event_id',event_row.id,'work_date',event_row.work_date,'status',summary.attendance_status);
 end if;
 if event_kind='CHECK_OUT' and not exists(select 1 from public.attendance_events
   where user_id=auth.uid() and work_date=work_day and event_type='CHECK_IN')
 then raise exception 'check-in is required' using errcode='40001'; end if;
 select coalesce(value->>'mode','DEVICE_AND_NETWORK') into current_mode from public.company_settings where key='attendance.verification';
 current_mode:=coalesce(current_mode,'DEVICE_AND_NETWORK');
 if nullif(p_payload->>'verification_id','') is not null then
   select * into proof from public.attendance_verifications where id=(p_payload->>'verification_id')::uuid for update;
   if found and proof.status='CONSUMED' then
     select * into event_row from public.attendance_events where user_id=auth.uid() and idempotency_key=p_request_id and verification_id=proof.id;
     if found and event_row.event_type=event_kind then
       summary:=private.calculate_attendance_summary(auth.uid(),event_row.work_date);
       return jsonb_build_object('message','이미 기록된 요청입니다.','event_id',event_row.id,'work_date',event_row.work_date,'status',summary.attendance_status);
     end if;
     raise exception 'Attendance verification already consumed' using errcode='42501';
   end if;
   if not found or proof.user_id<>auth.uid() or proof.event_type<>event_kind or proof.mode<>current_mode
     or proof.status<>'READY' or proof.expires_at<=moment or proof.consumed_at is not null
   then raise exception 'Attendance verification failed' using errcode='42501'; end if;
   if current_mode in ('DEVICE_ONLY','DEVICE_AND_NETWORK','REMOTE_APPROVED') or proof.network_status='EXEMPT' then
     if proof.device_status<>'VERIFIED' or proof.device_id is null then raise exception 'Device verification failed' using errcode='42501'; end if;
     select * into device_row from public.registered_devices where id=proof.device_id for update;
     if not found or not device_row.active or device_row.token_version<>proof.device_token_version or
       not exists(select 1 from public.asset_assignments aa join public.assets a on a.id=aa.asset_id
         where aa.asset_id=device_row.asset_id and aa.user_id=auth.uid() and aa.returned_at is null
           and a.status in ('ASSIGNED','IN_USE') and a.asset_type in ('LAPTOP','DESKTOP'))
     then raise exception 'Device verification expired' using errcode='42501'; end if;
   end if;
   if proof.network_status='VERIFIED' and not exists(
     select 1 from public.attendance_network_policies np where np.id=proof.network_policy_id and np.active
       and proof.client_ip <<= np.cidr
   ) then raise exception 'Network verification expired' using errcode='42501'; end if;
   if current_mode in ('NETWORK_ONLY','DEVICE_AND_NETWORK') and proof.network_status not in ('VERIFIED','EXEMPT')
   then raise exception 'Network verification failed' using errcode='42501'; end if;
   if current_mode='REMOTE_APPROVED' and proof.remote_exception_id is null
   then raise exception 'Remote approval required' using errcode='42501'; end if;
   if proof.remote_exception_id is not null and proof.network_status='EXEMPT' and not exists(
     select 1 from public.attendance_remote_exceptions x where x.id=proof.remote_exception_id and x.active
       and work_day between x.starts_on and x.ends_on)
   then raise exception 'Remote approval expired' using errcode='42501'; end if;
 else
   if current_mode<>'OFF' then raise exception 'Attendance verification required' using errcode='42501'; end if;
 end if;
 insert into public.attendance_events(user_id,work_policy_id,work_date,event_type,occurred_at,device_id,ip_address,
   verification_type,verification_status,idempotency_key,network_policy_id,remote_exception_id,verification_id)
 values(auth.uid(),policy.id,work_day,event_kind,moment,
   case when proof.device_id is null then null else device_row.device_id end,
   proof.client_ip,current_mode,'VERIFIED',p_request_id,proof.network_policy_id,
   case when proof.network_status='EXEMPT' then proof.remote_exception_id else null end,proof.id)
 returning * into event_row;
 if proof.id is not null then update public.attendance_verifications set status='CONSUMED',consumed_at=moment where id=proof.id; end if;
 summary:=private.calculate_attendance_summary(auth.uid(),event_row.work_date);
 return jsonb_build_object('message',case when event_kind='CHECK_IN' then '출근이 기록되었습니다.' else '퇴근이 기록되었습니다.' end,
   'event_id',event_row.id,'work_date',event_row.work_date,'status',summary.attendance_status);
end;
$$;

commit;
