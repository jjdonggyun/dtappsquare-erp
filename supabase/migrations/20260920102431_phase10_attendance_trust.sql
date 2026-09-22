begin;

insert into public.permissions(code,description) values
 ('ATTENDANCE_VERIFICATION_READ','출퇴근 검증 현황 조회'),
 ('ATTENDANCE_VERIFICATION_MANAGE','출퇴근 검증 정책·네트워크·예외 관리')
on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (r.code='ADMIN' and p.code in ('ATTENDANCE_VERIFICATION_READ','ATTENDANCE_VERIFICATION_MANAGE'))
   or (r.code='HR_MANAGER' and p.code='ATTENDANCE_VERIFICATION_READ')
on conflict do nothing;

insert into public.company_settings(key,value)
values('attendance.verification','{"mode":"DEVICE_AND_NETWORK"}'::jsonb)
on conflict(key) do nothing;

alter table public.registered_devices add column token_version integer not null default 1 check(token_version>0);
create function private.bump_device_token_version() returns trigger language plpgsql set search_path='' as $$
begin
 if new.device_token_hash is distinct from old.device_token_hash then new.token_version:=old.token_version+1; end if;
 return new;
end;
$$;
create trigger bump_device_token_version before update of device_token_hash on public.registered_devices
for each row execute function private.bump_device_token_version();

create table public.attendance_network_policies(
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 100),
 cidr cidr not null,
 active boolean not null default true,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index attendance_network_policy_name on public.attendance_network_policies(lower(name));
create index attendance_network_policy_active on public.attendance_network_policies(active) where active;
create trigger touch_attendance_network_policies before update on public.attendance_network_policies for each row execute function private.touch_versioned_row();
create trigger audit_attendance_network_policies after insert or update on public.attendance_network_policies for each row execute function private.capture_audit();

create table public.attendance_remote_exceptions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.employees(id) on delete restrict,
 kind text not null check(kind in ('REMOTE','BUSINESS_TRIP','OFFSITE')),
 starts_on date not null,ends_on date not null check(ends_on>=starts_on),
 reason text not null check(length(trim(reason)) between 2 and 500),
 approval_reference text check(approval_reference is null or length(approval_reference)<=150),
 active boolean not null default true,
 approved_by uuid not null references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index attendance_remote_exceptions_user_dates on public.attendance_remote_exceptions(user_id,starts_on,ends_on) where active;
create trigger touch_attendance_remote_exceptions before update on public.attendance_remote_exceptions for each row execute function private.touch_versioned_row();
create trigger audit_attendance_remote_exceptions after insert or update on public.attendance_remote_exceptions for each row execute function private.capture_audit();

create table public.attendance_verifications(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.employees(id) on delete restrict,
 event_type text not null check(event_type in ('CHECK_IN','CHECK_OUT')),
 mode text not null check(mode in ('OFF','DEVICE_ONLY','NETWORK_ONLY','DEVICE_AND_NETWORK','REMOTE_APPROVED')),
 client_ip inet,network_policy_id uuid references public.attendance_network_policies(id) on delete restrict,
 network_status text not null check(network_status in ('VERIFIED','FAILED','UNKNOWN','EXEMPT','NOT_REQUIRED')),
 device_id uuid references public.registered_devices(id) on delete restrict,
 device_token_version integer,
 device_status text not null default 'UNKNOWN' check(device_status in ('UNKNOWN','VERIFIED','FAILED','NOT_REQUIRED')),
 remote_exception_id uuid references public.attendance_remote_exceptions(id) on delete restrict,
 status text not null default 'PENDING' check(status in ('PENDING','READY','FAILED','CONSUMED')),
 reason_code text,
 expires_at timestamptz not null,
 consumed_at timestamptz,
 created_at timestamptz not null default now(),
 check((device_id is null)=(device_token_version is null))
);
create index attendance_verifications_user_time on public.attendance_verifications(user_id,created_at desc);
create index attendance_verifications_status_time on public.attendance_verifications(status,created_at desc);
create table public.attendance_device_nonces(
 device_id uuid not null references public.registered_devices(id) on delete restrict,
 nonce text not null check(length(nonce) between 16 and 100),
 created_at timestamptz not null default now(),
 primary key(device_id,nonce)
);
create index attendance_device_nonces_time on public.attendance_device_nonces(created_at);

alter table public.attendance_events drop constraint attendance_events_verification_type_check;
alter table public.attendance_events add constraint attendance_events_verification_type_check
 check(verification_type in ('WEB','DEVICE_AGENT','ADMIN','OFF','DEVICE_ONLY','NETWORK_ONLY','DEVICE_AND_NETWORK','REMOTE_APPROVED'));
alter table public.attendance_events add column network_policy_id uuid references public.attendance_network_policies(id) on delete restrict;
alter table public.attendance_events add column remote_exception_id uuid references public.attendance_remote_exceptions(id) on delete restrict;
alter table public.attendance_events add column verification_id uuid unique references public.attendance_verifications(id) on delete restrict;

alter table public.attendance_network_policies enable row level security;
alter table public.attendance_remote_exceptions enable row level security;
alter table public.attendance_verifications enable row level security;
alter table public.attendance_device_nonces enable row level security;
revoke all on public.attendance_network_policies,public.attendance_remote_exceptions,public.attendance_verifications,public.attendance_device_nonces from anon,authenticated;
grant select on public.attendance_network_policies,public.attendance_remote_exceptions,public.attendance_verifications to authenticated;
create policy attendance_network_read on public.attendance_network_policies for select to authenticated using(private.is_active() and private.has_permission('ATTENDANCE_VERIFICATION_READ'));
create policy attendance_remote_read on public.attendance_remote_exceptions for select to authenticated using(private.is_active() and (private.has_permission('ATTENDANCE_VERIFICATION_READ') or user_id=auth.uid()));
create policy attendance_verification_read on public.attendance_verifications for select to authenticated using(private.is_active() and (private.has_permission('ATTENDANCE_VERIFICATION_READ') or user_id=auth.uid()));

create function public.attendance_security_command(p_action text,p_payload jsonb,p_request_id text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid; current_version integer; setting_row public.company_settings;
begin
 perform private.require_permission('ATTENDANCE_VERIFICATION_MANAGE');
 perform set_config('app.request_id',left(coalesce(p_request_id,''),100),true);
 if p_action='policy.save' then
   if p_payload->>'mode' not in ('OFF','DEVICE_ONLY','NETWORK_ONLY','DEVICE_AND_NETWORK','REMOTE_APPROVED') then raise exception 'ValidationError' using errcode='22023'; end if;
   select * into setting_row from public.company_settings where key='attendance.verification' for update;
   if setting_row.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   update public.company_settings set value=jsonb_build_object('mode',p_payload->>'mode'),updated_by=auth.uid() where key='attendance.verification';
   return jsonb_build_object('message','출퇴근 검증 정책을 저장했습니다.');
 elsif p_action='network.save' then
   target:=nullif(p_payload->>'id','')::uuid;
   if target is null then
     insert into public.attendance_network_policies(name,cidr,active) values(trim(p_payload->>'name'),(p_payload->>'cidr')::cidr,(p_payload->>'active')::boolean) returning id into target;
   else
     select version into current_version from public.attendance_network_policies where id=target for update;
     if not found then raise exception 'NotFound' using errcode='P0002'; end if;
     if current_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
     update public.attendance_network_policies set name=trim(p_payload->>'name'),cidr=(p_payload->>'cidr')::cidr,active=(p_payload->>'active')::boolean where id=target;
   end if;
   return jsonb_build_object('id',target,'message','허용 네트워크를 저장했습니다.');
 elsif p_action='remote.save' then
   target:=nullif(p_payload->>'id','')::uuid;
   if p_payload->>'kind' not in ('REMOTE','BUSINESS_TRIP','OFFSITE') then raise exception 'ValidationError' using errcode='22023'; end if;
   if target is null then
     insert into public.attendance_remote_exceptions(user_id,kind,starts_on,ends_on,reason,approval_reference,active,approved_by)
     values((p_payload->>'user_id')::uuid,p_payload->>'kind',(p_payload->>'starts_on')::date,(p_payload->>'ends_on')::date,
       trim(p_payload->>'reason'),nullif(trim(p_payload->>'approval_reference'),''),(p_payload->>'active')::boolean,auth.uid()) returning id into target;
   else
     select version into current_version from public.attendance_remote_exceptions where id=target for update;
     if not found then raise exception 'NotFound' using errcode='P0002'; end if;
     if current_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
     update public.attendance_remote_exceptions set kind=p_payload->>'kind',starts_on=(p_payload->>'starts_on')::date,
       ends_on=(p_payload->>'ends_on')::date,reason=trim(p_payload->>'reason'),approval_reference=nullif(trim(p_payload->>'approval_reference'),''),
       active=(p_payload->>'active')::boolean where id=target;
   end if;
   return jsonb_build_object('id',target,'message','원격·출장 근무 예외를 저장했습니다.');
 end if;
 raise exception 'Unsupported action' using errcode='22023';
end;
$$;
revoke execute on function public.attendance_security_command(text,jsonb,text) from public,anon;
grant execute on function public.attendance_security_command(text,jsonb,text) to authenticated;

-- Only the server's protected evidence endpoints can call these functions.
-- A browser cannot assert an IP address or a device token through the Data API.
create function public.attendance_verification_prepare(p_user_id uuid,p_event_type text,p_client_ip inet)
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
   'device_status',case when state='READY' then 'NOT_REQUIRED' else 'UNKNOWN' end,'expires_in_seconds',90);
end;
$$;
revoke execute on function public.attendance_verification_prepare(uuid,text,inet) from public,anon,authenticated;
grant execute on function public.attendance_verification_prepare(uuid,text,inet) to service_role;

create function public.attendance_verification_prove_device(p_verification_id uuid,p_device_id uuid,p_device_token text,
 p_timestamp timestamptz,p_nonce text,p_client_ip inet)
returns jsonb language plpgsql security definer set search_path='' as $$
declare proof public.attendance_verifications; device_row public.registered_devices; failure_code text;
begin
 if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into proof from public.attendance_verifications where id=p_verification_id for update;
 if not found then raise exception 'NotFound' using errcode='P0002'; end if;
 if proof.status<>'PENDING' or proof.expires_at<=clock_timestamp() then
   return jsonb_build_object('accepted',false,'status','FAILED');
 end if;
 if p_timestamp is null or abs(extract(epoch from(clock_timestamp()-p_timestamp)))>60 or p_nonce is null or length(p_nonce) not between 16 and 100 then
   failure_code:='STALE_OR_INVALID_PROOF';
 elsif proof.client_ip is distinct from p_client_ip then
   failure_code:='NETWORK_SOURCE_CHANGED';
 else
   select * into device_row from public.registered_devices where device_id=p_device_id for update;
   if not found then failure_code:='UNKNOWN_DEVICE';
   elsif not device_row.active then failure_code:='REVOKED_DEVICE';
   elsif p_device_token is null or length(p_device_token)<32 or
     device_row.device_token_hash is distinct from extensions.digest(p_device_token,'sha256') then failure_code:='INVALID_CREDENTIAL';
   elsif not exists(select 1 from public.asset_assignments aa join public.assets a on a.id=aa.asset_id
     where aa.asset_id=device_row.asset_id and aa.user_id=proof.user_id and aa.returned_at is null
       and a.status in ('ASSIGNED','IN_USE') and a.asset_type in ('LAPTOP','DESKTOP')) then failure_code:='DEVICE_NOT_ASSIGNED';
   else
     insert into public.attendance_device_nonces(device_id,nonce) values(device_row.id,p_nonce) on conflict do nothing;
     if not found then failure_code:='REPLAY'; end if;
   end if;
 end if;
 if failure_code is not null then
   update public.attendance_verifications set status='FAILED',device_status='FAILED',reason_code=failure_code where id=proof.id;
   return jsonb_build_object('accepted',false,'status','FAILED');
 end if;
 update public.attendance_verifications set status='READY',device_id=device_row.id,
   device_token_version=device_row.token_version,device_status='VERIFIED' where id=proof.id;
 update public.registered_devices set last_seen_at=clock_timestamp() where id=device_row.id;
 return jsonb_build_object('accepted',true,'status','READY');
end;
$$;
revoke execute on function public.attendance_verification_prove_device(uuid,uuid,text,timestamptz,text,inet) from public,anon,authenticated;
grant execute on function public.attendance_verification_prove_device(uuid,uuid,text,timestamptz,text,inet) to service_role;

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
