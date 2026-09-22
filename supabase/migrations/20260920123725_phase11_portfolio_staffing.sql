begin;
create function public.project_portfolio_staffing()
returns table(project_id uuid,required_headcount integer,filled_count integer,open_requirements integer,open_issues integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_permission('PROJECT_STAFFING_READ') then raise exception 'Forbidden' using errcode='42501'; end if;
 return query
 select p.id,coalesce(sum(case when r.lifecycle_status='OPEN' then r.required_headcount else 0 end),0)::integer,
  coalesce(sum(case when r.lifecycle_status='OPEN' then coalesce(f.filled,0) else 0 end),0)::integer,
  count(r.id) filter(where r.lifecycle_status='OPEN')::integer,
  (select count(*)::integer from public.project_issues i where i.project_id=p.id and i.status in ('OPEN','IN_PROGRESS'))
 from public.projects p
 left join public.project_staffing_requirements r on r.project_id=p.id
 left join lateral (select count(distinct a.user_id)::integer as filled
  from public.project_staffing_fulfillments sf join public.project_assignments a on a.id=sf.project_assignment_id
  where sf.requirement_id=r.id and sf.active and a.project_id=p.id
   and a.status in ('PLANNED','CONFIRMED','IN_PROGRESS')
   and a.planned_end_date>=r.planned_start_date and a.planned_start_date<=r.planned_end_date) f on true
 where private.can_read_project(p.id)
 group by p.id order by p.id;
end;
$$;
revoke execute on function public.project_portfolio_staffing() from public,anon;
grant execute on function public.project_portfolio_staffing() to authenticated;
commit;
