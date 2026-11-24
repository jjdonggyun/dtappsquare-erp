create function public.record_operational_alert_failure(p_run_date date,p_error_code text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare run_id uuid;
begin
  if auth.role()<>'service_role' then
    raise exception 'service role required' using errcode='42501';
  end if;
  insert into public.operational_alert_runs(
    run_date,status,error_code,started_at,completed_at,updated_at
  ) values(
    p_run_date,'FAILED',left(coalesce(nullif(p_error_code,''),'INTERNAL_ERROR'),80),now(),now(),now()
  )
  on conflict(run_date) do update set
    status='FAILED',error_code=left(coalesce(nullif(p_error_code,''),'INTERNAL_ERROR'),80),
    completed_at=now(),updated_at=now()
  returning id into run_id;
  return jsonb_build_object('runId',run_id,'runDate',p_run_date,'status','FAILED');
end;
$$;

grant execute on function public.record_operational_alert_failure(date,text) to service_role;
revoke execute on function public.record_operational_alert_failure(date,text)
  from public,anon,authenticated;
