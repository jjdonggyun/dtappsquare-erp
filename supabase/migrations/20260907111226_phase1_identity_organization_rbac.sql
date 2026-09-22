begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

create table public.positions (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null check(length(name) between 1 and 80),
 sort_order integer not null default 0, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.titles (like public.positions including all);
create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 80),
 organization_type text not null check(organization_type in ('COMPANY','DIVISION','TEAM','DEPARTMENT')),
 parent_id uuid references public.organizations(id) on delete restrict, leader_user_id uuid,
 sort_order integer not null default 0, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(parent_id is distinct from id)
);
create table public.employees (
 id uuid primary key references auth.users(id) on delete restrict,
 employee_number text unique check(length(employee_number) between 1 and 40), name text not null check(length(name) between 1 and 80),
 email text not null, phone text check(length(phone)<=40), join_date date, resignation_date date,
 organization_id uuid references public.organizations(id) on delete restrict,
 position_id uuid references public.positions(id) on delete restrict, title_id uuid references public.titles(id) on delete restrict,
 employment_type text not null default 'FULL_TIME' check(employment_type in ('FULL_TIME','CONTRACT','PART_TIME','INTERN')),
 user_status text not null default 'REQUESTED' check(user_status in ('REQUESTED','ACTIVE','REJECTED','SUSPENDED','RESIGNED')),
 profile_image text check(profile_image is null or profile_image ~ '^https://'), version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(resignation_date is null or (join_date is not null and resignation_date>=join_date)),
 check(user_status <> 'ACTIVE' or (employee_number is not null and join_date is not null and organization_id is not null)),
 check(user_status <> 'RESIGNED' or resignation_date is not null)
);
create unique index employees_email_unique on public.employees(lower(email));
create index employees_organization_status on public.employees(organization_id,user_status);
create index employees_position on public.employees(position_id);
create index employees_title on public.employees(title_id);
create index employees_status_created on public.employees(user_status,created_at);
alter table public.organizations add constraint organizations_leader_fk foreign key(leader_user_id) references public.employees(id) on delete restrict;
create index organizations_parent_sort on public.organizations(parent_id,sort_order);
create index organizations_leader on public.organizations(leader_user_id);

create table public.roles (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^[A-Z][A-Z0-9_]{1,60}$'), name text not null check(length(name) between 1 and 80),
 system boolean not null default false, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.permissions (id uuid primary key default gen_random_uuid(), code text not null unique, description text not null);
create table public.role_permissions (
 role_id uuid not null references public.roles(id) on delete restrict,
 permission_id uuid not null references public.permissions(id) on delete restrict,
 primary key(role_id,permission_id)
);
create index role_permissions_permission on public.role_permissions(permission_id);
create table public.user_roles (
 user_id uuid not null references public.employees(id) on delete restrict,
 role_id uuid not null references public.roles(id) on delete restrict,
 granted_by uuid references public.employees(id) on delete restrict,
 created_at timestamptz not null default now(), primary key(user_id,role_id)
);
create index user_roles_role on public.user_roles(role_id);
create index user_roles_granted_by on public.user_roles(granted_by);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), actor_user_id uuid references public.employees(id) on delete restrict,
 action text not null, entity_type text not null, entity_id text not null,
 before_data jsonb, after_data jsonb, ip_address inet, request_id text,
 created_at timestamptz not null default now()
);
create index audit_entity_time on public.audit_logs(entity_type,entity_id,created_at desc);
create index audit_actor_time on public.audit_logs(actor_user_id,created_at desc);

create function private.is_active() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.employees where id=auth.uid() and user_status='ACTIVE');
$$;
create function private.has_permission(p_code text) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(
  select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id and r.active
  join public.role_permissions rp on rp.role_id=r.id join public.permissions p on p.id=rp.permission_id
  where ur.user_id=auth.uid() and p.code=p_code);
$$;
create function private.manages_organization(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 with recursive managed as (
  select id from public.organizations where leader_user_id=auth.uid() and active
  union select o.id from public.organizations o join managed m on o.parent_id=m.id where o.active
 ) select private.has_permission('USER_READ_TEAM') and exists(select 1 from managed where id=p_id);
$$;
grant execute on function private.is_active(), private.has_permission(text), private.manages_organization(uuid) to authenticated;

create function private.account_context() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',e.id,'name',e.name,'status',e.user_status,'permissions',
 case when e.user_status='ACTIVE' then coalesce((select jsonb_agg(distinct p.code) from public.user_roles ur
 join public.roles r on r.id=ur.role_id and r.active join public.role_permissions rp on rp.role_id=r.id
 join public.permissions p on p.id=rp.permission_id where ur.user_id=e.id),'[]'::jsonb) else '[]'::jsonb end)
 from public.employees e where e.id=auth.uid() and auth.uid() is not null;
$$;
create function public.account_context() returns jsonb language sql stable security invoker set search_path='' as $$ select private.account_context(); $$;
grant execute on function private.account_context(), public.account_context() to authenticated;

create function private.employee_directory() returns table(id uuid,name text,organization_id uuid,position_id uuid,title_id uuid)
 language sql stable security definer set search_path='' as $$
 select e.id,e.name,e.organization_id,e.position_id,e.title_id from public.employees e
 where private.is_active() and e.user_status='ACTIVE' order by e.name,e.id limit 1000;
$$;
create function public.employee_directory() returns table(id uuid,name text,organization_id uuid,position_id uuid,title_id uuid)
 language sql stable security invoker set search_path='' as $$ select * from private.employee_directory(); $$;
grant execute on function private.employee_directory(), public.employee_directory() to authenticated;

create function private.capture_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare b jsonb; a jsonb;
begin
 if TG_OP<>'INSERT' then b=to_jsonb(old); end if;
 if TG_OP<>'DELETE' then a=to_jsonb(new); end if;
 -- No auth credentials are stored in audited tables. Employee contact data is minimized.
 if TG_TABLE_NAME='employees' then b=b-'phone'-'profile_image'-'email'; a=a-'phone'-'profile_image'-'email'; end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id)
 values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(a->>'id',b->>'id',a->>'user_id',b->>'user_id',a->>'role_id',b->>'role_id'),b,a,nullif(current_setting('app.request_id',true),''));
 return coalesce(new,old);
end; $$;
create function private.touch_row() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); if TG_TABLE_NAME='employees' then new.version=old.version+1; end if; return new; end; $$;

create function private.on_auth_user_created() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.employees(id,email,name,user_status)
 values(new.id,lower(new.email),left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),split_part(new.email,'@',1)),80),'REQUESTED');
 return new;
end; $$;
create trigger create_employee after insert on auth.users for each row execute function private.on_auth_user_created();
create function private.sync_auth_email() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.employees set email=lower(new.email) where id=new.id; return new; end; $$;
create trigger sync_employee_email after update of email on auth.users for each row when(old.email is distinct from new.email) execute function private.sync_auth_email();

do $$ declare t text; begin
 foreach t in array array['employees','organizations','positions','titles','roles','permissions','role_permissions','user_roles','audit_logs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  if t<>'audit_logs' then execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.capture_audit()',t); end if;
 end loop;
 foreach t in array array['employees','organizations','positions','titles','roles'] loop
  execute format('create trigger touch_updated before update on public.%I for each row execute function private.touch_row()',t);
 end loop;
end $$;
create policy employee_read on public.employees for select to authenticated using(
 (select private.is_active()) and (id=(select auth.uid()) or (select private.has_permission('USER_READ')) or private.manages_organization(organization_id)));
create policy organization_read on public.organizations for select to authenticated using((select private.is_active()));
create policy positions_read on public.positions for select to authenticated using((select private.is_active()));
create policy titles_read on public.titles for select to authenticated using((select private.is_active()));
create policy roles_read on public.roles for select to authenticated using((select private.is_active()));
create policy permissions_read on public.permissions for select to authenticated using((select private.is_active()));
create policy role_permissions_read on public.role_permissions for select to authenticated using((select private.is_active()));
create policy user_roles_read on public.user_roles for select to authenticated using((select private.is_active()) and (user_id=(select auth.uid()) or (select private.has_permission('RBAC_MANAGE'))));
create policy audit_read on public.audit_logs for select to authenticated using((select private.has_permission('AUDIT_READ')));

insert into public.permissions(code,description) select code,code from unnest(array[
 'PROFILE_READ_SELF','PROFILE_WRITE_SELF','USER_READ','USER_WRITE','USER_APPROVE','USER_READ_TEAM','ORGANIZATION_MANAGE','RBAC_MANAGE','AUDIT_READ',
 'ATTENDANCE_READ_SELF','ATTENDANCE_READ_TEAM','ATTENDANCE_MANAGE','WORK_POLICY_MANAGE','LEAVE_REQUEST','LEAVE_APPROVE','LEAVE_MANAGE',
 'APPROVAL_READ_SELF','APPROVAL_MANAGE','NOTIFICATION_READ_SELF','ASSET_READ_SELF','ASSET_READ','ASSET_WRITE','DEVICE_MANAGE',
 'PROJECT_READ_SELF','PROJECT_READ','PROJECT_READ_ALL','PROJECT_WRITE','PROJECT_RESOURCE_MANAGE','RESOURCE_READ'
]) code;
insert into public.roles(code,name,system) values ('EMPLOYEE','직원',true),('TEAM_MANAGER','팀장',true),('PROJECT_MANAGER','프로젝트 관리자',true),('HR_MANAGER','인사 관리자',true),('ASSET_MANAGER','자산 관리자',true),('ADMIN','시스템 관리자',true);
insert into public.role_permissions select r.id,p.id from public.roles r cross join public.permissions p where r.code='ADMIN'
 or p.code in ('PROFILE_READ_SELF','PROFILE_WRITE_SELF','ATTENDANCE_READ_SELF','LEAVE_REQUEST','APPROVAL_READ_SELF','NOTIFICATION_READ_SELF','ASSET_READ_SELF','PROJECT_READ_SELF')
 or (r.code='TEAM_MANAGER' and p.code in ('USER_READ_TEAM','ATTENDANCE_READ_TEAM','LEAVE_APPROVE'))
 or (r.code='PROJECT_MANAGER' and p.code in ('PROJECT_READ','PROJECT_WRITE','PROJECT_RESOURCE_MANAGE'))
 or (r.code='HR_MANAGER' and p.code in ('USER_READ','USER_WRITE','USER_APPROVE','ORGANIZATION_MANAGE','ATTENDANCE_MANAGE','LEAVE_MANAGE','WORK_POLICY_MANAGE','RESOURCE_READ','ASSET_READ','PROJECT_READ_ALL'))
 or (r.code='ASSET_MANAGER' and p.code in ('ASSET_READ','ASSET_WRITE','DEVICE_MANAGE'));

create function private.require_permission(p_code text) returns void language plpgsql stable security definer set search_path='' as $$
begin if auth.uid() is null then raise exception using errcode='28000',message='Unauthorized'; end if;
 if not private.has_permission(p_code) then raise exception using errcode='42501',message='Forbidden'; end if;
end; $$;

-- All management commands serialize authority changes. Permission is rechecked after taking the lock.
create function private.management_command(p_action text,p_payload jsonb,p_request_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid; v public.employees; required text; result jsonb; next_status text; rid uuid; perm uuid; cycle_found boolean;
begin
 if auth.uid() is null then raise exception using errcode='28000',message='Unauthorized'; end if;
 perform pg_advisory_xact_lock(713821);
 required=case p_action when 'employee.update' then 'USER_WRITE' when 'employee.status' then 'USER_APPROVE'
 when 'profile.update' then 'PROFILE_WRITE_SELF' when 'organization.save' then 'ORGANIZATION_MANAGE'
 when 'catalog.save' then 'ORGANIZATION_MANAGE' when 'role.save' then 'RBAC_MANAGE' when 'role.assign' then 'RBAC_MANAGE' else null end;
 if required is null then raise exception using errcode='22023',message='ValidationError'; end if;
 perform private.require_permission(required);
 perform set_config('app.request_id',left(coalesce(p_request_id,''),100),true);
 target=nullif(p_payload->>'id','')::uuid;
 if p_action in ('employee.update','employee.status','profile.update') then
  if p_action='profile.update' then target=auth.uid(); end if;
  select * into v from public.employees where id=target for update;
  if not found then raise exception using errcode='P0002',message='NotFound'; end if;
  if v.version is distinct from (p_payload->>'version')::integer then raise exception using errcode='40001',message='Conflict'; end if;
  if p_action='profile.update' then
   update public.employees set phone=nullif(p_payload->>'phone',''),profile_image=nullif(p_payload->>'profile_image','') where id=target returning to_jsonb(employees.*) into result;
  elsif p_action='employee.update' then
   if not exists(select 1 from public.organizations where id=(p_payload->>'organization_id')::uuid and active) then raise exception using errcode='22023',message='ValidationError'; end if;
   update public.employees set name=p_payload->>'name',employee_number=nullif(p_payload->>'employee_number',''),
    phone=nullif(p_payload->>'phone',''),join_date=nullif(p_payload->>'join_date','')::date,
    organization_id=(p_payload->>'organization_id')::uuid,position_id=nullif(p_payload->>'position_id','')::uuid,
    title_id=nullif(p_payload->>'title_id','')::uuid,employment_type=p_payload->>'employment_type'
    where id=target returning to_jsonb(employees.*) into result;
  else
   next_status=p_payload->>'status';
   if target=auth.uid() or not (
    (v.user_status='REQUESTED' and next_status in ('ACTIVE','REJECTED')) or
    (v.user_status='ACTIVE' and next_status in ('SUSPENDED','RESIGNED')) or
    (v.user_status='SUSPENDED' and next_status in ('ACTIVE','RESIGNED')) or
    (v.user_status='REJECTED' and next_status='REQUESTED')) then raise exception using errcode='40001',message='Conflict'; end if;
   if next_status='ACTIVE' then
    if not exists(select 1 from public.organizations where id=coalesce(nullif(p_payload->>'organization_id','')::uuid,v.organization_id) and active) then raise exception using errcode='22023',message='ValidationError'; end if;
   end if;
   update public.employees set user_status=next_status,
    employee_number=coalesce(nullif(p_payload->>'employee_number',''),employee_number),join_date=coalesce(nullif(p_payload->>'join_date','')::date,join_date),
    organization_id=coalesce(nullif(p_payload->>'organization_id','')::uuid,organization_id),
    resignation_date=case when next_status='RESIGNED' then (p_payload->>'resignation_date')::date else resignation_date end
    where id=target returning to_jsonb(employees.*) into result;
   if next_status='ACTIVE' then insert into public.user_roles(user_id,role_id,granted_by) select target,id,auth.uid() from public.roles where code='EMPLOYEE' on conflict do nothing; end if;
  end if;
 elsif p_action='organization.save' then
  target=coalesce(target,gen_random_uuid());
  with recursive descendants as (select id from public.organizations where id=target union select o.id from public.organizations o join descendants d on o.parent_id=d.id)
   select exists(select 1 from descendants where id=nullif(p_payload->>'parent_id','')::uuid) into cycle_found;
  if cycle_found or target=nullif(p_payload->>'parent_id','')::uuid then raise exception using errcode='40001',message='Conflict'; end if;
  if nullif(p_payload->>'parent_id','') is not null and not exists(select 1 from public.organizations where id=(p_payload->>'parent_id')::uuid and active) then raise exception using errcode='22023',message='ValidationError'; end if;
  if nullif(p_payload->>'leader_user_id','') is not null and not exists(select 1 from public.employees where id=(p_payload->>'leader_user_id')::uuid and user_status='ACTIVE') then raise exception using errcode='22023',message='ValidationError'; end if;
  if not (p_payload->>'active')::boolean and (exists(select 1 from public.employees where organization_id=target and user_status='ACTIVE') or exists(select 1 from public.organizations where parent_id=target and active)) then raise exception using errcode='40001',message='Conflict'; end if;
  insert into public.organizations(id,name,organization_type,parent_id,leader_user_id,sort_order,active)
   values(target,p_payload->>'name',p_payload->>'organization_type',nullif(p_payload->>'parent_id','')::uuid,nullif(p_payload->>'leader_user_id','')::uuid,(p_payload->>'sort_order')::integer,(p_payload->>'active')::boolean)
  on conflict(id) do update set name=excluded.name,organization_type=excluded.organization_type,parent_id=excluded.parent_id,leader_user_id=excluded.leader_user_id,sort_order=excluded.sort_order,active=excluded.active returning to_jsonb(organizations.*) into result;
 elsif p_action='catalog.save' then
  if p_payload->>'catalog' not in ('positions','titles') then raise exception using errcode='22023',message='ValidationError'; end if;
  execute format('insert into public.%I(id,code,name,sort_order,active) values($1,$2,$3,$4,$5) on conflict(id) do update set code=excluded.code,name=excluded.name,sort_order=excluded.sort_order,active=excluded.active returning to_jsonb(%I.*)',p_payload->>'catalog',p_payload->>'catalog')
   into result using coalesce(target,gen_random_uuid()),p_payload->>'code',p_payload->>'name',(p_payload->>'sort_order')::integer,(p_payload->>'active')::boolean;
 elsif p_action='role.save' then
  target=coalesce(target,gen_random_uuid());
  if exists(select 1 from public.roles where id=target and code='ADMIN') then raise exception using errcode='42501',message='Forbidden'; end if;
  if exists(select 1 from public.roles where id=target and system and code<>p_payload->>'code') then raise exception using errcode='42501',message='Forbidden'; end if;
  insert into public.roles(id,code,name,active) values(target,p_payload->>'code',p_payload->>'name',(p_payload->>'active')::boolean)
  on conflict(id) do update set code=excluded.code,name=excluded.name,active=excluded.active;
  delete from public.role_permissions where role_id=target;
  for perm in select value::uuid from jsonb_array_elements_text(p_payload->'permission_ids') loop
   insert into public.role_permissions values(target,perm) on conflict do nothing;
  end loop;
  result=jsonb_build_object('id',target);
 elsif p_action='role.assign' then
  if not exists(select 1 from public.employees where id=target and user_status='ACTIVE') then raise exception using errcode='22023',message='ValidationError'; end if;
  delete from public.user_roles where user_id=target;
  for rid in select value::uuid from jsonb_array_elements_text(p_payload->'role_ids') loop
   if not exists(select 1 from public.roles where id=rid and active) then raise exception using errcode='22023',message='ValidationError'; end if;
   insert into public.user_roles(user_id,role_id,granted_by) values(target,rid,auth.uid()) on conflict do nothing;
  end loop;
  result=jsonb_build_object('id',target);
 end if;
 if not exists(select 1 from public.employees e join public.user_roles ur on ur.user_id=e.id join public.roles r on r.id=ur.role_id where e.user_status='ACTIVE' and r.code='ADMIN' and r.active) then
  raise exception using errcode='40001',message='Conflict';
 end if;
 return result;
end; $$;
create function public.management_command(p_action text,p_payload jsonb,p_request_id text default null) returns jsonb
 language sql security invoker set search_path='' as $$ select private.management_command(p_action,p_payload,p_request_id); $$;
grant execute on function private.management_command(text,jsonb,text),public.management_command(text,jsonb,text) to authenticated;
revoke execute on function private.require_permission(text),private.capture_audit(),private.touch_row(),private.on_auth_user_created(),private.sync_auth_email() from public,anon,authenticated;
commit;
