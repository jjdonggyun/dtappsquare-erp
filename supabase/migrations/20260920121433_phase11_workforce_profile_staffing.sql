begin;

insert into public.permissions(code,description) values
 ('WORKFORCE_PROFILE_READ_SELF','본인 인력프로필 조회'),
 ('WORKFORCE_PROFILE_WRITE_SELF','본인 전문 경력 수정'),
 ('WORKFORCE_PROFILE_READ_TEAM','관리 조직 인력프로필 조회'),
 ('WORKFORCE_PROFILE_READ_ALL','전사 인력프로필 조회'),
 ('WORKFORCE_PROFILE_MANAGE','전사 인력프로필 및 기술 카탈로그 관리'),
 ('WORKFORCE_PROFILE_EXPORT_SELF','본인 인력프로필 Excel 생성'),
 ('WORKFORCE_PROFILE_EXPORT_TEAM','관리 조직 인력프로필 Excel 생성'),
 ('WORKFORCE_PROFILE_EXPORT_ALL','전사 인력프로필 Excel 생성'),
 ('WORKFORCE_PROFILE_STAFFING_READ','프로젝트 인력 탐색 최소정보 조회'),
 ('PROJECT_STAFFING_READ','프로젝트 인력 요구사항 조회'),
 ('PROJECT_STAFFING_MANAGE','담당 프로젝트 인력 요구사항 관리')
on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (r.code='ADMIN' and p.code like 'WORKFORCE_PROFILE_%')
   or (r.code='ADMIN' and p.code in ('PROJECT_STAFFING_READ','PROJECT_STAFFING_MANAGE'))
   or (r.code='EMPLOYEE' and p.code in ('WORKFORCE_PROFILE_READ_SELF','WORKFORCE_PROFILE_WRITE_SELF','WORKFORCE_PROFILE_EXPORT_SELF'))
   or (r.code='TEAM_MANAGER' and p.code in ('WORKFORCE_PROFILE_READ_TEAM','WORKFORCE_PROFILE_EXPORT_TEAM'))
   or (r.code='HR_MANAGER' and p.code in ('WORKFORCE_PROFILE_READ_ALL','WORKFORCE_PROFILE_MANAGE','WORKFORCE_PROFILE_EXPORT_ALL','PROJECT_STAFFING_READ'))
   or (r.code='PROJECT_MANAGER' and p.code in ('WORKFORCE_PROFILE_STAFFING_READ','PROJECT_STAFFING_READ','PROJECT_STAFFING_MANAGE'))
on conflict do nothing;

create table public.workforce_profiles(
 user_id uuid primary key references public.employees(id) on delete restrict,
 birth_date date,
 career_start_date date,
 career_months_override integer check(career_months_override between 0 and 720),
 career_override_reason text check(career_override_reason is null or length(career_override_reason)<=500),
 summary text not null default '' check(length(summary)<=4000),
 profile_status text not null default 'DRAFT' check(profile_status in ('DRAFT','READY')),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(career_months_override is null or length(trim(coalesce(career_override_reason,'')))>=2)
);
create table public.workforce_educations(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.employees(id) on delete restrict,
 school_name text not null check(length(trim(school_name)) between 1 and 200),
 degree text not null default '' check(length(degree)<=100),major text not null default '' check(length(major)<=150),
 start_date date,end_date date,graduation_status text not null default 'GRADUATED'
   check(graduation_status in ('ENROLLED','GRADUATED','COMPLETED','WITHDRAWN')),
 highest_education boolean not null default false,sort_order integer not null default 0,
 active boolean not null default true,version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(end_date is null or start_date is null or end_date>=start_date)
);
create unique index workforce_educations_one_highest on public.workforce_educations(user_id) where highest_education and active;
create index workforce_educations_user_order on public.workforce_educations(user_id,sort_order);
create table public.skills(
 id uuid primary key default gen_random_uuid(),code text not null unique check(code ~ '^[A-Z][A-Z0-9_]{1,60}$'),
 name text not null check(length(trim(name)) between 1 and 120),category text not null default 'ETC' check(length(trim(category)) between 1 and 80),
 active boolean not null default true,version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index skills_name_unique on public.skills(lower(name));
create index skills_category_active on public.skills(category,name) where active;
create table public.employee_skills(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.employees(id) on delete restrict,
 skill_id uuid not null references public.skills(id) on delete restrict,
 level text check(level is null or level in ('BASIC','INTERMEDIATE','ADVANCED','EXPERT')),
 years_experience numeric(4,1) check(years_experience between 0 and 60),last_used_date date,
 memo text not null default '' check(length(memo)<=1000),active boolean not null default true,
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(user_id,skill_id)
);
create index employee_skills_skill_active on public.employee_skills(skill_id,user_id) where active;
create index employee_skills_user_active on public.employee_skills(user_id) where active;
create table public.workforce_certifications(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.employees(id) on delete restrict,
 certification_name text not null check(length(trim(certification_name)) between 1 and 180),
 issuer text not null default '' check(length(issuer)<=150),obtained_date date,expiry_date date,
 credential_id text check(credential_id is null or length(credential_id)<=150),
 active boolean not null default true,version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(expiry_date is null or obtained_date is null or expiry_date>=obtained_date)
);
create index workforce_certifications_user on public.workforce_certifications(user_id,obtained_date desc) where active;

-- The assignment owns internal project identity, customer, dates and role.
-- This row stores only the employee's confirmed narrative and technologies.
create unique index project_assignments_id_user on public.project_assignments(id,user_id);
create table public.workforce_project_experiences(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.employees(id) on delete restrict,
 source_type text not null check(source_type in ('INTERNAL_PROJECT','MANUAL_HISTORY')),
 project_assignment_id uuid,
 project_name text,customer_name text,category text,start_date date,end_date date,role text,
 responsibilities text not null check(length(trim(responsibilities)) between 2 and 6000),
 technologies text not null default '' check(length(technologies)<=2000),sort_order integer not null default 0,
 active boolean not null default true,version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(project_assignment_id,user_id) references public.project_assignments(id,user_id) on update restrict on delete restrict,
 check(end_date is null or start_date is null or end_date>=start_date),
 check((source_type='INTERNAL_PROJECT' and project_assignment_id is not null and project_name is null and customer_name is null
    and category is null and start_date is null and end_date is null and role is null)
    or (source_type='MANUAL_HISTORY' and project_assignment_id is null and length(trim(coalesce(project_name,'')))>=2 and start_date is not null and length(trim(coalesce(role,'')))>=1))
);
create unique index workforce_experience_assignment_unique on public.workforce_project_experiences(project_assignment_id) where project_assignment_id is not null;
create index workforce_experience_user_manual_date on public.workforce_project_experiences(user_id,start_date desc) where active;

create table public.project_staffing_requirements(
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id) on delete restrict,
 role_name text not null check(length(trim(role_name)) between 2 and 120),
 required_headcount integer not null check(required_headcount between 1 and 100),
 planned_start_date date not null,planned_end_date date not null,
 allocation_rate numeric(5,2) not null check(allocation_rate between 0 and 100),
 description text not null default '' check(length(description)<=4000),
 lifecycle_status text not null default 'OPEN' check(lifecycle_status in ('OPEN','CLOSED')),
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(planned_end_date>=planned_start_date)
);
create index staffing_requirements_project_period on public.project_staffing_requirements(project_id,planned_start_date,planned_end_date);
create table public.project_staffing_requirement_skills(
 id uuid primary key default gen_random_uuid(),requirement_id uuid not null references public.project_staffing_requirements(id) on delete restrict,
 skill_id uuid not null references public.skills(id) on delete restrict,
 preference text not null check(preference in ('REQUIRED','PREFERRED')),
 target_level text check(target_level is null or target_level in ('BASIC','INTERMEDIATE','ADVANCED','EXPERT')),
 active boolean not null default true,version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(requirement_id,skill_id)
);
create index staffing_requirement_skills_skill on public.project_staffing_requirement_skills(skill_id,requirement_id) where active;
create table public.project_staffing_fulfillments(
 id uuid primary key default gen_random_uuid(),requirement_id uuid not null references public.project_staffing_requirements(id) on delete restrict,
 project_assignment_id uuid not null references public.project_assignments(id) on delete restrict,
 active boolean not null default true,version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(requirement_id,project_assignment_id)
);
create unique index staffing_fulfillment_one_active_requirement on public.project_staffing_fulfillments(project_assignment_id) where active;
create index staffing_fulfillment_requirement on public.project_staffing_fulfillments(requirement_id) where active;

create function private.can_read_workforce_profile(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_active() and (
  (p_user_id=auth.uid() and private.has_permission('WORKFORCE_PROFILE_READ_SELF'))
  or private.has_permission('WORKFORCE_PROFILE_READ_ALL')
  or (private.has_permission('WORKFORCE_PROFILE_READ_TEAM') and exists(
   select 1 from public.employees e where e.id=p_user_id and private.manages_organization(e.organization_id)))
 );
$$;
create function private.can_write_workforce_profile(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_active() and (
  private.has_permission('WORKFORCE_PROFILE_MANAGE')
  or (p_user_id=auth.uid() and private.has_permission('WORKFORCE_PROFILE_WRITE_SELF'))
 );
$$;
create function private.can_export_workforce_profile(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.can_read_workforce_profile(p_user_id) and (
  private.has_permission('WORKFORCE_PROFILE_EXPORT_ALL')
  or (p_user_id=auth.uid() and private.has_permission('WORKFORCE_PROFILE_EXPORT_SELF'))
  or (private.has_permission('WORKFORCE_PROFILE_EXPORT_TEAM') and exists(
    select 1 from public.employees e where e.id=p_user_id and private.manages_organization(e.organization_id)))
 );
$$;
create function private.can_manage_staffing(p_project_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_permission('PROJECT_STAFFING_MANAGE') and exists(
  select 1 from public.projects p where p.id=p_project_id and
   (private.has_permission('PROJECT_READ_ALL') or p.project_manager_id=auth.uid()));
$$;
revoke execute on function private.can_read_workforce_profile(uuid),private.can_write_workforce_profile(uuid),
 private.can_export_workforce_profile(uuid),private.can_manage_staffing(uuid) from public,anon;
grant execute on function private.can_read_workforce_profile(uuid),private.can_write_workforce_profile(uuid),
 private.can_export_workforce_profile(uuid),private.can_manage_staffing(uuid) to authenticated;

do $$ declare t text; begin
 foreach t in array array['workforce_profiles','workforce_educations','skills','employee_skills','workforce_certifications',
   'workforce_project_experiences','project_staffing_requirements','project_staffing_requirement_skills','project_staffing_fulfillments'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create trigger touch_row before update on public.%I for each row execute function private.touch_versioned_row()',t);
  execute format('create trigger audit_change after insert or update on public.%I for each row execute function private.capture_audit()',t);
 end loop;
end $$;
create policy workforce_profiles_read on public.workforce_profiles for select to authenticated
 using(private.can_read_workforce_profile(user_id));
create policy workforce_educations_read on public.workforce_educations for select to authenticated
 using(private.can_read_workforce_profile(user_id));
create policy skills_read on public.skills for select to authenticated using(private.is_active());
create policy employee_skills_read on public.employee_skills for select to authenticated
 using(private.can_read_workforce_profile(user_id));
create policy workforce_certifications_read on public.workforce_certifications for select to authenticated
 using(private.can_read_workforce_profile(user_id));
create policy workforce_project_experiences_read on public.workforce_project_experiences for select to authenticated
 using(private.can_read_workforce_profile(user_id));
create policy staffing_requirements_read on public.project_staffing_requirements for select to authenticated
 using(private.has_permission('PROJECT_STAFFING_READ') and private.can_read_project(project_id));
create policy staffing_requirement_skills_read on public.project_staffing_requirement_skills for select to authenticated
 using(exists(select 1 from public.project_staffing_requirements r where r.id=requirement_id));
create policy staffing_fulfillments_read on public.project_staffing_fulfillments for select to authenticated
 using(exists(select 1 from public.project_staffing_requirements r where r.id=requirement_id));

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
 if TG_TABLE_NAME='workforce_profiles' then b=b-'birth_date'; a=a-'birth_date'; end if;
 if TG_TABLE_NAME='workforce_certifications' then b=b-'credential_id'; a=a-'credential_id'; end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id)
 values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(a->>'id',b->>'id',a->>'user_id',b->>'user_id',a->>'role_id',b->>'role_id',a->>'key',b->>'key'),b,a,nullif(current_setting('app.request_id',true),''));
 return coalesce(new,old);
end;
$$;

commit;
