begin;

alter table public.projects add column actual_progress numeric(5,2)
  check (actual_progress between 0 and 100);

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  parent_id uuid references public.project_tasks(id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 200),
  assignee_id uuid references public.employees(id) on delete restrict,
  status text not null default 'PLANNED' check (status in ('PLANNED','IN_PROGRESS','ON_HOLD','DONE')),
  priority text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH','URGENT')),
  planned_start_date date not null,
  planned_end_date date not null,
  actual_start_date date,
  actual_end_date date,
  progress numeric(5,2) not null default 0 check (progress between 0 and 100),
  description text check (length(description) <= 4000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (planned_end_date >= planned_start_date),
  check (actual_end_date is null or actual_start_date is not null and actual_end_date >= actual_start_date),
  check (parent_id is distinct from id)
);
create index project_tasks_project on public.project_tasks(project_id,planned_start_date);
create index project_tasks_parent on public.project_tasks(parent_id);

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 160),
  planned_date date not null,
  completed_date date,
  status text not null default 'PLANNED' check (status in ('PLANNED','IN_PROGRESS','COMPLETED','ON_HOLD')),
  description text check (length(description) <= 2000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_milestones_project on public.project_milestones(project_id,planned_date);

create table public.project_issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  kind text not null check (kind in ('ISSUE','RISK')),
  title text not null check (length(trim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 4000),
  assignee_id uuid references public.employees(id) on delete restrict,
  priority text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH','URGENT')),
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  target_date date,
  resolved_date date,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_issues_project on public.project_issues(project_id,status,target_date);

alter table public.project_tasks enable row level security;
alter table public.project_milestones enable row level security;
alter table public.project_issues enable row level security;
revoke all on public.project_tasks,public.project_milestones,public.project_issues from anon,authenticated;
grant select on public.project_tasks,public.project_milestones,public.project_issues to authenticated;
create policy project_tasks_read on public.project_tasks for select to authenticated using (private.can_read_project(project_id));
create policy project_milestones_read on public.project_milestones for select to authenticated using (private.can_read_project(project_id));
create policy project_issues_read on public.project_issues for select to authenticated using (private.can_read_project(project_id));

create trigger touch_project_tasks before update on public.project_tasks for each row execute function private.touch_versioned_row();
create trigger touch_project_milestones before update on public.project_milestones for each row execute function private.touch_versioned_row();
create trigger touch_project_issues before update on public.project_issues for each row execute function private.touch_versioned_row();
create trigger audit_project_tasks after insert or update on public.project_tasks for each row execute function private.capture_audit();
create trigger audit_project_milestones after insert or update on public.project_milestones for each row execute function private.capture_audit();
create trigger audit_project_issues after insert or update on public.project_issues for each row execute function private.capture_audit();

-- Keep the existing project and assignment command unchanged for old clients.
alter function private.project_resource_command(text,jsonb,text) rename to project_resource_command_legacy;
create function private.project_resource_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  project_row public.projects;
  task_row public.project_tasks;
  milestone_row public.project_milestones;
  issue_row public.project_issues;
  item jsonb;
  result jsonb;
  saved jsonb := '[]'::jsonb;
  parent_project uuid;
  target uuid;
begin
  if p_action in ('project.save','project_assignment.save') then
    if p_action='project_assignment.save' then
      perform pg_advisory_xact_lock(hashtextextended(p_payload->>'user_id', 41));
    end if;
    return private.project_resource_command_legacy(p_action,p_payload,p_request_id);
  end if;
  if auth.uid() is null then raise exception 'Unauthorized' using errcode='28000'; end if;
  perform set_config('app.request_id',left(coalesce(p_request_id,''),100),true);
  if p_action='project_assignment.batch' then
    perform private.require_permission('PROJECT_RESOURCE_MANAGE');
    if jsonb_typeof(p_payload->'user_ids')<>'array' or jsonb_array_length(p_payload->'user_ids') not between 1 and 100 then
      raise exception 'ValidationError' using errcode='22023';
    end if;
    for item in select distinct value from jsonb_array_elements(p_payload->'user_ids') loop
      result:=private.project_resource_command('project_assignment.save',
        (p_payload-'user_ids')||jsonb_build_object('user_id',item),p_request_id);
      saved:=saved||jsonb_build_array(result);
    end loop;
    return jsonb_build_object('message',jsonb_array_length(saved)||'명을 투입했습니다.',
      'over_allocated',exists(select 1 from jsonb_array_elements(saved) x where (x->>'over_allocated')::boolean),
      'results',saved);
  end if;

  if p_action='project.progress' then
    perform private.require_permission('PROJECT_WRITE');
  else
    perform private.require_permission('PROJECT_RESOURCE_MANAGE');
  end if;
  select * into project_row from public.projects where id=(p_payload->>'project_id')::uuid for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if not private.has_permission('PROJECT_READ_ALL') and project_row.project_manager_id<>auth.uid() then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  target:=nullif(p_payload->>'id','')::uuid;

  if p_action='project.progress' then
    if project_row.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
    update public.projects set actual_progress=(p_payload->>'actual_progress')::numeric where id=project_row.id;
  elsif p_action='project_task.save' then
    if p_payload->>'parent_id' is not null and p_payload->>'parent_id'<>'' then
      select project_id into parent_project from public.project_tasks where id=(p_payload->>'parent_id')::uuid;
      if parent_project is distinct from project_row.id or target=(p_payload->>'parent_id')::uuid then
        raise exception 'ValidationError' using errcode='22023';
      end if;
    end if;
    if target is null then
      insert into public.project_tasks(project_id,parent_id,title,assignee_id,status,priority,planned_start_date,planned_end_date,
        actual_start_date,actual_end_date,progress,description)
      values(project_row.id,nullif(p_payload->>'parent_id','')::uuid,trim(p_payload->>'title'),nullif(p_payload->>'assignee_id','')::uuid,
        p_payload->>'status',p_payload->>'priority',(p_payload->>'planned_start_date')::date,(p_payload->>'planned_end_date')::date,
        nullif(p_payload->>'actual_start_date','')::date,nullif(p_payload->>'actual_end_date','')::date,
        (p_payload->>'progress')::numeric,nullif(trim(p_payload->>'description'),'')) returning id into target;
    else
      select * into task_row from public.project_tasks where id=target and project_id=project_row.id for update;
      if not found then raise exception 'NotFound' using errcode='P0002'; end if;
      if task_row.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
      -- A task cannot be moved beneath one of its descendants.
      if exists(with recursive descendants as (
        select id from public.project_tasks where parent_id=target
        union all select t.id from public.project_tasks t join descendants d on t.parent_id=d.id
      ) select 1 from descendants where id=nullif(p_payload->>'parent_id','')::uuid) then
        raise exception 'ValidationError' using errcode='22023';
      end if;
      update public.project_tasks set parent_id=nullif(p_payload->>'parent_id','')::uuid,title=trim(p_payload->>'title'),
        assignee_id=nullif(p_payload->>'assignee_id','')::uuid,status=p_payload->>'status',priority=p_payload->>'priority',
        planned_start_date=(p_payload->>'planned_start_date')::date,planned_end_date=(p_payload->>'planned_end_date')::date,
        actual_start_date=nullif(p_payload->>'actual_start_date','')::date,actual_end_date=nullif(p_payload->>'actual_end_date','')::date,
        progress=(p_payload->>'progress')::numeric,description=nullif(trim(p_payload->>'description'),'') where id=target;
    end if;
  elsif p_action='project_milestone.save' then
    if target is null then
      insert into public.project_milestones(project_id,name,planned_date,completed_date,status,description)
      values(project_row.id,trim(p_payload->>'name'),(p_payload->>'planned_date')::date,nullif(p_payload->>'completed_date','')::date,
        p_payload->>'status',nullif(trim(p_payload->>'description'),'')) returning id into target;
    else
      select * into milestone_row from public.project_milestones where id=target and project_id=project_row.id for update;
      if not found then raise exception 'NotFound' using errcode='P0002'; end if;
      if milestone_row.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
      update public.project_milestones set name=trim(p_payload->>'name'),planned_date=(p_payload->>'planned_date')::date,
        completed_date=nullif(p_payload->>'completed_date','')::date,status=p_payload->>'status',
        description=nullif(trim(p_payload->>'description'),'') where id=target;
    end if;
  elsif p_action='project_issue.save' then
    if target is null then
      insert into public.project_issues(project_id,kind,title,description,assignee_id,priority,status,target_date,resolved_date)
      values(project_row.id,p_payload->>'kind',trim(p_payload->>'title'),coalesce(p_payload->>'description',''),
        nullif(p_payload->>'assignee_id','')::uuid,p_payload->>'priority',p_payload->>'status',
        nullif(p_payload->>'target_date','')::date,nullif(p_payload->>'resolved_date','')::date) returning id into target;
    else
      select * into issue_row from public.project_issues where id=target and project_id=project_row.id for update;
      if not found then raise exception 'NotFound' using errcode='P0002'; end if;
      if issue_row.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
      update public.project_issues set kind=p_payload->>'kind',title=trim(p_payload->>'title'),description=p_payload->>'description',
        assignee_id=nullif(p_payload->>'assignee_id','')::uuid,priority=p_payload->>'priority',status=p_payload->>'status',
        target_date=nullif(p_payload->>'target_date','')::date,resolved_date=nullif(p_payload->>'resolved_date','')::date where id=target;
    end if;
  else
    raise exception 'unsupported project/resource action' using errcode='22023';
  end if;
  return jsonb_build_object('id',coalesce(target,project_row.id),'message','저장했습니다.');
end;
$$;
revoke execute on function private.project_resource_command(text,jsonb,text),
  private.project_resource_command_legacy(text,jsonb,text) from public,anon,authenticated;

-- Date buckets are calculated in the database so the board does not load years of allocations.
create function public.resource_capacity(p_start date,p_end date,p_granularity text default 'month')
returns table(user_id uuid,bucket_start date,average_allocation numeric,peak_allocation numeric,minimum_availability numeric)
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_permission('RESOURCE_READ');
  if p_start is null or p_end is null or p_end<p_start or p_end-p_start>185 or p_granularity not in ('week','month') then
    raise exception 'ValidationError' using errcode='22023';
  end if;
  return query
  with daily as (
    select e.id as employee_id,d.day::date as work_day,
      coalesce(sum(a.allocation_rate),0) as rate
    from public.employees e
    cross join generate_series(p_start,p_end,'1 day'::interval) d(day)
    left join public.project_assignments a on a.user_id=e.id
      and a.status in ('PLANNED','CONFIRMED','IN_PROGRESS')
      and d.day::date between a.planned_start_date and a.planned_end_date
    where e.user_status='ACTIVE'
    group by e.id,d.day
  )
  select employee_id,date_trunc(p_granularity,work_day)::date,
    round(avg(rate),1),max(rate),greatest(0,100-max(rate)) from daily
  group by employee_id,date_trunc(p_granularity,work_day)::date;
end;
$$;
create function public.resource_leave_windows(p_start date,p_end date)
returns table(user_id uuid,start_date date,end_date date,leave_type text)
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_permission('RESOURCE_READ');
  if p_start is null or p_end is null or p_end<p_start or p_end-p_start>185 then
    raise exception 'ValidationError' using errcode='22023';
  end if;
  return query select l.user_id,l.start_date,l.end_date,l.leave_type
    from public.leave_requests l where l.status='APPROVED' and l.start_date<=p_end and l.end_date>=p_start;
end;
$$;
revoke execute on function public.resource_capacity(date,date,text),public.resource_leave_windows(date,date) from public,anon;
grant execute on function public.resource_capacity(date,date,text),public.resource_leave_windows(date,date) to authenticated;
commit;
