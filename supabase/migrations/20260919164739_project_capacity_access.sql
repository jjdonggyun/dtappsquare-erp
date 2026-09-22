begin;
create or replace function public.resource_capacity(p_start date,p_end date,p_granularity text default 'month')
returns table(user_id uuid,bucket_start date,average_allocation numeric,peak_allocation numeric,minimum_availability numeric)
language plpgsql stable security definer set search_path='' as $$
begin
  if not (private.has_permission('RESOURCE_READ') or private.has_permission('PROJECT_RESOURCE_MANAGE')) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if p_start is null or p_end is null or p_end<p_start or p_end-p_start>185 or p_granularity not in ('week','month','range') then
    raise exception 'ValidationError' using errcode='22023';
  end if;
  return query
  with daily as (
    select e.id as employee_id,d.day::date as work_day,coalesce(sum(a.allocation_rate),0) as rate
    from public.employees e cross join generate_series(p_start,p_end,'1 day'::interval) d(day)
    left join public.project_assignments a on a.user_id=e.id
      and a.status in ('PLANNED','CONFIRMED','IN_PROGRESS')
      and d.day::date between a.planned_start_date and a.planned_end_date
    where e.user_status='ACTIVE' group by e.id,d.day
  )
  select employee_id,
    case when p_granularity='range' then p_start else date_trunc(p_granularity,work_day)::date end,
    round(avg(rate),1),max(rate),greatest(0,100-max(rate)) from daily
  group by employee_id,case when p_granularity='range' then p_start else date_trunc(p_granularity,work_day)::date end;
end;
$$;
commit;
