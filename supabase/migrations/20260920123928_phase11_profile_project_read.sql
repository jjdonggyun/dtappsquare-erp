begin;
-- A scoped profile reader needs the employee's own assignment facts even when
-- their role cannot browse the underlying project portfolio.
create function public.workforce_profile_projects(p_user_id uuid)
returns table(id uuid,project_id uuid,user_id uuid,project_name text,customer_name text,
 project_role text,planned_start_date date,planned_end_date date,allocation_rate numeric,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_read_workforce_profile(p_user_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 return query select a.id,a.project_id,a.user_id,p.project_name,p.customer_name,a.project_role,
  a.planned_start_date,a.planned_end_date,a.allocation_rate,a.status
 from public.project_assignments a join public.projects p on p.id=a.project_id
 where a.user_id=p_user_id order by a.planned_start_date desc limit 500;
end;
$$;
revoke execute on function public.workforce_profile_projects(uuid) from public,anon;
grant execute on function public.workforce_profile_projects(uuid) to authenticated;
commit;
