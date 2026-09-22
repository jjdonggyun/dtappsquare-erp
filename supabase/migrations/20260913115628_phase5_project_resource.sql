begin;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  project_code text not null unique check (project_code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  project_name text not null check (length(trim(project_name)) between 2 and 160),
  customer_name text not null check (length(trim(customer_name)) between 1 and 160),
  description text check (description is null or length(description) <= 4000),
  planned_start_date date not null,
  planned_end_date date not null,
  actual_start_date date,
  actual_end_date date,
  status text not null default 'PLANNING' check (status in ('PLANNING','SCHEDULED','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELED')),
  project_manager_id uuid not null references public.employees(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  archived_at timestamptz,
  created_by uuid not null references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (planned_end_date >= planned_start_date),
  check (planned_end_date - planned_start_date <= 3650),
  check (actual_end_date is null or actual_start_date is not null),
  check (actual_end_date is null or actual_end_date >= actual_start_date)
);

create index projects_manager_status on public.projects(project_manager_id,status,planned_end_date);
create index projects_status_dates on public.projects(status,planned_start_date,planned_end_date);
create index projects_created_by on public.projects(created_by);

create table public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  user_id uuid not null references public.employees(id) on delete restrict,
  project_role text not null check (length(trim(project_role)) between 1 and 100),
  planned_start_date date not null,
  planned_end_date date not null,
  actual_start_date date,
  actual_end_date date,
  allocation_rate numeric(5,2) not null check (allocation_rate >= 0 and allocation_rate <= 100),
  status text not null default 'PLANNED' check (status in ('PLANNED','CONFIRMED','IN_PROGRESS','ON_HOLD','ENDED','CANCELED')),
  memo text check (memo is null or length(memo) <= 2000),
  assigned_by uuid not null references public.employees(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (planned_end_date >= planned_start_date),
  check (planned_end_date - planned_start_date <= 3650),
  check (actual_end_date is null or actual_start_date is not null),
  check (actual_end_date is null or actual_end_date >= actual_start_date)
);

create index project_assignments_project_status on public.project_assignments(project_id,status,planned_start_date);
create index project_assignments_user_status on public.project_assignments(user_id,status,planned_start_date,planned_end_date);
create index project_assignments_assigned_by on public.project_assignments(assigned_by);
create index project_assignments_user_range on public.project_assignments
  using gist(user_id,daterange(planned_start_date,planned_end_date + 1,'[)'));

create trigger touch_projects before update on public.projects
for each row execute function private.touch_versioned_row();
create trigger touch_project_assignments before update on public.project_assignments
for each row execute function private.touch_versioned_row();
create trigger audit_projects after insert or update on public.projects
for each row execute function private.capture_audit();
create trigger audit_project_assignments after insert or update on public.project_assignments
for each row execute function private.capture_audit();

create function private.can_read_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.is_active() and exists(
    select 1 from public.projects p where p.id=p_project_id and (
      private.has_permission('PROJECT_READ_ALL')
      or (p.project_manager_id=auth.uid() and private.has_permission('PROJECT_READ'))
      or (private.has_permission('PROJECT_READ_SELF') and exists(
        select 1 from public.project_assignments pa where pa.project_id=p.id and pa.user_id=auth.uid()
      ))
    )
  );
$$;

create function private.project_allocation_peak(
  p_user_id uuid,p_start date,p_end date,p_exclude_assignment uuid default null
) returns numeric language sql stable security definer set search_path='' as $$
  select coalesce(max(day_total),0) from (
    select d::date,coalesce(sum(pa.allocation_rate),0) as day_total
    from generate_series(p_start,p_end,interval '1 day') d
    left join public.project_assignments pa on pa.user_id=p_user_id
      and pa.status in ('PLANNED','CONFIRMED','IN_PROGRESS')
      and d::date between pa.planned_start_date and pa.planned_end_date
      and (p_exclude_assignment is null or pa.id<>p_exclude_assignment)
    group by d::date
  ) totals;
$$;

create function private.project_resource_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  target uuid;
  project_row public.projects;
  assignment_row public.project_assignments;
  manager_id uuid;
  peak numeric;
  is_new boolean;
  message_text text;
begin
  if auth.uid() is null then raise exception 'Unauthorized' using errcode='28000'; end if;
  perform set_config('app.request_id',left(coalesce(p_request_id,''),100),true);

  if p_action='project.save' then
    perform private.require_permission('PROJECT_WRITE');
    target:=nullif(p_payload->>'id','')::uuid;
    manager_id:=(p_payload->>'project_manager_id')::uuid;
    if not private.has_permission('PROJECT_READ_ALL') and manager_id<>auth.uid() then
      raise exception 'Forbidden' using errcode='42501';
    end if;
    if not exists(select 1 from public.employees where id=manager_id and user_status='ACTIVE') then
      raise exception 'NotFound' using errcode='P0002';
    end if;
    if target is null then
      insert into public.projects(
        project_code,project_name,customer_name,description,planned_start_date,planned_end_date,
        actual_start_date,actual_end_date,status,project_manager_id,created_by
      ) values (
        upper(trim(p_payload->>'project_code')),trim(p_payload->>'project_name'),trim(p_payload->>'customer_name'),
        nullif(trim(p_payload->>'description'),''),(p_payload->>'planned_start_date')::date,(p_payload->>'planned_end_date')::date,
        nullif(p_payload->>'actual_start_date','')::date,nullif(p_payload->>'actual_end_date','')::date,
        p_payload->>'status',manager_id,auth.uid()
      ) returning id into target;
    else
      select * into project_row from public.projects where id=target for update;
      if not found then raise exception 'NotFound' using errcode='P0002'; end if;
      if project_row.version is distinct from (p_payload->>'version')::integer then
        raise exception 'Conflict' using errcode='40001';
      end if;
      if not private.has_permission('PROJECT_READ_ALL') and project_row.project_manager_id<>auth.uid() then
        raise exception 'Forbidden' using errcode='42501';
      end if;
      update public.projects set
        project_code=upper(trim(p_payload->>'project_code')),project_name=trim(p_payload->>'project_name'),
        customer_name=trim(p_payload->>'customer_name'),description=nullif(trim(p_payload->>'description'),''),
        planned_start_date=(p_payload->>'planned_start_date')::date,planned_end_date=(p_payload->>'planned_end_date')::date,
        actual_start_date=nullif(p_payload->>'actual_start_date','')::date,actual_end_date=nullif(p_payload->>'actual_end_date','')::date,
        status=p_payload->>'status',project_manager_id=manager_id,
        archived_at=case when p_payload->>'status'='CANCELED' then coalesce(archived_at,now()) else null end
      where id=target;
    end if;
    return jsonb_build_object('id',target,'message','프로젝트를 저장했습니다.');

  elsif p_action='project_assignment.save' then
    perform private.require_permission('PROJECT_RESOURCE_MANAGE');
    target:=nullif(p_payload->>'id','')::uuid;
    select * into project_row from public.projects where id=(p_payload->>'project_id')::uuid for update;
    if not found then raise exception 'NotFound' using errcode='P0002'; end if;
    if not private.has_permission('PROJECT_READ_ALL') and project_row.project_manager_id<>auth.uid() then
      raise exception 'Forbidden' using errcode='42501';
    end if;
    if not exists(select 1 from public.employees where id=(p_payload->>'user_id')::uuid and user_status='ACTIVE') then
      raise exception 'NotFound' using errcode='P0002';
    end if;
    is_new:=target is null;
    if is_new then
      insert into public.project_assignments(
        project_id,user_id,project_role,planned_start_date,planned_end_date,actual_start_date,actual_end_date,
        allocation_rate,status,memo,assigned_by
      ) values (
        project_row.id,(p_payload->>'user_id')::uuid,trim(p_payload->>'project_role'),
        (p_payload->>'planned_start_date')::date,(p_payload->>'planned_end_date')::date,
        nullif(p_payload->>'actual_start_date','')::date,nullif(p_payload->>'actual_end_date','')::date,
        (p_payload->>'allocation_rate')::numeric,p_payload->>'status',nullif(trim(p_payload->>'memo'),''),auth.uid()
      ) returning * into assignment_row;
    else
      select * into assignment_row from public.project_assignments where id=target for update;
      if not found then raise exception 'NotFound' using errcode='P0002'; end if;
      if assignment_row.project_id<>project_row.id or assignment_row.version is distinct from (p_payload->>'version')::integer then
        raise exception 'Conflict' using errcode='40001';
      end if;
      update public.project_assignments set
        user_id=(p_payload->>'user_id')::uuid,project_role=trim(p_payload->>'project_role'),
        planned_start_date=(p_payload->>'planned_start_date')::date,planned_end_date=(p_payload->>'planned_end_date')::date,
        actual_start_date=nullif(p_payload->>'actual_start_date','')::date,actual_end_date=nullif(p_payload->>'actual_end_date','')::date,
        allocation_rate=(p_payload->>'allocation_rate')::numeric,status=p_payload->>'status',memo=nullif(trim(p_payload->>'memo'),'')
      where id=target returning * into assignment_row;
    end if;
    peak:=private.project_allocation_peak(
      assignment_row.user_id,assignment_row.planned_start_date,assignment_row.planned_end_date,null
    );
    if is_new then
      perform private.enqueue_notification(
        assignment_row.user_id,'PROJECT_ASSIGNED','프로젝트 배정',project_row.project_name||' 프로젝트에 배정되었습니다.',
        'PROJECT_ASSIGNMENT',assignment_row.id,'project-assignment:'||assignment_row.id||':created','project-assigned'
      );
    end if;
    message_text:='프로젝트 투입 이력을 저장했습니다.';
    if peak>100 then message_text:=message_text||' 중복 기간의 총 투입률이 '||peak||'%입니다.'; end if;
    return jsonb_build_object(
      'id',assignment_row.id,'peak_allocation',peak,'over_allocated',peak>100,
      'message',message_text
    );
  end if;
  raise exception 'unsupported project/resource action' using errcode='22023';
end;
$$;

create function public.project_resource_command(p_action text,p_payload jsonb,p_request_id text default null)
returns jsonb language sql security definer set search_path='' as $$
  select private.project_resource_command(p_action,p_payload,p_request_id);
$$;

alter table public.projects enable row level security;
alter table public.project_assignments enable row level security;
revoke all on public.projects,public.project_assignments from anon,authenticated;
grant select on public.projects,public.project_assignments to authenticated;

create policy projects_read on public.projects for select to authenticated using(
  private.can_read_project(id)
);
create policy project_assignments_read on public.project_assignments for select to authenticated using(
  private.can_read_project(project_id)
);

grant execute on function private.can_read_project(uuid) to authenticated;
grant execute on function public.project_resource_command(text,jsonb,text) to authenticated;
revoke execute on function private.can_read_project(uuid) from public,anon;
revoke execute on function public.project_resource_command(text,jsonb,text) from public,anon;
revoke execute on function private.project_allocation_peak(uuid,date,date,uuid),
  private.project_resource_command(text,jsonb,text) from public,anon,authenticated;

commit;
