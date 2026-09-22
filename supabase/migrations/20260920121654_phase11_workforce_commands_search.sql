begin;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.code='WORKFORCE_PROFILE_STAFFING_READ'
where r.code='HR_MANAGER' on conflict do nothing;
alter table public.project_staffing_requirements add constraint staffing_search_period_limit
 check(planned_end_date-planned_start_date<=185);
create unique index workforce_export_audit_request on public.audit_logs(actor_user_id,request_id,entity_id)
 where action='EXPORT' and entity_type='workforce_profiles' and request_id is not null;

create table public.workforce_command_receipts(
 actor_user_id uuid not null references public.employees(id) on delete restrict,
 request_id text not null check(length(request_id) between 16 and 100),
 action text not null,payload_hash bytea not null,result jsonb not null,
 created_at timestamptz not null default now(),primary key(actor_user_id,request_id)
);
create index workforce_command_receipts_created on public.workforce_command_receipts(created_at);
alter table public.workforce_command_receipts enable row level security;
revoke all on public.workforce_command_receipts from anon,authenticated;

create function public.workforce_profile_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare subject uuid; target uuid; row_version integer; existing_source text; existing_user uuid;
  req public.project_staffing_requirements; assignment public.project_assignments;
  prior public.workforce_command_receipts; content_hash bytea; output jsonb; chosen boolean;
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='28000'; end if;
 if not private.is_active() then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_request_id is null or length(p_request_id) not between 16 and 100
 then raise exception 'ValidationError' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_request_id,0));
 content_hash:=extensions.digest(p_payload::text,'sha256');
 select * into prior from public.workforce_command_receipts where actor_user_id=auth.uid() and request_id=p_request_id;
 if found then
  if prior.action<>p_action or prior.payload_hash<>content_hash then raise exception 'Idempotency conflict' using errcode='40001'; end if;
  return prior.result;
 end if;
 perform set_config('app.request_id',p_request_id,true);
 subject:=nullif(p_payload->>'user_id','')::uuid;
 target:=nullif(p_payload->>'id','')::uuid;

 if p_action='profile.save' then
  if not private.can_write_workforce_profile(subject) then raise exception 'Forbidden' using errcode='42501'; end if;
  if not private.has_permission('WORKFORCE_PROFILE_MANAGE') and
    (p_payload ? 'career_months_override' or p_payload ? 'career_override_reason')
  then raise exception 'Forbidden' using errcode='42501'; end if;
  select version into row_version from public.workforce_profiles where user_id=subject for update;
  if found then
   if row_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   update public.workforce_profiles set birth_date=nullif(p_payload->>'birth_date','')::date,
    career_start_date=nullif(p_payload->>'career_start_date','')::date,
    summary=coalesce(p_payload->>'summary',''),profile_status=coalesce(p_payload->>'profile_status','DRAFT'),
    career_months_override=case when p_payload ? 'career_months_override' then nullif(p_payload->>'career_months_override','')::integer else career_months_override end,
    career_override_reason=case when p_payload ? 'career_override_reason' then nullif(trim(p_payload->>'career_override_reason'),'') else career_override_reason end
   where user_id=subject;
  else
   insert into public.workforce_profiles(user_id,birth_date,career_start_date,summary,profile_status,career_months_override,career_override_reason)
   values(subject,nullif(p_payload->>'birth_date','')::date,nullif(p_payload->>'career_start_date','')::date,
    coalesce(p_payload->>'summary',''),coalesce(p_payload->>'profile_status','DRAFT'),
    nullif(p_payload->>'career_months_override','')::integer,nullif(trim(p_payload->>'career_override_reason'),''));
  end if;
  output:=jsonb_build_object('id',subject,'message','인력프로필을 저장했습니다.');

 elsif p_action='education.save' then
  if not private.can_write_workforce_profile(subject) then raise exception 'Forbidden' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('education:'||subject::text,0));
  chosen:=coalesce((p_payload->>'highest_education')::boolean,false) and coalesce((p_payload->>'active')::boolean,true);
  if target is null then
   if chosen then update public.workforce_educations set highest_education=false where user_id=subject and highest_education and active; end if;
   insert into public.workforce_educations(user_id,school_name,degree,major,start_date,end_date,graduation_status,highest_education,sort_order,active)
   values(subject,trim(p_payload->>'school_name'),coalesce(p_payload->>'degree',''),coalesce(p_payload->>'major',''),
    nullif(p_payload->>'start_date','')::date,nullif(p_payload->>'end_date','')::date,
    coalesce(p_payload->>'graduation_status','GRADUATED'),chosen,coalesce((p_payload->>'sort_order')::integer,0),
    coalesce((p_payload->>'active')::boolean,true)) returning id into target;
  else
   select version into row_version from public.workforce_educations where id=target and user_id=subject for update;
   if not found or row_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   if chosen then update public.workforce_educations set highest_education=false where user_id=subject and id<>target and highest_education and active; end if;
   update public.workforce_educations set school_name=trim(p_payload->>'school_name'),degree=coalesce(p_payload->>'degree',''),
    major=coalesce(p_payload->>'major',''),start_date=nullif(p_payload->>'start_date','')::date,
    end_date=nullif(p_payload->>'end_date','')::date,graduation_status=coalesce(p_payload->>'graduation_status','GRADUATED'),
    highest_education=chosen,sort_order=coalesce((p_payload->>'sort_order')::integer,0),active=coalesce((p_payload->>'active')::boolean,true)
   where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','학력을 저장했습니다.');

 elsif p_action='skill_catalog.save' then
  perform private.require_permission('WORKFORCE_PROFILE_MANAGE');
  if target is null then
   insert into public.skills(code,name,category,active) values(upper(trim(p_payload->>'code')),trim(p_payload->>'name'),
    trim(p_payload->>'category'),coalesce((p_payload->>'active')::boolean,true)) returning id into target;
  else
   select version into row_version from public.skills where id=target for update;
   if not found or row_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   update public.skills set code=upper(trim(p_payload->>'code')),name=trim(p_payload->>'name'),
    category=trim(p_payload->>'category'),active=coalesce((p_payload->>'active')::boolean,true) where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','기술 카탈로그를 저장했습니다.');

 elsif p_action='employee_skill.save' then
  if not private.can_write_workforce_profile(subject) then raise exception 'Forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.skills where id=(p_payload->>'skill_id')::uuid and active) then raise exception 'NotFound' using errcode='P0002'; end if;
  if target is null then
   select id,version into target,row_version from public.employee_skills
    where user_id=subject and skill_id=(p_payload->>'skill_id')::uuid for update;
   if found and exists(select 1 from public.employee_skills where id=target and active) then raise exception 'Conflict' using errcode='40001'; end if;
  else
   select version into row_version from public.employee_skills where id=target and user_id=subject for update;
   if not found or row_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
  end if;
  if target is null then
   insert into public.employee_skills(user_id,skill_id,level,years_experience,last_used_date,memo,active)
   values(subject,(p_payload->>'skill_id')::uuid,nullif(p_payload->>'level',''),nullif(p_payload->>'years_experience','')::numeric,
    nullif(p_payload->>'last_used_date','')::date,coalesce(p_payload->>'memo',''),coalesce((p_payload->>'active')::boolean,true)) returning id into target;
  else
   update public.employee_skills set skill_id=(p_payload->>'skill_id')::uuid,level=nullif(p_payload->>'level',''),
    years_experience=nullif(p_payload->>'years_experience','')::numeric,last_used_date=nullif(p_payload->>'last_used_date','')::date,
    memo=coalesce(p_payload->>'memo',''),active=coalesce((p_payload->>'active')::boolean,true) where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','보유 기술을 저장했습니다.');

 elsif p_action='certification.save' then
  if not private.can_write_workforce_profile(subject) then raise exception 'Forbidden' using errcode='42501'; end if;
  if target is null then
   insert into public.workforce_certifications(user_id,certification_name,issuer,obtained_date,expiry_date,credential_id,active)
   values(subject,trim(p_payload->>'certification_name'),coalesce(p_payload->>'issuer',''),nullif(p_payload->>'obtained_date','')::date,
    nullif(p_payload->>'expiry_date','')::date,nullif(p_payload->>'credential_id',''),coalesce((p_payload->>'active')::boolean,true)) returning id into target;
  else
   select version into row_version from public.workforce_certifications where id=target and user_id=subject for update;
   if not found or row_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   update public.workforce_certifications set certification_name=trim(p_payload->>'certification_name'),issuer=coalesce(p_payload->>'issuer',''),
    obtained_date=nullif(p_payload->>'obtained_date','')::date,expiry_date=nullif(p_payload->>'expiry_date','')::date,
    credential_id=nullif(p_payload->>'credential_id',''),active=coalesce((p_payload->>'active')::boolean,true) where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','자격을 저장했습니다.');

 elsif p_action='experience.save' then
  if not private.can_write_workforce_profile(subject) then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_payload->>'source_type'='INTERNAL_PROJECT' and not exists(
   select 1 from public.project_assignments a where a.id=(p_payload->>'project_assignment_id')::uuid and a.user_id=subject)
  then raise exception 'Forbidden' using errcode='42501'; end if;
  if target is null then
   insert into public.workforce_project_experiences(user_id,source_type,project_assignment_id,project_name,customer_name,category,
    start_date,end_date,role,responsibilities,technologies,sort_order,active)
   values(subject,p_payload->>'source_type',nullif(p_payload->>'project_assignment_id','')::uuid,
    nullif(p_payload->>'project_name',''),nullif(p_payload->>'customer_name',''),nullif(p_payload->>'category',''),
    nullif(p_payload->>'start_date','')::date,nullif(p_payload->>'end_date','')::date,nullif(p_payload->>'role',''),
    trim(p_payload->>'responsibilities'),coalesce(p_payload->>'technologies',''),coalesce((p_payload->>'sort_order')::integer,0),
    coalesce((p_payload->>'active')::boolean,true)) returning id into target;
  else
   select user_id,source_type,version into existing_user,existing_source,row_version from public.workforce_project_experiences where id=target for update;
   if not found or existing_user<>subject or existing_source<>p_payload->>'source_type' or row_version is distinct from (p_payload->>'version')::integer
   then raise exception 'Conflict' using errcode='40001'; end if;
   update public.workforce_project_experiences set project_assignment_id=nullif(p_payload->>'project_assignment_id','')::uuid,
    project_name=nullif(p_payload->>'project_name',''),customer_name=nullif(p_payload->>'customer_name',''),category=nullif(p_payload->>'category',''),
    start_date=nullif(p_payload->>'start_date','')::date,end_date=nullif(p_payload->>'end_date','')::date,role=nullif(p_payload->>'role',''),
    responsibilities=trim(p_payload->>'responsibilities'),technologies=coalesce(p_payload->>'technologies',''),
    sort_order=coalesce((p_payload->>'sort_order')::integer,0),active=coalesce((p_payload->>'active')::boolean,true)
   where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','프로젝트 경력을 저장했습니다.');

 elsif p_action='requirement.save' then
  if not private.can_manage_staffing((p_payload->>'project_id')::uuid) then raise exception 'Forbidden' using errcode='42501'; end if;
  if target is null then
   insert into public.project_staffing_requirements(project_id,role_name,required_headcount,planned_start_date,planned_end_date,
    allocation_rate,description,lifecycle_status)
   values((p_payload->>'project_id')::uuid,trim(p_payload->>'role_name'),(p_payload->>'required_headcount')::integer,
    (p_payload->>'planned_start_date')::date,(p_payload->>'planned_end_date')::date,(p_payload->>'allocation_rate')::numeric,
    coalesce(p_payload->>'description',''),coalesce(p_payload->>'lifecycle_status','OPEN')) returning id into target;
  else
   select * into req from public.project_staffing_requirements where id=target for update;
   if not found or req.project_id<>(p_payload->>'project_id')::uuid or req.version is distinct from (p_payload->>'version')::integer
   then raise exception 'Conflict' using errcode='40001'; end if;
   update public.project_staffing_requirements set role_name=trim(p_payload->>'role_name'),required_headcount=(p_payload->>'required_headcount')::integer,
    planned_start_date=(p_payload->>'planned_start_date')::date,planned_end_date=(p_payload->>'planned_end_date')::date,
    allocation_rate=(p_payload->>'allocation_rate')::numeric,description=coalesce(p_payload->>'description',''),
    lifecycle_status=coalesce(p_payload->>'lifecycle_status','OPEN') where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','인력 요구사항을 저장했습니다.');

 elsif p_action='requirement_skill.save' then
  select * into req from public.project_staffing_requirements where id=(p_payload->>'requirement_id')::uuid;
  if not found or not private.can_manage_staffing(req.project_id) then raise exception 'Forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.skills where id=(p_payload->>'skill_id')::uuid and active) then raise exception 'NotFound' using errcode='P0002'; end if;
  if target is null then
   select id,version into target,row_version from public.project_staffing_requirement_skills
    where requirement_id=req.id and skill_id=(p_payload->>'skill_id')::uuid for update;
   if found and exists(select 1 from public.project_staffing_requirement_skills where id=target and active) then raise exception 'Conflict' using errcode='40001'; end if;
  else
   select version into row_version from public.project_staffing_requirement_skills where id=target and requirement_id=req.id for update;
   if not found or row_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
  end if;
  if target is null then
   insert into public.project_staffing_requirement_skills(requirement_id,skill_id,preference,target_level,active)
   values(req.id,(p_payload->>'skill_id')::uuid,p_payload->>'preference',nullif(p_payload->>'target_level',''),
    coalesce((p_payload->>'active')::boolean,true)) returning id into target;
  else
   update public.project_staffing_requirement_skills set skill_id=(p_payload->>'skill_id')::uuid,
    preference=p_payload->>'preference',target_level=nullif(p_payload->>'target_level',''),
    active=coalesce((p_payload->>'active')::boolean,true) where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','요구 기술을 저장했습니다.');

 elsif p_action='fulfillment.save' then
  select * into req from public.project_staffing_requirements where id=(p_payload->>'requirement_id')::uuid;
  if not found or not private.can_manage_staffing(req.project_id) then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into assignment from public.project_assignments where id=(p_payload->>'project_assignment_id')::uuid;
  if not found or assignment.project_id<>req.project_id or (coalesce((p_payload->>'active')::boolean,true) and
   (assignment.status in ('CANCELED','ENDED') or assignment.planned_end_date<req.planned_start_date
    or assignment.planned_start_date>req.planned_end_date))
  then raise exception 'ValidationError' using errcode='22023'; end if;
  if target is null then
   insert into public.project_staffing_fulfillments(requirement_id,project_assignment_id,active)
   values(req.id,assignment.id,coalesce((p_payload->>'active')::boolean,true)) returning id into target;
  else
   select version into row_version from public.project_staffing_fulfillments where id=target and requirement_id=req.id for update;
   if not found or row_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   update public.project_staffing_fulfillments set project_assignment_id=assignment.id,
    active=coalesce((p_payload->>'active')::boolean,true) where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','프로젝트 배정과 인력 요구사항을 연결했습니다.');

 else raise exception 'Unsupported action' using errcode='22023';
 end if;
 insert into public.workforce_command_receipts(actor_user_id,request_id,action,payload_hash,result)
 values(auth.uid(),p_request_id,p_action,content_hash,output);
 return output;
end;
$$;
revoke execute on function public.workforce_profile_command(text,jsonb,text) from public,anon;
grant execute on function public.workforce_profile_command(text,jsonb,text) to authenticated;

-- Explicit export permission and per-target audit. The caller generates the file
-- only after reading the RLS-protected profile and calls this just before response.
create function public.workforce_profile_export_audit(p_user_ids uuid[],p_include_birth_date boolean,p_request_id text)
returns integer language plpgsql security definer set search_path='' as $$
declare target uuid; n integer:=0;
begin
 if not private.is_active() or p_user_ids is null or cardinality(p_user_ids) not between 1 and 20
  or p_request_id is null or length(p_request_id) not between 16 and 100
 then raise exception 'Forbidden' using errcode='42501'; end if;
 perform set_config('app.request_id',p_request_id,true);
 foreach target in array p_user_ids loop
  if not private.can_export_workforce_profile(target) then raise exception 'Forbidden' using errcode='42501'; end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,after_data,request_id)
  values(auth.uid(),'EXPORT','workforce_profiles',target::text,
   jsonb_build_object('include_birth_date',coalesce(p_include_birth_date,false)),p_request_id)
  on conflict do nothing;
  n:=n+1;
 end loop;
 return n;
end;
$$;
revoke execute on function public.workforce_profile_export_audit(uuid[],boolean,text) from public,anon;
grant execute on function public.workforce_profile_export_audit(uuid[],boolean,text) to authenticated;

-- One capacity algorithm serves the existing Resource view and scoped staffing queries.
create function private.resource_capacity_core(p_start date,p_end date,p_granularity text)
returns table(user_id uuid,bucket_start date,average_allocation numeric,peak_allocation numeric,minimum_availability numeric)
language sql stable security definer set search_path='' as $$
 with daily as (
  select e.id employee_id,d.day::date work_day,coalesce(sum(a.allocation_rate),0) rate
  from public.employees e cross join generate_series(p_start,p_end,'1 day'::interval) d(day)
  left join public.project_assignments a on a.user_id=e.id and a.status in ('PLANNED','CONFIRMED','IN_PROGRESS')
   and d.day::date between a.planned_start_date and a.planned_end_date
  where e.user_status='ACTIVE' group by e.id,d.day
 )
 select employee_id,case when p_granularity='range' then p_start else date_trunc(p_granularity,work_day)::date end,
  round(avg(rate),1),max(rate),greatest(0,100-max(rate))
 from daily group by employee_id,case when p_granularity='range' then p_start else date_trunc(p_granularity,work_day)::date end;
$$;
revoke execute on function private.resource_capacity_core(date,date,text) from public,anon,authenticated;
create or replace function public.resource_capacity(p_start date,p_end date,p_granularity text default 'month')
returns table(user_id uuid,bucket_start date,average_allocation numeric,peak_allocation numeric,minimum_availability numeric)
language plpgsql stable security definer set search_path='' as $$
begin
 if not (private.has_permission('RESOURCE_READ') or private.has_permission('PROJECT_RESOURCE_MANAGE')) then
  raise exception 'Forbidden' using errcode='42501'; end if;
 if p_start is null or p_end is null or p_end<p_start or p_end-p_start>185 or p_granularity not in ('week','month','range') then
  raise exception 'ValidationError' using errcode='22023'; end if;
 return query select * from private.resource_capacity_core(p_start,p_end,p_granularity);
end;
$$;

create function public.project_staffing_overview(p_project_id uuid)
returns table(id uuid,project_id uuid,role_name text,required_headcount integer,planned_start_date date,
 planned_end_date date,allocation_rate numeric,description text,lifecycle_status text,version integer,
 filled_count integer,staffing_status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_permission('PROJECT_STAFFING_READ') or not private.can_read_project(p_project_id) then
  raise exception 'Forbidden' using errcode='42501'; end if;
 return query select r.id,r.project_id,r.role_name,r.required_headcount,r.planned_start_date,r.planned_end_date,
  r.allocation_rate,r.description,r.lifecycle_status,r.version,
  count(distinct a.user_id)::integer,
  case when r.lifecycle_status='CLOSED' then 'CLOSED'
   when count(distinct a.user_id)=0 then 'OPEN'
   when count(distinct a.user_id)<r.required_headcount then 'PARTIALLY_FILLED' else 'FILLED' end
 from public.project_staffing_requirements r
 left join public.project_staffing_fulfillments f on f.requirement_id=r.id and f.active
 left join public.project_assignments a on a.id=f.project_assignment_id and a.project_id=r.project_id
  and a.status in ('PLANNED','CONFIRMED','IN_PROGRESS')
  and a.planned_end_date>=r.planned_start_date and a.planned_start_date<=r.planned_end_date
 where r.project_id=p_project_id
 group by r.id order by r.planned_start_date,r.role_name;
end;
$$;
revoke execute on function public.project_staffing_overview(uuid) from public,anon;
grant execute on function public.project_staffing_overview(uuid) to authenticated;

create function public.project_staffing_candidates(p_requirement_id uuid,p_organization_id uuid default null,
 p_position_id uuid default null,p_skill_id uuid default null,p_min_career_months integer default 0,
 p_min_availability numeric default 0)
returns table(user_id uuid,name text,organization_id uuid,position_id uuid,career_months integer,
 minimum_availability numeric,matched_required integer,total_required integer,skills jsonb)
language plpgsql stable security definer set search_path='' as $$
declare req public.project_staffing_requirements;
begin
 select * into req from public.project_staffing_requirements where id=p_requirement_id;
 if not found or not private.has_permission('WORKFORCE_PROFILE_STAFFING_READ') or not private.can_read_project(req.project_id)
 then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_min_career_months not between 0 and 720 or p_min_availability not between 0 and 100 then
  raise exception 'ValidationError' using errcode='22023'; end if;
 return query
 with cap as (select c.user_id,c.minimum_availability from private.resource_capacity_core(req.planned_start_date,req.planned_end_date,'range') c),
 required as (select rs.skill_id,rs.target_level from public.project_staffing_requirement_skills rs
  where rs.requirement_id=req.id and rs.active and rs.preference='REQUIRED')
 select e.id,e.name,e.organization_id,e.position_id,cv.months,cap.minimum_availability,
  (select count(*)::integer from required rs join public.employee_skills es on es.user_id=e.id
   and es.skill_id=rs.skill_id and es.active where rs.target_level is null or
    (case es.level when 'BASIC' then 1 when 'INTERMEDIATE' then 2 when 'ADVANCED' then 3 when 'EXPERT' then 4 else 0 end)>=
    (case rs.target_level when 'BASIC' then 1 when 'INTERMEDIATE' then 2 when 'ADVANCED' then 3 when 'EXPERT' then 4 else 0 end)),
  (select count(*)::integer from required),
  coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'level',es.level) order by s.name)
   from public.employee_skills es join public.skills s on s.id=es.skill_id and s.active
   where es.user_id=e.id and es.active),'[]'::jsonb)
 from public.employees e join cap on cap.user_id=e.id
 left join public.workforce_profiles wp on wp.user_id=e.id
 cross join lateral (select case when wp.career_months_override is not null then wp.career_months_override
   when wp.career_start_date is not null then greatest(0,(extract(year from age(current_date,wp.career_start_date))*12+
     extract(month from age(current_date,wp.career_start_date)))::integer) else null end as months) cv
 where e.user_status='ACTIVE' and (p_organization_id is null or e.organization_id=p_organization_id)
  and (p_position_id is null or e.position_id=p_position_id)
  and (p_skill_id is null or exists(select 1 from public.employee_skills es where es.user_id=e.id and es.skill_id=p_skill_id and es.active))
  and coalesce(cv.months,0)>=p_min_career_months and cap.minimum_availability>=p_min_availability
 order by matched_required desc,cap.minimum_availability desc,e.name limit 300;
end;
$$;
revoke execute on function public.project_staffing_candidates(uuid,uuid,uuid,uuid,integer,numeric) from public,anon;
grant execute on function public.project_staffing_candidates(uuid,uuid,uuid,uuid,integer,numeric) to authenticated;

create function public.workforce_skill_matrix(p_start date,p_end date,p_organization_id uuid default null,
 p_position_id uuid default null,p_skill_id uuid default null,p_min_career_months integer default 0,
 p_min_availability numeric default 0)
returns table(user_id uuid,name text,organization_id uuid,position_id uuid,career_months integer,
 minimum_availability numeric,skills jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
 if not (private.has_permission('WORKFORCE_PROFILE_READ_TEAM') or private.has_permission('WORKFORCE_PROFILE_READ_ALL')) then
  raise exception 'Forbidden' using errcode='42501'; end if;
 if p_start is null or p_end is null or p_end<p_start or p_end-p_start>185
  or p_min_career_months not between 0 and 720 or p_min_availability not between 0 and 100
 then raise exception 'ValidationError' using errcode='22023'; end if;
 return query
 with cap as (select c.user_id,c.minimum_availability from private.resource_capacity_core(p_start,p_end,'range') c)
 select e.id,e.name,e.organization_id,e.position_id,cv.months,cap.minimum_availability,
  coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'level',es.level) order by s.name)
   from public.employee_skills es join public.skills s on s.id=es.skill_id and s.active
   where es.user_id=e.id and es.active),'[]'::jsonb)
 from public.employees e join cap on cap.user_id=e.id
 left join public.workforce_profiles wp on wp.user_id=e.id
 cross join lateral (select case when wp.career_months_override is not null then wp.career_months_override
   when wp.career_start_date is not null then greatest(0,(extract(year from age(current_date,wp.career_start_date))*12+
     extract(month from age(current_date,wp.career_start_date)))::integer) else null end as months) cv
 where e.user_status='ACTIVE'
  and (private.has_permission('WORKFORCE_PROFILE_READ_ALL') or
   (private.has_permission('WORKFORCE_PROFILE_READ_TEAM') and private.manages_organization(e.organization_id)))
  and (p_organization_id is null or e.organization_id=p_organization_id)
  and (p_position_id is null or e.position_id=p_position_id)
  and (p_skill_id is null or exists(select 1 from public.employee_skills es where es.user_id=e.id and es.skill_id=p_skill_id and es.active))
  and coalesce(cv.months,0)>=p_min_career_months and cap.minimum_availability>=p_min_availability
 order by e.name limit 300;
end;
$$;
revoke execute on function public.workforce_skill_matrix(date,date,uuid,uuid,uuid,integer,numeric) from public,anon;
grant execute on function public.workforce_skill_matrix(date,date,uuid,uuid,uuid,integer,numeric) to authenticated;

commit;
