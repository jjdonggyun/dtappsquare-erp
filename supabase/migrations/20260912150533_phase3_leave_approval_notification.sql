begin;

create table public.approval_subjects (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type ~ '^[A-Z][A-Z0-9_]{1,60}$'),
  reference_id uuid not null,
  created_at timestamptz not null default now(),
  unique (request_type, reference_id)
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.employees(id) on delete restrict,
  leave_type text not null check (leave_type in ('ANNUAL','HALF_DAY_AM','HALF_DAY_PM','SICK','SPECIAL','OTHER')),
  start_date date not null,
  end_date date not null,
  duration numeric(6,2) not null check (duration > 0),
  reason text not null check (length(trim(reason)) between 2 and 1000),
  status text not null default 'DRAFT' check (status in ('DRAFT','REQUESTED','APPROVED','REJECTED','CANCELED')),
  approval_subject_id uuid unique references public.approval_subjects(id) on delete restrict,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (leave_type not in ('HALF_DAY_AM','HALF_DAY_PM') or (start_date = end_date and duration = 0.5))
);

create index leave_requests_user_date on public.leave_requests(user_id, start_date desc, end_date);
create index leave_requests_status_created on public.leave_requests(status, created_at desc);
alter table public.leave_requests add constraint leave_requests_no_active_overlap
  exclude using gist (
    user_id with =,
    (daterange(start_date, end_date + 1, '[)')) with &&
  ) where (status in ('REQUESTED','APPROVED'));

create table public.leave_balance_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.employees(id) on delete restrict,
  leave_type text not null check (leave_type in ('ANNUAL','SICK','SPECIAL','OTHER')),
  amount numeric(7,2) not null,
  entry_type text not null check (entry_type in ('GRANT','ADJUST','RESERVE','RELEASE','USE','CANCEL')),
  leave_request_id uuid references public.leave_requests(id) on delete restrict,
  event_key text not null unique check (length(event_key) between 12 and 160),
  memo text check (memo is null or length(memo) <= 500),
  created_by uuid not null references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((entry_type in ('RESERVE','RELEASE','USE','CANCEL')) = (leave_request_id is not null)),
  check (entry_type not in ('GRANT','ADJUST') or amount <> 0)
);

create index leave_balance_entries_user_type_time on public.leave_balance_entries(user_id, leave_type, created_at);
create index leave_balance_entries_request on public.leave_balance_entries(leave_request_id) where leave_request_id is not null;
create index leave_balance_entries_created_by on public.leave_balance_entries(created_by);

create table public.approval_routing_policies (
  id uuid primary key default gen_random_uuid(),
  request_type text not null,
  version integer not null check (version > 0),
  require_parent_approval boolean not null default false,
  conditions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_type, version)
);

create unique index approval_routing_policy_active on public.approval_routing_policies(request_type) where active;
create index approval_routing_policies_created_by on public.approval_routing_policies(created_by);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  approval_subject_id uuid not null unique references public.approval_subjects(id) on delete restrict,
  request_type text not null,
  reference_id uuid not null,
  requester_id uuid not null references public.employees(id) on delete restrict,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','CANCELED')),
  current_step_order integer not null default 1 check (current_step_order > 0),
  route_snapshot jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_type, reference_id)
);

create index approval_requests_requester_time on public.approval_requests(requester_id, created_at desc);
create index approval_requests_status_time on public.approval_requests(status, created_at desc);

create table public.approval_request_steps (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references public.approval_requests(id) on delete restrict,
  step_order integer not null check (step_order > 0),
  approver_type text not null check (approver_type in ('ORGANIZATION_LEADER','ROLE_FALLBACK','USER')),
  approver_id uuid not null references public.employees(id) on delete restrict,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','CANCELED')),
  approved_at timestamptz,
  comment text check (comment is null or length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (approval_request_id, step_order),
  unique (approval_request_id, approver_id),
  check ((status = 'PENDING' and approved_at is null) or (status <> 'PENDING' and approved_at is not null))
);

create index approval_steps_approver_status on public.approval_request_steps(approver_id, status, created_at desc);
create index approval_steps_request on public.approval_request_steps(approval_request_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.employees(id) on delete restrict,
  type text not null check (type ~ '^[A-Z][A-Z0-9_]{1,80}$'),
  title text not null check (length(title) between 1 and 160),
  message text not null check (length(message) between 1 and 2000),
  reference_type text not null,
  reference_id uuid not null,
  event_key text not null unique check (length(event_key) between 12 and 180),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_time on public.notifications(user_id, created_at desc);
create index notifications_unread on public.notifications(user_id, created_at desc) where read_at is null;

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notifications(id) on delete restrict,
  event_key text not null unique,
  recipient_user_id uuid not null references public.employees(id) on delete restrict,
  recipient_email text not null,
  template text not null,
  payload jsonb not null,
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSING','SENT','FAILED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  provider_message_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_outbox_dispatch on public.notification_outbox(status, next_attempt_at, created_at)
  where status in ('PENDING','PROCESSING');
create index notification_outbox_recipient on public.notification_outbox(recipient_user_id);

create table public.email_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references public.notification_outbox(id) on delete restrict,
  attempt integer not null check (attempt > 0),
  provider text not null,
  provider_message_id text,
  status text not null check (status in ('SENT','FAILED')),
  error_code text,
  attempted_at timestamptz not null default now(),
  unique (outbox_id, attempt)
);

create index email_delivery_attempts_outbox on public.email_delivery_attempts(outbox_id, attempted_at desc);

create or replace function private.capture_audit() returns trigger
language plpgsql security definer set search_path='' as $$
declare b jsonb; a jsonb;
begin
 if TG_OP<>'INSERT' then b=to_jsonb(old); end if;
 if TG_OP<>'DELETE' then a=to_jsonb(new); end if;
 if TG_TABLE_NAME='employees' then b=b-'phone'-'profile_image'-'email'; a=a-'phone'-'profile_image'-'email'; end if;
 if TG_TABLE_NAME='leave_requests' then b=b-'reason'; a=a-'reason'; end if;
 if TG_TABLE_NAME='approval_request_steps' then b=b-'comment'; a=a-'comment'; end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id)
 values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(a->>'id',b->>'id',a->>'user_id',b->>'user_id',a->>'role_id',b->>'role_id'),b,a,nullif(current_setting('app.request_id',true),''));
 return coalesce(new,old);
end; $$;

create trigger touch_leave_request before update on public.leave_requests
for each row execute function private.touch_row();
create trigger touch_approval_policy before update on public.approval_routing_policies
for each row execute function private.touch_row();
create trigger touch_approval_request before update on public.approval_requests
for each row execute function private.touch_row();
create trigger touch_notification_outbox before update on public.notification_outbox
for each row execute function private.touch_row();

create trigger audit_leave_requests after insert or update on public.leave_requests
for each row execute function private.capture_audit();
create trigger audit_leave_balance_entries after insert on public.leave_balance_entries
for each row execute function private.capture_audit();
create trigger audit_approval_routing_policies after insert or update on public.approval_routing_policies
for each row execute function private.capture_audit();
create trigger audit_approval_requests after insert or update on public.approval_requests
for each row execute function private.capture_audit();
create trigger audit_approval_steps after insert or update on public.approval_request_steps
for each row execute function private.capture_audit();

create function private.user_has_permission(p_user_id uuid, p_code text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.employees e
    join public.user_roles ur on ur.user_id=e.id
    join public.roles r on r.id=ur.role_id and r.active
    join public.role_permissions rp on rp.role_id=r.id
    join public.permissions p on p.id=rp.permission_id
    where e.id=p_user_id and e.user_status='ACTIVE' and p.code=p_code
  );
$$;

create function private.can_read_approval(p_approval_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.is_active() and exists(
    select 1 from public.approval_requests ar where ar.id=p_approval_id and (
      ar.requester_id=auth.uid() or private.has_permission('APPROVAL_MANAGE')
      or exists(select 1 from public.approval_request_steps s where s.approval_request_id=ar.id and s.approver_id=auth.uid())
    )
  );
$$;

create function private.can_read_leave(p_leave_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.is_active() and exists(
    select 1 from public.leave_requests l where l.id=p_leave_id and (
      l.user_id=auth.uid() or private.has_permission('LEAVE_MANAGE')
      or exists(
        select 1 from public.approval_requests ar
        join public.approval_request_steps s on s.approval_request_id=ar.id
        where ar.approval_subject_id=l.approval_subject_id and s.approver_id=auth.uid()
      )
    )
  );
$$;

create function private.can_read_approval_subject(p_subject_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.approval_requests ar where ar.approval_subject_id=p_subject_id and private.can_read_approval(ar.id));
$$;

create function private.calculate_leave_duration(
  p_user_id uuid, p_leave_type text, p_start_date date, p_end_date date
) returns numeric language plpgsql stable security definer set search_path='' as $$
declare
  policy public.work_policies;
  days numeric;
begin
  if p_end_date < p_start_date then raise exception 'invalid date range' using errcode='22023'; end if;
  policy := private.policy_for_work_date(p_user_id, p_start_date);
  select count(*)::numeric into days
  from generate_series(p_start_date, p_end_date, interval '1 day') d
  where extract(isodow from d)::smallint = any(policy.working_days);
  if days = 0 then raise exception 'leave has no working day' using errcode='22023'; end if;
  if p_leave_type in ('HALF_DAY_AM','HALF_DAY_PM') then
    if p_start_date <> p_end_date then raise exception 'half day must be one day' using errcode='22023'; end if;
    return 0.5;
  end if;
  return days;
end;
$$;

create function private.enqueue_notification(
  p_user_id uuid, p_type text, p_title text, p_message text,
  p_reference_type text, p_reference_id uuid, p_event_key text, p_template text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  notification_id uuid;
  recipient text;
begin
  insert into public.notifications(user_id,type,title,message,reference_type,reference_id,event_key)
  values(p_user_id,p_type,p_title,p_message,p_reference_type,p_reference_id,p_event_key)
  on conflict(event_key) do update set event_key=excluded.event_key
  returning id into notification_id;
  select email into recipient from public.employees where id=p_user_id and user_status='ACTIVE';
  if recipient is not null then
    insert into public.notification_outbox(
      notification_id,event_key,recipient_user_id,recipient_email,template,payload
    ) values(
      notification_id,p_event_key,p_user_id,recipient,p_template,
      jsonb_build_object('title',p_title,'message',p_message,'reference_type',p_reference_type,'reference_id',p_reference_id)
    ) on conflict(event_key) do nothing;
  end if;
  return notification_id;
end;
$$;

create function private.on_employee_status_notification()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.user_status='ACTIVE' and old.user_status is distinct from 'ACTIVE' then
    perform private.enqueue_notification(
      new.id,'ACCOUNT_APPROVED','가입 승인 완료','계정이 승인되었습니다. 업무 시스템을 이용할 수 있습니다.',
      'EMPLOYEE',new.id,'employee:'||new.id||':active:v'||new.version,'account-approved'
    );
  elsif new.user_status='REJECTED' and old.user_status is distinct from 'REJECTED' then
    perform private.enqueue_notification(
      new.id,'ACCOUNT_REJECTED','가입 요청 반려','가입 요청이 반려되었습니다. 관리자에게 문의해 주세요.',
      'EMPLOYEE',new.id,'employee:'||new.id||':rejected:v'||new.version,'account-rejected'
    );
  end if;
  return new;
end;
$$;

create trigger employee_status_notification after update of user_status on public.employees
for each row execute function private.on_employee_status_notification();

create function private.leave_approval_command(p_action text, p_payload jsonb, p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  leave_row public.leave_requests;
  approval_row public.approval_requests;
  step_row public.approval_request_steps;
  target uuid;
  subject_id uuid;
  approval_id uuid;
  duration_value numeric;
  balance_value numeric;
  balance_type text;
  route_limit integer := 1;
  route_count integer := 0;
  approver uuid;
  approver_kind text;
  next_step integer;
  snapshot jsonb;
  decision text;
  work_day date;
  day_policy public.work_policies;
begin
  perform set_config('app.request_id',coalesce(p_request_id,''),true);

  if p_action='leave.create' then
    perform private.require_permission('LEAVE_REQUEST');
    duration_value := private.calculate_leave_duration(
      auth.uid(),p_payload->>'leave_type',(p_payload->>'start_date')::date,(p_payload->>'end_date')::date
    );
    insert into public.leave_requests(user_id,leave_type,start_date,end_date,duration,reason)
    values(auth.uid(),p_payload->>'leave_type',(p_payload->>'start_date')::date,
      (p_payload->>'end_date')::date,duration_value,p_payload->>'reason')
    returning * into leave_row;
    return jsonb_build_object('id',leave_row.id,'duration',leave_row.duration,'message','휴가 초안을 저장했습니다.');

  elsif p_action='leave.submit' then
    perform private.require_permission('LEAVE_REQUEST');
    target := (p_payload->>'id')::uuid;
    select * into leave_row from public.leave_requests where id=target for update;
    if not found then raise exception 'leave not found' using errcode='P0002'; end if;
    if leave_row.user_id<>auth.uid() or leave_row.status<>'DRAFT' then raise exception 'invalid leave state' using errcode='40001'; end if;
    if leave_row.version<>(p_payload->>'version')::integer then raise exception 'stale leave version' using errcode='40001'; end if;

    duration_value := private.calculate_leave_duration(leave_row.user_id,leave_row.leave_type,leave_row.start_date,leave_row.end_date);
    balance_type := case when leave_row.leave_type in ('ANNUAL','HALF_DAY_AM','HALF_DAY_PM') then 'ANNUAL' else null end;
    if balance_type is not null then
      perform pg_advisory_xact_lock(hashtextextended(leave_row.user_id::text||':'||balance_type,0));
      select coalesce(sum(amount),0) into balance_value from public.leave_balance_entries
        where user_id=leave_row.user_id and leave_type=balance_type;
      if balance_value < duration_value then raise exception 'insufficient leave balance' using errcode='40001'; end if;
    end if;

    insert into public.approval_subjects(request_type,reference_id)
      values('LEAVE_REQUEST',leave_row.id) returning id into subject_id;
    insert into public.approval_requests(
      approval_subject_id,request_type,reference_id,requester_id,route_snapshot
    ) values(subject_id,'LEAVE_REQUEST',leave_row.id,leave_row.user_id,'[]'::jsonb)
      returning id into approval_id;

    select case when require_parent_approval then 2 else 1 end into route_limit
      from public.approval_routing_policies where request_type='LEAVE_REQUEST' and active;
    route_limit := coalesce(route_limit,1);
    for approver,approver_kind in
      with recursive ancestors as (
        select o.id,o.parent_id,o.leader_user_id,0 as depth
        from public.employees e join public.organizations o on o.id=e.organization_id
        where e.id=leave_row.user_id
        union all
        select p.id,p.parent_id,p.leader_user_id,a.depth+1
        from public.organizations p join ancestors a on p.id=a.parent_id where p.active
      ), leaders as (
        select leader_user_id,min(depth) depth from ancestors
        where leader_user_id is not null and leader_user_id<>leave_row.user_id group by leader_user_id
      )
      select leader_user_id,'ORGANIZATION_LEADER' from leaders
      where private.user_has_permission(leader_user_id,'LEAVE_APPROVE') order by depth limit route_limit
    loop
      route_count := route_count+1;
      insert into public.approval_request_steps(approval_request_id,step_order,approver_type,approver_id)
        values(approval_id,route_count,approver_kind,approver);
    end loop;

    if route_count<route_limit then
      for approver in
        select e.id from public.employees e
        where e.id<>leave_row.user_id and private.user_has_permission(e.id,'LEAVE_MANAGE')
          and not exists(select 1 from public.approval_request_steps s where s.approval_request_id=approval_id and s.approver_id=e.id)
        order by e.created_at,e.id limit (route_limit-route_count)
      loop
        route_count := route_count+1;
        insert into public.approval_request_steps(approval_request_id,step_order,approver_type,approver_id)
          values(approval_id,route_count,'ROLE_FALLBACK',approver);
      end loop;
    end if;
    if route_count<route_limit then raise exception 'approval route unavailable' using errcode='P0002'; end if;

    select jsonb_agg(jsonb_build_object('step_order',step_order,'approver_type',approver_type,'approver_id',approver_id) order by step_order)
      into snapshot from public.approval_request_steps where approval_request_id=approval_id;
    update public.approval_requests set route_snapshot=snapshot where id=approval_id;
    update public.leave_requests set status='REQUESTED',approval_subject_id=subject_id,duration=duration_value
      where id=leave_row.id returning * into leave_row;
    if balance_type is not null then
      insert into public.leave_balance_entries(user_id,leave_type,amount,entry_type,leave_request_id,event_key,created_by)
      values(leave_row.user_id,balance_type,-duration_value,'RESERVE',leave_row.id,
        'leave:'||leave_row.id||':reserve',leave_row.user_id);
    end if;
    select * into step_row from public.approval_request_steps where approval_request_id=approval_id and step_order=1;
    perform private.enqueue_notification(
      step_row.approver_id,'LEAVE_APPROVAL_REQUEST','휴가 결재 요청',
      '새 휴가 신청이 도착했습니다. 결재함에서 확인해 주세요.','APPROVAL_REQUEST',approval_id,
      'approval:'||approval_id||':step:1','leave-approval-request'
    );
    return jsonb_build_object('id',leave_row.id,'approval_request_id',approval_id,'message','휴가 신청을 제출했습니다.');

  elsif p_action='leave.cancel' then
    perform private.require_permission('LEAVE_REQUEST');
    target := (p_payload->>'id')::uuid;
    select * into leave_row from public.leave_requests where id=target for update;
    if not found then raise exception 'leave not found' using errcode='P0002'; end if;
    if leave_row.user_id<>auth.uid() or leave_row.status not in ('DRAFT','REQUESTED') then raise exception 'invalid leave state' using errcode='40001'; end if;
    if leave_row.version<>(p_payload->>'version')::integer then raise exception 'stale leave version' using errcode='40001'; end if;
    if leave_row.status='REQUESTED' then
      select * into approval_row from public.approval_requests where approval_subject_id=leave_row.approval_subject_id for update;
      update public.approval_request_steps set status='CANCELED',approved_at=now()
        where approval_request_id=approval_row.id and status='PENDING';
      update public.approval_requests set status='CANCELED',version=version+1 where id=approval_row.id;
      balance_type := case when leave_row.leave_type in ('ANNUAL','HALF_DAY_AM','HALF_DAY_PM') then 'ANNUAL' else null end;
      if balance_type is not null then
        insert into public.leave_balance_entries(user_id,leave_type,amount,entry_type,leave_request_id,event_key,created_by)
        values(leave_row.user_id,balance_type,leave_row.duration,'RELEASE',leave_row.id,
          'leave:'||leave_row.id||':cancel-release',auth.uid());
      end if;
    end if;
    update public.leave_requests set status='CANCELED' where id=leave_row.id returning * into leave_row;
    return jsonb_build_object('id',leave_row.id,'message','휴가 신청을 취소했습니다.');

  elsif p_action='approval.decide' then
    perform private.require_permission('LEAVE_APPROVE');
    target := (p_payload->>'id')::uuid;
    decision := p_payload->>'decision';
    select * into approval_row from public.approval_requests where id=target for update;
    if not found then raise exception 'approval not found' using errcode='P0002'; end if;
    if approval_row.status<>'PENDING' or approval_row.version<>(p_payload->>'version')::integer then raise exception 'stale approval state' using errcode='40001'; end if;
    select * into step_row from public.approval_request_steps
      where approval_request_id=approval_row.id and step_order=approval_row.current_step_order for update;
    if step_row.approver_id<>auth.uid() or step_row.status<>'PENDING' then raise exception 'not current approver' using errcode='42501'; end if;
    select * into leave_row from public.leave_requests where id=approval_row.reference_id for update;
    if approval_row.request_type<>'LEAVE_REQUEST' or leave_row.status<>'REQUESTED' then raise exception 'invalid approval subject' using errcode='40001'; end if;

    if decision='REJECTED' then
      update public.approval_request_steps set status='REJECTED',approved_at=now(),comment=nullif(p_payload->>'comment','') where id=step_row.id;
      update public.approval_request_steps set status='CANCELED',approved_at=now()
        where approval_request_id=approval_row.id and step_order>approval_row.current_step_order and status='PENDING';
      update public.approval_requests set status='REJECTED',version=version+1 where id=approval_row.id;
      update public.leave_requests set status='REJECTED' where id=leave_row.id;
      balance_type := case when leave_row.leave_type in ('ANNUAL','HALF_DAY_AM','HALF_DAY_PM') then 'ANNUAL' else null end;
      if balance_type is not null then
        insert into public.leave_balance_entries(user_id,leave_type,amount,entry_type,leave_request_id,event_key,created_by)
        values(leave_row.user_id,balance_type,leave_row.duration,'RELEASE',leave_row.id,
          'leave:'||leave_row.id||':rejected-release',auth.uid());
      end if;
      perform private.enqueue_notification(
        leave_row.user_id,'LEAVE_REJECTED','휴가 신청 반려','휴가 신청이 반려되었습니다. 결재 의견을 확인해 주세요.',
        'LEAVE_REQUEST',leave_row.id,'leave:'||leave_row.id||':rejected','leave-rejected'
      );
      return jsonb_build_object('id',approval_row.id,'message','휴가 신청을 반려했습니다.');
    elsif decision<>'APPROVED' then
      raise exception 'invalid decision' using errcode='22023';
    end if;

    update public.approval_request_steps set status='APPROVED',approved_at=now(),comment=nullif(p_payload->>'comment','') where id=step_row.id;
    select min(step_order) into next_step from public.approval_request_steps
      where approval_request_id=approval_row.id and step_order>approval_row.current_step_order and status='PENDING';
    if next_step is not null then
      update public.approval_requests set current_step_order=next_step,version=version+1 where id=approval_row.id;
      select * into step_row from public.approval_request_steps where approval_request_id=approval_row.id and step_order=next_step;
      perform private.enqueue_notification(
        step_row.approver_id,'LEAVE_APPROVAL_REQUEST','휴가 결재 요청',
        '이전 결재가 완료되었습니다. 결재함에서 다음 단계를 확인해 주세요.','APPROVAL_REQUEST',approval_row.id,
        'approval:'||approval_row.id||':step:'||next_step,'leave-approval-request'
      );
      return jsonb_build_object('id',approval_row.id,'message','승인했습니다. 다음 결재 단계로 이동했습니다.');
    end if;

    update public.approval_requests set status='APPROVED',version=version+1 where id=approval_row.id;
    update public.leave_requests set status='APPROVED' where id=leave_row.id;
    for work_day in select generate_series(leave_row.start_date,leave_row.end_date,interval '1 day')::date loop
      day_policy := private.policy_for_work_date(leave_row.user_id,work_day);
      if extract(isodow from work_day)::smallint=any(day_policy.working_days) then
        perform private.calculate_attendance_summary(leave_row.user_id,work_day);
        update public.attendance_daily_summaries set
          attendance_status=case when leave_row.leave_type in ('HALF_DAY_AM','HALF_DAY_PM') then 'HALF_DAY' else 'VACATION' end,
          status_flags=case when leave_row.leave_type in ('HALF_DAY_AM','HALF_DAY_PM') then array['HALF_DAY'] else array['VACATION'] end
        where user_id=leave_row.user_id and work_date=work_day;
      end if;
    end loop;
    balance_type := case when leave_row.leave_type in ('ANNUAL','HALF_DAY_AM','HALF_DAY_PM') then 'ANNUAL' else null end;
    if balance_type is not null then
      insert into public.leave_balance_entries(user_id,leave_type,amount,entry_type,leave_request_id,event_key,created_by)
      values(leave_row.user_id,balance_type,0,'USE',leave_row.id,'leave:'||leave_row.id||':use',auth.uid());
    end if;
    perform private.enqueue_notification(
      leave_row.user_id,'LEAVE_APPROVED','휴가 신청 승인','휴가 신청의 모든 결재가 완료되었습니다.',
      'LEAVE_REQUEST',leave_row.id,'leave:'||leave_row.id||':approved','leave-approved'
    );
    return jsonb_build_object('id',approval_row.id,'message','최종 승인했습니다.');

  elsif p_action='leave.balance.adjust' then
    perform private.require_permission('LEAVE_MANAGE');
    target := (p_payload->>'user_id')::uuid;
    if not exists(select 1 from public.employees where id=target and user_status='ACTIVE') then raise exception 'employee not found' using errcode='P0002'; end if;
    insert into public.leave_balance_entries(user_id,leave_type,amount,entry_type,event_key,memo,created_by)
    values(target,p_payload->>'leave_type',(p_payload->>'amount')::numeric,
      case when (p_payload->>'entry_type')='GRANT' then 'GRANT' else 'ADJUST' end,
      'balance:'||target||':'||p_request_id,nullif(p_payload->>'memo',''),auth.uid()) returning id into target;
    return jsonb_build_object('id',target,'message','휴가 잔액 원장을 반영했습니다.');

  elsif p_action='notification.read' then
    perform private.require_permission('NOTIFICATION_READ_SELF');
    target := (p_payload->>'id')::uuid;
    update public.notifications set read_at=coalesce(read_at,now()) where id=target and user_id=auth.uid();
    if not found then raise exception 'notification not found' using errcode='P0002'; end if;
    return jsonb_build_object('id',target,'message','알림을 읽음 처리했습니다.');
  end if;
  raise exception 'unsupported leave approval action' using errcode='22023';
end;
$$;

create function public.leave_approval_command(p_action text,p_payload jsonb,p_request_id text default null)
returns jsonb language sql security definer set search_path='' as $$
  select private.leave_approval_command(p_action,p_payload,p_request_id);
$$;

create function private.claim_notification_outbox()
returns setof public.notification_outbox language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  return query
  with candidate as (
    select id from public.notification_outbox
    where (status='PENDING' and next_attempt_at<=now())
       or (status='PROCESSING' and lease_until<now())
    order by created_at for update skip locked limit 1
  )
  update public.notification_outbox o set
    status='PROCESSING',attempt_count=o.attempt_count+1,lease_until=now()+interval '5 minutes'
  from candidate where o.id=candidate.id returning o.*;
end;
$$;

create function public.claim_notification_outbox()
returns setof public.notification_outbox language sql security definer set search_path='' as $$
  select * from private.claim_notification_outbox();
$$;

create function private.complete_notification_outbox(
  p_id uuid,p_success boolean,p_provider text,p_provider_message_id text,p_error_code text
) returns void language plpgsql security definer set search_path='' as $$
declare row_data public.notification_outbox;
begin
  if auth.role()<>'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  select * into row_data from public.notification_outbox where id=p_id and status='PROCESSING' for update;
  if not found then raise exception 'outbox lease unavailable' using errcode='40001'; end if;
  insert into public.email_delivery_attempts(outbox_id,attempt,provider,provider_message_id,status,error_code)
    values(row_data.id,row_data.attempt_count,p_provider,nullif(p_provider_message_id,''),
      case when p_success then 'SENT' else 'FAILED' end,nullif(p_error_code,''));
  if p_success then
    update public.notification_outbox set status='SENT',lease_until=null,
      provider_message_id=nullif(p_provider_message_id,''),last_error_code=null where id=p_id;
  elsif row_data.attempt_count>=row_data.max_attempts then
    update public.notification_outbox set status='FAILED',lease_until=null,last_error_code=coalesce(nullif(p_error_code,''),'PROVIDER_ERROR') where id=p_id;
  else
    update public.notification_outbox set status='PENDING',lease_until=null,
      next_attempt_at=now()+make_interval(mins=>power(2,least(row_data.attempt_count,10))::integer),
      last_error_code=coalesce(nullif(p_error_code,''),'PROVIDER_ERROR') where id=p_id;
  end if;
end;
$$;

create function public.complete_notification_outbox(
  p_id uuid,p_success boolean,p_provider text,p_provider_message_id text default null,p_error_code text default null
) returns void language sql security definer set search_path='' as $$
  select private.complete_notification_outbox(p_id,p_success,p_provider,p_provider_message_id,p_error_code);
$$;

alter table public.approval_subjects enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_balance_entries enable row level security;
alter table public.approval_routing_policies enable row level security;
alter table public.approval_requests enable row level security;
alter table public.approval_request_steps enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.email_delivery_attempts enable row level security;

create policy leave_request_read on public.leave_requests for select to authenticated using(
  (select private.can_read_leave(id))
);
create policy leave_balance_read on public.leave_balance_entries for select to authenticated using(
  (select private.is_active()) and (user_id=(select auth.uid()) or (select private.has_permission('LEAVE_MANAGE')))
);
create policy approval_subject_read on public.approval_subjects for select to authenticated using(
  (select private.can_read_approval_subject(id))
);
create policy approval_request_read on public.approval_requests for select to authenticated using(
  (select private.can_read_approval(id))
);
create policy approval_step_read on public.approval_request_steps for select to authenticated using(
  (select private.can_read_approval(approval_request_id))
);
create policy approval_policy_read on public.approval_routing_policies for select to authenticated using(
  (select private.has_permission('APPROVAL_MANAGE'))
);
create policy notification_read on public.notifications for select to authenticated using(
  (select private.is_active()) and user_id=(select auth.uid())
);

grant select on public.approval_subjects,public.leave_requests,public.leave_balance_entries,
  public.approval_routing_policies,public.approval_requests,public.approval_request_steps,
  public.notifications to authenticated;
revoke insert,update,delete,truncate,references,trigger on public.approval_subjects,
  public.leave_requests,public.leave_balance_entries,public.approval_routing_policies,
  public.approval_requests,public.approval_request_steps,public.notifications,
  public.notification_outbox,public.email_delivery_attempts from anon,authenticated;
revoke all on public.notification_outbox,public.email_delivery_attempts from anon,authenticated;
grant execute on function public.leave_approval_command(text,jsonb,text) to authenticated;
grant execute on function private.can_read_approval(uuid),private.can_read_leave(uuid),
  private.can_read_approval_subject(uuid) to authenticated;
grant execute on function public.claim_notification_outbox(),
  public.complete_notification_outbox(uuid,boolean,text,text,text) to service_role;
revoke execute on function private.user_has_permission(uuid,text),
  private.calculate_leave_duration(uuid,text,date,date),
  private.enqueue_notification(uuid,text,text,text,text,uuid,text,text),
  private.on_employee_status_notification(),
  private.leave_approval_command(text,jsonb,text),private.claim_notification_outbox(),
  private.complete_notification_outbox(uuid,boolean,text,text,text)
  from public,anon,authenticated;
revoke execute on function private.can_read_approval(uuid),private.can_read_leave(uuid),
  private.can_read_approval_subject(uuid) from public,anon;
revoke execute on function public.claim_notification_outbox(),
  public.complete_notification_outbox(uuid,boolean,text,text,text) from public,anon,authenticated;

insert into public.approval_routing_policies(
  id,request_type,version,require_parent_approval,conditions,active
) values(
  '40000000-0000-4000-8000-000000000001','LEAVE_REQUEST',1,false,
  '{"description":"소속 조직의 첫 유효 리더, 부재 시 휴가 관리자"}'::jsonb,true
);

commit;
