begin;

-- Account-specific grants and denials are changed only through this audited RPC.
create function private.user_permission_command(p_user_id uuid,p_permission_code text,p_action text,p_data_scope text,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_permission_id uuid;
begin
 perform private.require_permission('RBAC_MANAGE');
 if p_user_id=auth.uid() then raise exception using errcode='42501',message='Self permission change is forbidden'; end if;
 if not exists(select 1 from public.employees where id=p_user_id and user_status='ACTIVE') then
  raise exception using errcode='P0002',message='Active user not found';
 end if;
 select id into v_permission_id from public.permissions where code=p_permission_code;
 if v_permission_id is null then raise exception using errcode='22023',message='Unknown permission'; end if;
 perform set_config('app.request_id',left(coalesce(p_request_id,''),100),true);
 if p_action='clear' then
  delete from public.user_permission_overrides u where u.user_id=p_user_id and u.permission_id=v_permission_id;
 elsif p_action in ('grant','deny') then
  if p_action='grant' and p_data_scope not in ('SELF','TEAM','ASSIGNED_PROJECT','DEPARTMENT','ALL') then
   raise exception using errcode='22023',message='Data scope is required';
  end if;
  insert into public.user_permission_overrides(user_id,permission_id,allowed,data_scope,granted_by)
   values(p_user_id,v_permission_id,p_action='grant',case when p_action='grant' then p_data_scope else null end,auth.uid())
   on conflict(user_id,permission_id) do update set allowed=excluded.allowed,
    data_scope=excluded.data_scope,granted_by=excluded.granted_by,updated_at=now();
 else
  raise exception using errcode='22023',message='Invalid permission action';
 end if;
 return jsonb_build_object('user_id',p_user_id,'permission_code',p_permission_code,'action',p_action);
end; $$;
create function public.user_permission_command(p_user_id uuid,p_permission_code text,p_action text,p_data_scope text default null,p_request_id text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select private.user_permission_command(p_user_id,p_permission_code,p_action,p_data_scope,p_request_id);
$$;
revoke all on function private.user_permission_command(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.user_permission_command(uuid,text,text,text,text) from public,anon;
grant execute on function private.user_permission_command(uuid,text,text,text,text),
 public.user_permission_command(uuid,text,text,text,text) to authenticated;

-- Legacy technical-role accounts continue to use the existing leave route until assigned
-- a business role. This keeps current requests operational during migration.
create or replace function private.leave_approvers(p_requester uuid)
returns table(step_order integer,approver_type text,approver_id uuid)
language plpgsql stable security definer set search_path='' as $route$
declare role_code text; leader uuid; administrator uuid; head_user uuid;
begin
 select r.code into role_code from public.user_roles ur join public.roles r on r.id=ur.role_id and r.active
 where ur.user_id=p_requester and r.code in ('HEAD','ADMINISTRATIVE_POSITION','TEAM_LEADER','MEMBER')
 order by case r.code when 'HEAD' then 4 when 'ADMINISTRATIVE_POSITION' then 3
  when 'TEAM_LEADER' then 2 else 1 end desc limit 1;
 if role_code='HEAD' then return; end if;
 select e.id into administrator from public.employees e
 join public.user_roles ur on ur.user_id=e.id join public.roles r on r.id=ur.role_id and r.active
 where r.code='ADMINISTRATIVE_POSITION' and e.id<>p_requester
  and private.user_has_permission(e.id,'LEAVE_FINAL_APPROVE')
 order by e.created_at,e.id limit 1;
 if administrator is null then
  select e.id into administrator from public.employees e
  join public.user_roles ur on ur.user_id=e.id join public.roles r on r.id=ur.role_id and r.active
  where r.code in ('HR_MANAGER','ADMIN') and e.id<>p_requester
   and private.user_has_permission(e.id,'LEAVE_MANAGE')
  order by e.created_at,e.id limit 1;
 end if;
 select e.id into head_user from public.employees e
 join public.user_roles ur on ur.user_id=e.id join public.roles r on r.id=ur.role_id and r.active
 where r.code='HEAD' and e.id<>p_requester and private.user_has_permission(e.id,'LEAVE_FINAL_APPROVE')
 order by e.created_at,e.id limit 1;
 if role_code='ADMINISTRATIVE_POSITION' then
  if head_user is null then raise exception 'Head approval route unavailable' using errcode='P0002'; end if;
  return query select 1,'USER'::text,head_user;
  return;
 end if;
 if role_code='MEMBER' and exists(select 1 from public.user_roles ur
  join public.roles r on r.id=ur.role_id where ur.user_id=p_requester and r.code in ('ADMIN','HR_MANAGER')) then
  select e.id into leader from public.employees e where e.id<>p_requester
   and private.user_has_permission(e.id,'LEAVE_APPROVE') order by e.created_at,e.id limit 1;
  if leader is null then raise exception 'legacy approval route unavailable' using errcode='P0002'; end if;
  return query select 1,'ROLE_FALLBACK'::text,leader;
  return;
 end if;
 if role_code='TEAM_LEADER' then
  if administrator is null then administrator:=head_user; end if;
  if administrator is null then raise exception 'final approval route unavailable' using errcode='P0002'; end if;
  return query select 1,'ROLE_FALLBACK'::text,administrator;
  return;
 end if;
 if role_code is distinct from 'MEMBER' then raise exception 'business role required' using errcode='P0002'; end if;
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

commit;
