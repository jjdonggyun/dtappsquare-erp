begin;

insert into public.permissions(code,description) values
 ('WORK_LOG_READ_SELF','본인 업무일지 조회'),('WORK_LOG_WRITE_SELF','본인 업무일지 작성'),
 ('WORK_LOG_READ_TEAM','관리 조직 업무일지 조회'),('WORK_LOG_READ_ALL','전사 업무일지 조회'),
 ('WORK_LOG_READ_PROJECT','담당 프로젝트 업무일지 조회'),
 ('WEEKLY_REPORT_READ_SELF','본인 주간보고 조회'),('WEEKLY_REPORT_WRITE_SELF','본인 주간보고 작성'),
 ('WEEKLY_REPORT_READ_TEAM','관리 조직 주간보고 조회'),('WEEKLY_REPORT_READ_ALL','전사 주간보고 조회')
on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where
 (r.code='EMPLOYEE' and p.code in ('WORK_LOG_READ_SELF','WORK_LOG_WRITE_SELF','WEEKLY_REPORT_READ_SELF','WEEKLY_REPORT_WRITE_SELF'))
 or (r.code='TEAM_MANAGER' and p.code in ('WORK_LOG_READ_TEAM','WEEKLY_REPORT_READ_TEAM'))
 or (r.code='PROJECT_MANAGER' and p.code='WORK_LOG_READ_PROJECT')
 or (r.code='HR_MANAGER' and p.code in ('WORK_LOG_READ_ALL','WEEKLY_REPORT_READ_ALL'))
 or (r.code='ADMIN' and p.code like 'WORK_LOG_%' or r.code='ADMIN' and p.code like 'WEEKLY_REPORT_%')
on conflict do nothing;

create table public.daily_work_logs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.employees(id) on delete restrict,
 work_date date not null,
 work_category text not null check(work_category in ('PROJECT','INTERNAL_DEVELOPMENT','OPERATION','CUSTOMER_SUPPORT','SALES_SUPPORT','EDUCATION','MEETING','DOCUMENT','ADMINISTRATION','ETC')),
 project_id uuid references public.projects(id) on delete restrict,
 project_task_id uuid references public.project_tasks(id) on delete restrict,
 title text not null check(length(trim(title)) between 1 and 200),
 description text not null default '' check(length(description)<=4000),
 start_time time, end_time time,
 work_minutes integer not null check(work_minutes between 1 and 1440),
 progress numeric(5,2) check(progress between 0 and 100),
 status text not null default 'DONE' check(status in ('PLANNED','IN_PROGRESS','DONE','BLOCKED')),
 blocker text check(blocker is null or length(blocker)<=2000),
 memo text check(memo is null or length(memo)<=2000),
 deleted_at timestamptz,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((work_category='PROJECT' and project_id is not null) or (work_category<>'PROJECT' and project_id is null and project_task_id is null)),
 check(project_task_id is null or project_id is not null),
 check((start_time is null and end_time is null) or (start_time is not null and end_time is not null and end_time>start_time)),
 check(start_time is null or work_minutes=extract(epoch from(end_time-start_time))/60)
);
create index daily_work_logs_user_date on public.daily_work_logs(user_id,work_date desc) where deleted_at is null;
create index daily_work_logs_project_date on public.daily_work_logs(project_id,work_date desc) where project_id is not null and deleted_at is null;
create index daily_work_logs_date on public.daily_work_logs(work_date desc) where deleted_at is null;
create trigger touch_daily_work_logs before update on public.daily_work_logs for each row execute function private.touch_versioned_row();
create trigger audit_daily_work_logs after insert or update on public.daily_work_logs for each row execute function private.capture_audit();

create table public.weekly_reports (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.employees(id) on delete restrict,
 week_start_date date not null check(extract(isodow from week_start_date)=1),
 week_end_date date not null,
 summary text not null default '' check(length(summary)<=4000),
 completed_work text not null default '' check(length(completed_work)<=8000),
 in_progress_work text not null default '' check(length(in_progress_work)<=8000),
 issues text not null default '' check(length(issues)<=4000),
 next_week_plan text not null default '' check(length(next_week_plan)<=4000),
 entries_snapshot jsonb not null default '[]'::jsonb check(jsonb_typeof(entries_snapshot)='array'),
 status text not null default 'DRAFT' check(status in ('DRAFT','CONFIRMED')),
 snapshot_taken_at timestamptz not null default now(),
 confirmed_at timestamptz,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(user_id,week_start_date),
 check(week_end_date=week_start_date+4),
 check((status='CONFIRMED')=(confirmed_at is not null))
);
create index weekly_reports_week_status on public.weekly_reports(week_start_date,status,user_id);
create trigger touch_weekly_reports before update on public.weekly_reports for each row execute function private.touch_versioned_row();
create trigger audit_weekly_reports after insert or update on public.weekly_reports for each row execute function private.capture_audit();

create function private.can_read_daily_work_log(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(
   select 1 from public.daily_work_logs l join public.employees e on e.id=l.user_id
   where l.id=p_id and l.deleted_at is null and (
     (l.user_id=auth.uid() and private.has_permission('WORK_LOG_READ_SELF'))
     or private.has_permission('WORK_LOG_READ_ALL')
     or (private.has_permission('WORK_LOG_READ_TEAM') and private.manages_organization(e.organization_id))
     or (l.project_id is not null and private.has_permission('WORK_LOG_READ_PROJECT') and exists(
       select 1 from public.projects p where p.id=l.project_id and p.project_manager_id=auth.uid()
     ))
   )
 );
$$;
create function private.can_read_weekly_report(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(
   select 1 from public.weekly_reports r join public.employees e on e.id=r.user_id
   where r.id=p_id and (
     (r.user_id=auth.uid() and private.has_permission('WEEKLY_REPORT_READ_SELF'))
     or private.has_permission('WEEKLY_REPORT_READ_ALL')
     or (private.has_permission('WEEKLY_REPORT_READ_TEAM') and private.manages_organization(e.organization_id))
   )
 );
$$;
alter table public.daily_work_logs enable row level security;
alter table public.weekly_reports enable row level security;
revoke all on public.daily_work_logs,public.weekly_reports from anon,authenticated;
grant select on public.daily_work_logs,public.weekly_reports to authenticated;
create policy daily_work_logs_read on public.daily_work_logs for select to authenticated using(private.can_read_daily_work_log(id));
create policy weekly_reports_read on public.weekly_reports for select to authenticated using(private.can_read_weekly_report(id));
grant execute on function private.can_read_daily_work_log(uuid),private.can_read_weekly_report(uuid) to authenticated;
revoke execute on function private.can_read_daily_work_log(uuid),private.can_read_weekly_report(uuid) from public,anon;

create function private.work_management_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row_data public.daily_work_logs; report_row public.weekly_reports;
 target uuid; project_ref uuid; task_ref uuid; week_start date; entries jsonb; completed text; in_progress text; blockers text;
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='28000'; end if;
 perform set_config('app.request_id',left(coalesce(p_request_id,''),100),true);
 if p_action='work_log.save' then
   perform private.require_permission('WORK_LOG_WRITE_SELF');
   target:=nullif(p_payload->>'id','')::uuid;
   project_ref:=nullif(p_payload->>'project_id','')::uuid;
   task_ref:=nullif(p_payload->>'project_task_id','')::uuid;
   if (p_payload->>'work_category'='PROJECT') is distinct from (project_ref is not null) then
     raise exception 'ValidationError' using errcode='22023';
   end if;
   if project_ref is not null then
     if not private.can_read_project(project_ref) then raise exception 'Forbidden' using errcode='42501'; end if;
     if task_ref is not null and not exists(select 1 from public.project_tasks where id=task_ref and project_id=project_ref) then
       raise exception 'ValidationError' using errcode='22023';
     end if;
   elsif task_ref is not null then raise exception 'ValidationError' using errcode='22023'; end if;
   if target is null then
     insert into public.daily_work_logs(user_id,work_date,work_category,project_id,project_task_id,title,description,
       start_time,end_time,work_minutes,progress,status,blocker,memo)
     values(auth.uid(),(p_payload->>'work_date')::date,p_payload->>'work_category',project_ref,task_ref,
       trim(p_payload->>'title'),coalesce(p_payload->>'description',''),nullif(p_payload->>'start_time','')::time,
       nullif(p_payload->>'end_time','')::time,(p_payload->>'work_minutes')::integer,
       nullif(p_payload->>'progress','')::numeric,p_payload->>'status',nullif(p_payload->>'blocker',''),nullif(p_payload->>'memo',''))
     returning id into target;
   else
     select * into row_data from public.daily_work_logs where id=target for update;
     if not found then raise exception 'NotFound' using errcode='P0002'; end if;
     if row_data.user_id<>auth.uid() then raise exception 'Forbidden' using errcode='42501'; end if;
     if row_data.deleted_at is not null or row_data.version is distinct from(p_payload->>'version')::integer then
       raise exception 'Conflict' using errcode='40001'; end if;
     update public.daily_work_logs set work_date=(p_payload->>'work_date')::date,work_category=p_payload->>'work_category',
       project_id=project_ref,project_task_id=task_ref,title=trim(p_payload->>'title'),description=coalesce(p_payload->>'description',''),
       start_time=nullif(p_payload->>'start_time','')::time,end_time=nullif(p_payload->>'end_time','')::time,
       work_minutes=(p_payload->>'work_minutes')::integer,progress=nullif(p_payload->>'progress','')::numeric,
       status=p_payload->>'status',blocker=nullif(p_payload->>'blocker',''),memo=nullif(p_payload->>'memo','') where id=target;
   end if;
   return jsonb_build_object('id',target,'message','업무일지를 저장했습니다.');
 elsif p_action='work_log.delete' then
   perform private.require_permission('WORK_LOG_WRITE_SELF');
   select * into row_data from public.daily_work_logs where id=(p_payload->>'id')::uuid for update;
   if not found then raise exception 'NotFound' using errcode='P0002'; end if;
   if row_data.user_id<>auth.uid() then raise exception 'Forbidden' using errcode='42501'; end if;
   if row_data.deleted_at is not null or row_data.version is distinct from(p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   update public.daily_work_logs set deleted_at=now() where id=row_data.id;
   return jsonb_build_object('id',row_data.id,'message','업무일지를 삭제했습니다.');
 elsif p_action in ('weekly_report.generate','weekly_report.refresh','weekly_report.save','weekly_report.confirm') then
   perform private.require_permission('WEEKLY_REPORT_WRITE_SELF');
   week_start:=(p_payload->>'week_start_date')::date;
   if week_start is null or extract(isodow from week_start)<>1 then raise exception 'ValidationError' using errcode='22023'; end if;
   select * into report_row from public.weekly_reports where user_id=auth.uid() and week_start_date=week_start for update;
   if p_action='weekly_report.generate' and found then return jsonb_build_object('id',report_row.id,'message','기존 주간보고를 열었습니다.'); end if;
   if p_action in ('weekly_report.generate','weekly_report.refresh') then
     if p_action='weekly_report.refresh' and not found then raise exception 'NotFound' using errcode='P0002'; end if;
     if found and report_row.status='CONFIRMED' then raise exception 'Conflict' using errcode='40001'; end if;
     select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'date',l.work_date,'category',l.work_category,
       'project_id',l.project_id,'project_name',p.project_name,'title',l.title,'description',l.description,
       'minutes',l.work_minutes,'status',l.status,'blocker',l.blocker) order by l.work_date,l.start_time,l.created_at),'[]'::jsonb),
       coalesce(string_agg(case when l.status='DONE' then '• '||l.title else null end,E'\n' order by l.work_date,l.start_time),''),
       coalesce(string_agg(case when l.status in ('PLANNED','IN_PROGRESS') then '• '||l.title else null end,E'\n' order by l.work_date,l.start_time),''),
       coalesce(string_agg(case when l.status='BLOCKED' then '• '||l.title||coalesce(' — '||l.blocker,'') else null end,E'\n' order by l.work_date,l.start_time),'')
       into entries,completed,in_progress,blockers
       from public.daily_work_logs l left join public.projects p on p.id=l.project_id
       where l.user_id=auth.uid() and l.work_date between week_start and week_start+4 and l.deleted_at is null;
     if p_action='weekly_report.generate' then
       insert into public.weekly_reports(user_id,week_start_date,week_end_date,entries_snapshot,completed_work,in_progress_work,issues)
       values(auth.uid(),week_start,week_start+4,entries,completed,in_progress,blockers)
       on conflict(user_id,week_start_date) do nothing returning id into target;
       if target is null then select id into target from public.weekly_reports where user_id=auth.uid() and week_start_date=week_start; end if;
     else
       if report_row.version is distinct from(p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
       update public.weekly_reports set entries_snapshot=entries,completed_work=completed,in_progress_work=in_progress,
         issues=blockers,snapshot_taken_at=now() where id=report_row.id;
       target:=report_row.id;
     end if;
     return jsonb_build_object('id',target,'message','업무일지에서 주간보고 초안을 만들었습니다.');
   end if;
   if not found then raise exception 'NotFound' using errcode='P0002'; end if;
   if report_row.status='CONFIRMED' or report_row.version is distinct from(p_payload->>'version')::integer then
     raise exception 'Conflict' using errcode='40001'; end if;
   if p_action='weekly_report.save' then
     update public.weekly_reports set summary=coalesce(p_payload->>'summary',''),completed_work=coalesce(p_payload->>'completed_work',''),
       in_progress_work=coalesce(p_payload->>'in_progress_work',''),issues=coalesce(p_payload->>'issues',''),
       next_week_plan=coalesce(p_payload->>'next_week_plan','') where id=report_row.id;
   else
     update public.weekly_reports set status='CONFIRMED',confirmed_at=now() where id=report_row.id;
   end if;
   return jsonb_build_object('id',report_row.id,'message',case when p_action='weekly_report.confirm' then '주간보고를 확정했습니다.' else '주간보고를 저장했습니다.' end);
 end if;
 raise exception 'unsupported work management action' using errcode='22023';
end;
$$;
create function public.work_management_command(p_action text,p_payload jsonb,p_request_id text default null)
returns jsonb language sql security definer set search_path='' as $$
 select private.work_management_command(p_action,p_payload,p_request_id);
$$;
grant execute on function public.work_management_command(text,jsonb,text) to authenticated;
revoke execute on function public.work_management_command(text,jsonb,text),private.work_management_command(text,jsonb,text) from public,anon;
revoke execute on function private.work_management_command(text,jsonb,text) from authenticated;

create function public.weekly_report_roster(p_week_start date)
returns table(user_id uuid,name text,organization_id uuid,report_id uuid,status text,approved_leave_days integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not (private.has_permission('WEEKLY_REPORT_READ_SELF') or private.has_permission('WEEKLY_REPORT_READ_TEAM') or private.has_permission('WEEKLY_REPORT_READ_ALL')) then
   raise exception 'Forbidden' using errcode='42501'; end if;
 if p_week_start is null or extract(isodow from p_week_start)<>1 then raise exception 'ValidationError' using errcode='22023'; end if;
 return query select e.id,e.name,e.organization_id,r.id,r.status,
   (select count(distinct d.day)::integer from public.leave_requests l
     cross join generate_series(greatest(l.start_date,p_week_start),least(l.end_date,p_week_start+4),'1 day'::interval) d(day)
     where l.user_id=e.id and l.status='APPROVED' and l.start_date<=p_week_start+4 and l.end_date>=p_week_start
       and l.leave_type not in ('HALF_DAY_AM','HALF_DAY_PM'))
 from public.employees e left join public.weekly_reports r on r.user_id=e.id and r.week_start_date=p_week_start
 where e.user_status='ACTIVE' and (
   private.has_permission('WEEKLY_REPORT_READ_ALL') or
   (private.has_permission('WEEKLY_REPORT_READ_TEAM') and private.manages_organization(e.organization_id)) or
   (e.id=auth.uid() and private.has_permission('WEEKLY_REPORT_READ_SELF'))
 ) order by e.name,e.id;
end;
$$;
grant execute on function public.weekly_report_roster(date) to authenticated;
revoke execute on function public.weekly_report_roster(date) from public,anon;
commit;
