begin;

create function public.system_health()
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.role()<>'service_role' then
    raise exception 'service role required' using errcode='42501';
  end if;

  return to_regclass('public.employees') is not null;
end;
$$;

grant execute on function public.system_health() to service_role;
revoke execute on function public.system_health() from public,anon,authenticated;

commit;
