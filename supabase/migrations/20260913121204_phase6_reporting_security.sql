begin;

create or replace function private.capture_audit() returns trigger
language plpgsql security definer set search_path='' as $$
declare b jsonb; a jsonb;
begin
 if TG_OP<>'INSERT' then b=to_jsonb(old); end if;
 if TG_OP<>'DELETE' then a=to_jsonb(new); end if;
 if TG_TABLE_NAME='employees' then b=b-'phone'-'profile_image'-'email'; a=a-'phone'-'profile_image'-'email'; end if;
 if TG_TABLE_NAME='leave_requests' then b=b-'reason'; a=a-'reason'; end if;
 if TG_TABLE_NAME='approval_request_steps' then b=b-'comment'; a=a-'comment'; end if;
 if TG_TABLE_NAME='registered_devices' then b=b-'mac_hash'-'device_token_hash'; a=a-'mac_hash'-'device_token_hash'; end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id)
 values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(a->>'id',b->>'id',a->>'user_id',b->>'user_id',a->>'role_id',b->>'role_id',a->>'key',b->>'key'),b,a,nullif(current_setting('app.request_id',true),''));
 return coalesce(new,old);
end;
$$;

create or replace function private.can_read_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.is_active() and exists(
    select 1 from public.projects p where p.id=p_project_id and (
      private.has_permission('PROJECT_READ_ALL')
      or (p.project_manager_id=auth.uid() and private.has_permission('PROJECT_READ'))
      or (private.has_permission('PROJECT_READ_SELF') and exists(
        select 1 from public.project_assignments pa where pa.project_id=p.id and pa.user_id=auth.uid()
      ))
      or (private.has_permission('USER_READ_TEAM') and exists(
        select 1 from public.project_assignments pa
        join public.employees e on e.id=pa.user_id
        where pa.project_id=p.id and private.manages_organization(e.organization_id)
      ))
    )
  );
$$;

create function private.can_read_project_assignment(p_assignment_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.is_active() and exists(
    select 1 from public.project_assignments pa
    join public.projects p on p.id=pa.project_id
    join public.employees e on e.id=pa.user_id
    where pa.id=p_assignment_id and (
      private.has_permission('PROJECT_READ_ALL')
      or (p.project_manager_id=auth.uid() and private.has_permission('PROJECT_READ'))
      or (pa.user_id=auth.uid() and private.has_permission('PROJECT_READ_SELF'))
      or (private.has_permission('USER_READ_TEAM') and private.manages_organization(e.organization_id))
    )
  );
$$;

drop policy project_assignments_read on public.project_assignments;
create policy project_assignments_read on public.project_assignments for select to authenticated using(
  private.can_read_project_assignment(id)
);

grant execute on function private.can_read_project_assignment(uuid) to authenticated;
revoke execute on function private.can_read_project_assignment(uuid) from public,anon;

create table public.company_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.-]{2,79}$'),
  value jsonb not null,
  version integer not null default 1 check (version > 0),
  updated_by uuid references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.company_settings(key,value)
values('project.allocation','{"mode":"WARN"}'::jsonb);

create trigger touch_company_settings before update on public.company_settings
for each row execute function private.touch_versioned_row();
create trigger audit_company_settings after insert or update on public.company_settings
for each row execute function private.capture_audit();

create function private.enforce_project_allocation_mode()
returns trigger language plpgsql security definer set search_path='' as $$
declare peak numeric; mode text;
begin
  if new.status not in ('PLANNED','CONFIRMED','IN_PROGRESS') then return new; end if;
  select coalesce(value->>'mode','WARN') into mode from public.company_settings where key='project.allocation';
  if mode='BLOCK' then
    peak:=private.project_allocation_peak(new.user_id,new.planned_start_date,new.planned_end_date,new.id)+new.allocation_rate;
    if peak>100 then raise exception 'allocation exceeds configured limit' using errcode='40001'; end if;
  end if;
  return new;
end;
$$;

create trigger enforce_project_allocation before insert or update of user_id,planned_start_date,planned_end_date,allocation_rate,status
on public.project_assignments for each row execute function private.enforce_project_allocation_mode();

create function private.system_setting_command(p_key text,p_value jsonb,p_version integer,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_row public.company_settings;
begin
  perform private.require_permission('RBAC_MANAGE');
  perform set_config('app.request_id',left(coalesce(p_request_id,''),100),true);
  if p_key<>'project.allocation' or p_value->>'mode' not in ('WARN','BLOCK') then
    raise exception 'ValidationError' using errcode='22023';
  end if;
  select * into current_row from public.company_settings where key=p_key for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if current_row.version is distinct from p_version then raise exception 'Conflict' using errcode='40001'; end if;
  update public.company_settings set value=p_value,updated_by=auth.uid() where key=p_key;
  return jsonb_build_object('key',p_key,'message','시스템 설정을 저장했습니다.');
end;
$$;

create function public.system_setting_command(p_key text,p_value jsonb,p_version integer,p_request_id text default null)
returns jsonb language sql security definer set search_path='' as $$
  select private.system_setting_command(p_key,p_value,p_version,p_request_id);
$$;

alter table public.company_settings enable row level security;
revoke all on public.company_settings from anon,authenticated;
grant select on public.company_settings to authenticated;
create policy company_settings_read on public.company_settings for select to authenticated using(
  (select private.has_permission('RBAC_MANAGE'))
);
grant execute on function public.system_setting_command(text,jsonb,integer,text) to authenticated;
revoke execute on function public.system_setting_command(text,jsonb,integer,text) from public,anon;
revoke execute on function private.system_setting_command(text,jsonb,integer,text),
  private.enforce_project_allocation_mode() from public,anon,authenticated;

commit;
