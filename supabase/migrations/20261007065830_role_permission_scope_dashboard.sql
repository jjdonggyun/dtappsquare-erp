begin;

-- Keep the legacy technical roles while introducing the company's business roles.
insert into public.roles(code,name,system) values
 ('GUEST','Guest',true),('MEMBER','Member',true),('TEAM_LEADER','Team Leader',true),
 ('ADMINISTRATIVE_POSITION','Administrative Position',true),('HEAD','Head',true)
on conflict(code) do nothing;

create table public.role_inheritance (
 role_id uuid not null references public.roles(id) on delete restrict,
 inherited_role_id uuid not null references public.roles(id) on delete restrict,
 primary key(role_id,inherited_role_id),
 check(role_id<>inherited_role_id)
);
create index role_inheritance_parent on public.role_inheritance(inherited_role_id);
insert into public.role_inheritance(role_id,inherited_role_id)
select child.id,parent.id from (values
 ('MEMBER','GUEST'),('TEAM_LEADER','MEMBER'),
 ('ADMINISTRATIVE_POSITION','TEAM_LEADER'),('HEAD','ADMINISTRATIVE_POSITION')
) relation(child_code,parent_code)
join public.roles child on child.code=relation.child_code
join public.roles parent on parent.code=relation.parent_code;

create table public.role_permission_scopes (
 role_id uuid not null references public.roles(id) on delete cascade,
 permission_id uuid not null references public.permissions(id) on delete restrict,
 data_scope text not null check(data_scope in ('SELF','TEAM','ASSIGNED_PROJECT','DEPARTMENT','ALL')),
 primary key(role_id,permission_id,data_scope)
);
create index role_permission_scopes_permission on public.role_permission_scopes(permission_id,data_scope);

create table public.user_permission_overrides (
 user_id uuid not null references public.employees(id) on delete restrict,
 permission_id uuid not null references public.permissions(id) on delete restrict,
 allowed boolean not null,
 data_scope text check(data_scope in ('SELF','TEAM','ASSIGNED_PROJECT','DEPARTMENT','ALL')),
 granted_by uuid references public.employees(id) on delete restrict,
 updated_at timestamptz not null default now(),
 primary key(user_id,permission_id),
 check(not allowed or data_scope is not null)
);
create index user_permission_overrides_permission on public.user_permission_overrides(permission_id);

alter table public.role_inheritance enable row level security;
alter table public.role_permission_scopes enable row level security;
alter table public.user_permission_overrides enable row level security;
grant select on public.role_inheritance,public.role_permission_scopes,public.user_permission_overrides to authenticated;
create policy role_inheritance_read on public.role_inheritance for select to authenticated using((select private.is_active()));
create policy role_permission_scopes_read on public.role_permission_scopes for select to authenticated using((select private.is_active()));
create policy user_permission_overrides_read on public.user_permission_overrides for select to authenticated
 using((select private.is_active()) and (user_id=(select auth.uid()) or (select private.has_permission('RBAC_MANAGE'))));
create trigger audit_role_inheritance after insert or update or delete on public.role_inheritance
 for each row execute function private.capture_audit();
create trigger audit_role_permission_scopes after insert or update or delete on public.role_permission_scopes
 for each row execute function private.capture_audit();
create trigger audit_user_permission_overrides after insert or update or delete on public.user_permission_overrides
 for each row execute function private.capture_audit();

insert into public.permissions(code,description) values
 ('LEAVE_TEAM_APPROVE','팀 휴가 1차 승인'),
 ('LEAVE_FINAL_APPROVE','휴가 최종 승인'),
 ('APPROVAL_BYPASS','정책에 따른 자기 결재 생략'),
 ('PROJECT_BASIC_FINANCE_READ','프로젝트 기본 비용 조회'),
 ('EMPLOYEE_COST_READ','직원별 인건비 조회')
on conflict(code) do nothing;

-- Base permissions are explicit; inheritance composes them at read time.
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where
 (r.code='GUEST' and p.code in ('PROFILE_READ_SELF','PROFILE_WRITE_SELF','NOTIFICATION_READ_SELF'))
 or (r.code='MEMBER' and p.code in (
  'ATTENDANCE_READ_SELF','LEAVE_REQUEST','APPROVAL_READ_SELF','ASSET_READ_SELF',
  'PROJECT_READ_SELF','PROJECT_DOCUMENT_READ','WORK_LOG_READ_SELF','WORK_LOG_WRITE_SELF',
  'WEEKLY_REPORT_READ_SELF','WEEKLY_REPORT_WRITE_SELF','EXPENSE_READ_SELF','EXPENSE_WRITE_SELF',
  'WORKFORCE_PROFILE_READ_SELF'))
 or (r.code='TEAM_LEADER' and p.code in (
  'USER_READ_TEAM','USER_APPROVE','ATTENDANCE_READ_TEAM','LEAVE_APPROVE','LEAVE_TEAM_APPROVE',
  'PROJECT_READ','PROJECT_WRITE','PROJECT_RESOURCE_MANAGE','PROJECT_STAFFING_READ',
  'PROJECT_STAFFING_MANAGE','RESOURCE_READ','WORKFORCE_PROFILE_READ_TEAM',
  'EXPENSE_READ_PROJECT','PROJECT_BASIC_FINANCE_READ'))
 or (r.code='ADMINISTRATIVE_POSITION' and p.code in (
  'USER_READ','USER_WRITE','ORGANIZATION_MANAGE','ATTENDANCE_MANAGE','LEAVE_MANAGE',
  'LEAVE_FINAL_APPROVE','APPROVAL_MANAGE','WORK_POLICY_MANAGE','PROJECT_READ_ALL',
  'CUSTOMER_READ','CUSTOMER_MANAGE','OPPORTUNITY_READ','OPPORTUNITY_READ_ALL','OPPORTUNITY_MANAGE',
  'QUOTATION_READ','QUOTATION_READ_ALL','QUOTATION_MANAGE','QUOTATION_APPROVE',
  'CONTRACT_READ','CONTRACT_READ_ALL','CONTRACT_MANAGE','CONTRACT_APPROVE',
  'BILLING_READ','BILLING_READ_ALL','BILLING_MANAGE','TAX_INVOICE_READ',
  'TAX_INVOICE_READ_ALL','TAX_INVOICE_MANAGE','PAYMENT_READ','PAYMENT_READ_ALL','PAYMENT_MANAGE',
  'PROJECT_FINANCE_READ','PROJECT_FINANCE_READ_ALL','EXPENSE_READ_ALL','EXPENSE_MANAGE',
  'EXPENSE_MASTER_MANAGE','CORPORATE_CARD_READ','CORPORATE_CARD_MANAGE',
  'WORKFORCE_PROFILE_READ_ALL','CARD_SETTLEMENT_READ','FINANCE_SETTINGS_MANAGE'))
 or (r.code='HEAD' and p.code not in ('APPROVAL_BYPASS'))
 or (r.code='HEAD' and p.code='APPROVAL_BYPASS')
on conflict do nothing;

insert into public.role_permission_scopes(role_id,permission_id,data_scope)
select r.id,p.id,scope.data_scope from (values
 ('GUEST','PROFILE_READ_SELF','SELF'),
 ('MEMBER','PROJECT_READ_SELF','ASSIGNED_PROJECT'),
 ('MEMBER','ATTENDANCE_READ_SELF','SELF'),
 ('MEMBER','EXPENSE_READ_SELF','SELF'),
 ('TEAM_LEADER','PROJECT_READ','TEAM'),
 ('TEAM_LEADER','PROJECT_READ','ASSIGNED_PROJECT'),
 ('TEAM_LEADER','USER_READ_TEAM','TEAM'),
 ('TEAM_LEADER','USER_APPROVE','TEAM'),
 ('TEAM_LEADER','LEAVE_TEAM_APPROVE','TEAM'),
 ('TEAM_LEADER','ATTENDANCE_READ_TEAM','TEAM'),
 ('ADMINISTRATIVE_POSITION','PROJECT_READ_ALL','ALL'),
 ('ADMINISTRATIVE_POSITION','USER_READ','ALL'),
 ('ADMINISTRATIVE_POSITION','USER_APPROVE','ALL'),
 ('ADMINISTRATIVE_POSITION','LEAVE_FINAL_APPROVE','ALL'),
 ('HEAD','PROJECT_READ_ALL','ALL'),
 ('HEAD','USER_READ','ALL'),
 ('HEAD','USER_APPROVE','ALL'),
 ('HEAD','LEAVE_FINAL_APPROVE','ALL')
) scope(role_code,permission_code,data_scope)
join public.roles r on r.code=scope.role_code
join public.permissions p on p.code=scope.permission_code
on conflict do nothing;

-- A cycle is invalid even if introduced through a later administrative SQL change.
create function private.prevent_role_cycle() returns trigger language plpgsql set search_path='' as $$
begin
 if exists (
  with recursive inherited(id) as (
   select inherited_role_id from public.role_inheritance where role_id=new.inherited_role_id
   union
   select ri.inherited_role_id from public.role_inheritance ri join inherited i on ri.role_id=i.id
  ) select 1 from inherited where id=new.role_id
 ) then raise exception using errcode='23514',message='Role inheritance cycle'; end if;
 return new;
end; $$;
create trigger prevent_role_cycle before insert or update on public.role_inheritance
 for each row execute function private.prevent_role_cycle();

create function private.effective_permissions(p_user_id uuid) returns table(code text)
language sql stable security definer set search_path='' as $$
 with recursive assigned(id) as (
  select ur.role_id from public.user_roles ur join public.roles r on r.id=ur.role_id and r.active where ur.user_id=p_user_id
  union
  select ri.inherited_role_id from public.role_inheritance ri join assigned a on a.id=ri.role_id
   join public.roles r on r.id=ri.inherited_role_id and r.active
 ), granted as (
  select p.id,p.code from assigned a join public.role_permissions rp on rp.role_id=a.id
   join public.permissions p on p.id=rp.permission_id
  union
  select p.id,p.code from public.user_permission_overrides u
   join public.permissions p on p.id=u.permission_id where u.user_id=p_user_id and u.allowed
 )
 select distinct g.code from granted g
 where exists(select 1 from public.employees e where e.id=p_user_id and e.user_status='ACTIVE')
 and not exists(select 1 from public.user_permission_overrides u
  where u.user_id=p_user_id and u.permission_id=g.id and not u.allowed);
$$;
revoke all on function private.effective_permissions(uuid) from public,anon,authenticated;

create or replace function private.has_permission(p_code text) returns boolean
language sql stable security definer set search_path='' as $$
 select (select private.is_active()) and exists(
  select 1 from private.effective_permissions(auth.uid()) ep where ep.code=p_code
 );
$$;

create function private.has_scope(p_code text,p_scope text) returns boolean
language sql stable security definer set search_path='' as $$
 with recursive assigned(id) as (
  select ur.role_id from public.user_roles ur join public.roles r on r.id=ur.role_id and r.active
   where ur.user_id=auth.uid()
  union
  select ri.inherited_role_id from public.role_inheritance ri join assigned a on a.id=ri.role_id
   join public.roles r on r.id=ri.inherited_role_id and r.active
 )
 select private.has_permission(p_code) and (
  exists(select 1 from assigned a join public.role_permission_scopes s on s.role_id=a.id
   join public.permissions p on p.id=s.permission_id
   where p.code=p_code and s.data_scope=p_scope)
  or exists(select 1 from public.user_permission_overrides u
   join public.permissions p on p.id=u.permission_id
   where u.user_id=auth.uid() and p.code=p_code and u.allowed and u.data_scope=p_scope)
 );
$$;
revoke all on function private.has_scope(text,text) from public,anon,authenticated;

create or replace function private.account_context() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'id',e.id,'name',e.name,'status',e.user_status,
  'permissions',coalesce((select jsonb_agg(ep.code order by ep.code) from private.effective_permissions(e.id) ep),'[]'::jsonb),
  'roles',coalesce((select jsonb_agg(r.code order by r.code) from public.user_roles ur
   join public.roles r on r.id=ur.role_id and r.active where ur.user_id=e.id),'[]'::jsonb),
  'organizationId',e.organization_id
 ) from public.employees e where e.id=auth.uid() and auth.uid() is not null;
$$;

-- Existing users keep their legacy grants during the transition.
insert into public.user_roles(user_id,role_id,granted_by)
select ur.user_id,member.id,ur.granted_by from public.user_roles ur
join public.roles legacy on legacy.id=ur.role_id and legacy.code='EMPLOYEE'
join public.roles member on member.code='MEMBER'
on conflict do nothing;
insert into public.user_roles(user_id,role_id,granted_by)
select ur.user_id,leader.id,ur.granted_by from public.user_roles ur
join public.roles legacy on legacy.id=ur.role_id and legacy.code='TEAM_MANAGER'
join public.roles leader on leader.code='TEAM_LEADER'
on conflict do nothing;

-- Team leaders can only approve applicants for an organization they lead.
alter function private.management_command(text,jsonb,text) rename to management_command_legacy;
create function private.management_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_target uuid; v_org uuid; v_role text;
begin
 if p_action='employee.status' and p_payload->>'status'='ACTIVE' then
  v_target=(p_payload->>'id')::uuid;
  select coalesce(nullif(p_payload->>'organization_id','')::uuid,e.organization_id)
   into v_org from public.employees e where e.id=v_target;
  if not private.has_permission('USER_READ')
   and not (private.has_scope('USER_APPROVE','TEAM') and private.manages_organization(v_org)) then
   raise exception using errcode='42501',message='Forbidden';
  end if;
  v_role=coalesce(nullif(p_payload->>'role_code',''),'MEMBER');
  if v_role not in ('MEMBER','TEAM_LEADER','ADMINISTRATIVE_POSITION','HEAD')
   or (not private.has_permission('RBAC_MANAGE') and v_role<>'MEMBER') then
   raise exception using errcode='42501',message='Forbidden';
  end if;
  v_result=private.management_command_legacy(p_action,p_payload,p_request_id);
  delete from public.user_roles ur using public.roles r
   where ur.role_id=r.id and ur.user_id=v_target and r.code='EMPLOYEE';
  insert into public.user_roles(user_id,role_id,granted_by)
   select v_target,id,auth.uid() from public.roles where code=v_role and active
   on conflict do nothing;
  return v_result;
 end if;
 if p_action='employee.status' and not private.has_permission('USER_READ') then
  raise exception using errcode='42501',message='Forbidden';
 end if;
 if p_action='role.assign' and not private.has_permission('RBAC_MANAGE') then
  raise exception using errcode='42501',message='Forbidden';
 end if;
 if p_action='role.save' and exists(select 1 from public.roles
  where id=nullif(p_payload->>'id','')::uuid and system) then
  raise exception using errcode='42501',message='System role permissions are migration-managed';
 end if;
 return private.management_command_legacy(p_action,p_payload,p_request_id);
end; $$;
revoke all on function private.management_command_legacy(text,jsonb,text) from public,anon,authenticated;
revoke all on function private.management_command(text,jsonb,text) from public,anon,authenticated;
grant execute on function private.management_command(text,jsonb,text) to authenticated;

-- Apply scope to the central project RLS predicate; financial RLS remains separate.
create or replace function private.can_read_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(
  select 1 from public.projects p where p.id=p_project_id and (
   private.has_permission('PROJECT_READ_ALL')
   or (p.project_manager_id=auth.uid() and private.has_permission('PROJECT_READ'))
   or (private.has_permission('PROJECT_READ_SELF') and exists(
    select 1 from public.project_assignments pa where pa.project_id=p.id and pa.user_id=auth.uid()
   ))
   or (private.has_scope('PROJECT_READ','TEAM') and exists(
    select 1 from public.project_assignments pa join public.employees e on e.id=pa.user_id
    where pa.project_id=p.id and private.manages_organization(e.organization_id)
   ))
  )
 );
$$;

create or replace function private.user_has_permission(p_user_id uuid,p_code text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.effective_permissions(p_user_id) ep where ep.code=p_code);
$$;

drop policy employee_read on public.employees;
create policy employee_read on public.employees for select to authenticated using(
 (select private.is_active()) and (
  id=(select auth.uid()) or (select private.has_permission('USER_READ'))
  or private.manages_organization(organization_id)
  or (user_status='REQUESTED' and (select private.has_permission('USER_APPROVE')))
 )
);

commit;
