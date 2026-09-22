begin;

drop function public.project_staffing_candidates(uuid,uuid,uuid,uuid,integer,numeric);

create function public.project_staffing_candidates(p_requirement_id uuid,p_organization_id uuid default null,
 p_position_id uuid default null,p_skill_id uuid default null,p_min_career_months integer default 0,
 p_min_availability numeric default 0)
returns table(user_id uuid,name text,organization_id uuid,position_id uuid,career_months integer,
 minimum_availability numeric,matched_required integer,total_required integer,can_read_profile boolean,skills jsonb)
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
  private.can_read_workforce_profile(e.id),
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

commit;
