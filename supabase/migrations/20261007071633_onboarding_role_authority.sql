begin;

create or replace function private.management_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target_id uuid; target_org uuid; requested_role text; result jsonb;
declare company_authority boolean; team_authority boolean; legacy_admin boolean;
begin
 if p_action<>'employee.status' or p_payload->>'status'<>'ACTIVE' then
  return private.management_command_scope_legacy(p_action,p_payload,p_request_id);
 end if;
 perform private.require_permission('USER_APPROVE');
 target_id=(p_payload->>'id')::uuid;
 select coalesce(nullif(p_payload->>'organization_id','')::uuid,e.organization_id)
  into target_org from public.employees e where e.id=target_id;
 company_authority:=private.has_scope('USER_APPROVE','ALL');
 team_authority:=private.has_scope('USER_APPROVE','TEAM') and private.manages_organization(target_org);
 select exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id and r.active
  where ur.user_id=auth.uid() and r.code in ('ADMIN','HR_MANAGER')) into legacy_admin;
 if not (company_authority or team_authority or legacy_admin) then
  raise exception using errcode='42501',message='Forbidden';
 end if;
 requested_role:=coalesce(nullif(p_payload->>'role_code',''),'MEMBER');
 if requested_role not in ('MEMBER','TEAM_LEADER','ADMINISTRATIVE_POSITION','HEAD') then
  raise exception using errcode='22023',message='Invalid role';
 end if;
 if not private.has_permission('RBAC_MANAGE') then
  if team_authority and not company_authority and requested_role<>'MEMBER' then
   raise exception using errcode='42501',message='Team leader may approve Members only';
  end if;
  if requested_role='HEAD' then raise exception using errcode='42501',message='Head assignment requires RBAC authority'; end if;
 end if;
 result:=private.management_command_legacy(p_action,p_payload,p_request_id);
 delete from public.user_roles ur using public.roles r
  where ur.role_id=r.id and ur.user_id=target_id and r.code='EMPLOYEE';
 insert into public.user_roles(user_id,role_id,granted_by)
  select target_id,id,auth.uid() from public.roles where code=requested_role and active
  on conflict do nothing;
 return result;
end; $$;

create or replace function private.user_permission_command(p_user_id uuid,p_permission_code text,p_action text,p_data_scope text,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_action='grant' and (p_data_scope is null or p_data_scope not in ('SELF','TEAM','ASSIGNED_PROJECT','DEPARTMENT','ALL')) then
  raise exception using errcode='22023',message='Data scope is required';
 end if;
 if p_action='grant' and (
  p_permission_code like '%\_ALL' escape '\' or p_permission_code in ('USER_READ','EMPLOYEE_COST_READ')
 ) and p_data_scope<>'ALL' then
  raise exception using errcode='22023',message='ALL scope is required for this permission';
 end if;
 return private.user_permission_command_legacy(p_user_id,p_permission_code,p_action,p_data_scope,p_request_id);
end; $$;

commit;
