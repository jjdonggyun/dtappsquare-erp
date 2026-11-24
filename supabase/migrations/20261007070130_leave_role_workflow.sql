begin;
alter table public.approval_request_steps add column rejected_at timestamptz;
alter table public.approval_request_steps add constraint approval_step_rejection_reason
 check(status<>'REJECTED' or (rejected_at is not null and length(trim(coalesce(comment,'')))>=2)) not valid;

create function private.leave_approvers(p_requester uuid)
returns table(step_order integer,approver_type text,approver_id uuid)
language plpgsql stable security definer set search_path='' as $route$
declare role_code text; leader uuid; administrator uuid; head_user uuid;
begin
 select r.code into role_code from public.user_roles ur join public.roles r on r.id=ur.role_id and r.active
 where ur.user_id=p_requester and r.code in ('HEAD','ADMINISTRATIVE_POSITION','TEAM_LEADER','MEMBER')
 order by case r.code when 'HEAD' then 4 when 'ADMINISTRATIVE_POSITION' then 3
  when 'TEAM_LEADER' then 2 else 1 end desc limit 1;
 if role_code is null then raise exception 'business role required for leave approval' using errcode='P0002'; end if;
 if role_code='HEAD' then return; end if;
 select e.id into administrator from public.employees e
 join public.user_roles ur on ur.user_id=e.id join public.roles r on r.id=ur.role_id and r.active
 where r.code='ADMINISTRATIVE_POSITION' and e.id<>p_requester
  and private.user_has_permission(e.id,'LEAVE_FINAL_APPROVE')
 order by e.created_at,e.id limit 1;
 select e.id into head_user from public.employees e
 join public.user_roles ur on ur.user_id=e.id join public.roles r on r.id=ur.role_id and r.active
 where r.code='HEAD' and e.id<>p_requester and private.user_has_permission(e.id,'LEAVE_FINAL_APPROVE')
 order by e.created_at,e.id limit 1;
 if role_code='ADMINISTRATIVE_POSITION' then
   if head_user is null then raise exception 'Head approval route unavailable' using errcode='P0002'; end if;
   return query select 1,'USER'::text,head_user;
   return;
 end if;
 if role_code='TEAM_LEADER' then
   if administrator is null then administrator:=head_user; end if;
   if administrator is null then raise exception 'final approval route unavailable' using errcode='P0002'; end if;
   return query select 1,'ROLE_FALLBACK'::text,administrator;
   return;
 end if;
 with recursive ancestry as (
   select o.id,o.parent_id,o.leader_user_id,o.organization_type,0 depth
   from public.employees e join public.organizations o on o.id=e.organization_id where e.id=p_requester
   union all
   select o.id,o.parent_id,o.leader_user_id,o.organization_type,a.depth+1
   from public.organizations o join ancestry a on a.parent_id=o.id where o.active
 )
 select a.leader_user_id into leader from ancestry a
 where a.organization_type='TEAM' and a.leader_user_id<>p_requester
  and private.user_has_permission(a.leader_user_id,'LEAVE_TEAM_APPROVE')
 order by a.depth limit 1;
 if leader is null or administrator is null or leader=administrator then
   raise exception 'team and final approval route unavailable' using errcode='P0002';
 end if;
 return query select 1,'ORGANIZATION_LEADER'::text,leader
 union all select 2,'ROLE_FALLBACK'::text,administrator;
end;
$route$;
revoke all on function private.leave_approvers(uuid) from public,anon,authenticated;

create or replace function private.leave_approval_command(p_action text, p_payload jsonb, p_request_id text)
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
    if exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id and r.active
      where ur.user_id=leave_row.user_id and r.code='HEAD')
      and private.user_has_permission(leave_row.user_id,'APPROVAL_BYPASS') then
      update public.approval_requests set status='APPROVED',
        route_snapshot=jsonb_build_array(jsonb_build_object('policy','HEAD_BYPASS','reason','AUTO_APPROVED_BY_POLICY'))
        where id=approval_id;
      update public.leave_requests set status='APPROVED',approval_subject_id=subject_id,duration=duration_value
        where id=leave_row.id returning * into leave_row;
      if balance_type is not null then
        insert into public.leave_balance_entries(user_id,leave_type,amount,entry_type,leave_request_id,event_key,created_by)
        values(leave_row.user_id,balance_type,-duration_value,'RESERVE',leave_row.id,
          'leave:'||leave_row.id||':reserve',leave_row.user_id);
        insert into public.leave_balance_entries(user_id,leave_type,amount,entry_type,leave_request_id,event_key,created_by)
        values(leave_row.user_id,balance_type,0,'USE',leave_row.id,
          'leave:'||leave_row.id||':use',leave_row.user_id);
      end if;
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
      insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id)
      values(auth.uid(),'HEAD_BYPASS','leave_requests',leave_row.id::text,
        jsonb_build_object('status','DRAFT'),
        jsonb_build_object('status','APPROVED','reason','AUTO_APPROVED_BY_POLICY','approval_request_id',approval_id),
        left(coalesce(p_request_id,''),100));
      return jsonb_build_object('id',leave_row.id,'approval_request_id',approval_id,
        'message','회사 정책에 따라 자동 승인했습니다.');
    end if;

    for next_step, approver_kind, approver in
      select step_order,approver_type,approver_id from private.leave_approvers(leave_row.user_id)
    loop
      route_count := route_count+1;
      insert into public.approval_request_steps(approval_request_id,step_order,approver_type,approver_id)
      values(approval_id,next_step,approver_kind,approver);
    end loop;
    if route_count=0 then raise exception 'approval route unavailable' using errcode='P0002'; end if;

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
      if length(trim(coalesce(p_payload->>'comment','')))<2 then
        raise exception 'rejection reason required' using errcode='22023';
      end if;
      update public.approval_request_steps set status='REJECTED',approved_at=now(),rejected_at=now(),comment=nullif(p_payload->>'comment','') where id=step_row.id;
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

commit;
