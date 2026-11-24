begin;

create table public.operational_alert_runs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null unique,
  status text not null check (status in ('RUNNING','COMPLETED','FAILED')),
  schedule_due_count integer not null default 0 check (schedule_due_count >= 0),
  overdue_billing_count integer not null default 0 check (overdue_billing_count >= 0),
  notification_count integer not null default 0 check (notification_count >= 0),
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index operational_alert_runs_started_at
  on public.operational_alert_runs(started_at desc);

alter table public.operational_alert_runs enable row level security;

create policy operational_alert_runs_read on public.operational_alert_runs
for select to authenticated using (
  (select private.is_active()) and (
    (select private.has_permission('BILLING_READ_ALL')) or
    (select private.has_permission('PAYMENT_READ_ALL')) or
    (select private.has_permission('PROJECT_FINANCE_READ_ALL')) or
    (select private.has_permission('RBAC_MANAGE'))
  )
);

grant select on public.operational_alert_runs to authenticated;
revoke insert,update,delete,truncate,references,trigger on public.operational_alert_runs
  from public,anon,authenticated;

create function private.run_operational_alerts(p_run_date date)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  run_id uuid;
  schedule_row record;
  billing_row record;
  recipient record;
  schedule_count integer := 0;
  overdue_count integer := 0;
  created_notification_count integer := 0;
begin
  insert into public.operational_alert_runs(run_date,status,started_at,completed_at,error_code)
  values(p_run_date,'RUNNING',now(),null,null)
  on conflict(run_date) do update set
    status='RUNNING',started_at=now(),completed_at=null,error_code=null,
    schedule_due_count=0,overdue_billing_count=0,notification_count=0,
    updated_at=now()
  returning id into run_id;

  for schedule_row in
    select s.id,s.title,s.scheduled_date,p.project_code,p.project_name
    from public.billing_schedules s
    join public.projects p on p.id=s.project_id
    where s.status in ('SCHEDULED','READY')
      and s.scheduled_date between p_run_date and p_run_date + 7
    order by s.scheduled_date,s.sequence_no
  loop
    schedule_count := schedule_count + 1;
    for recipient in
      select e.id
      from public.employees e
      where e.user_status='ACTIVE'
        and private.user_has_permission(e.id,'BILLING_MANAGE')
    loop
      perform private.enqueue_notification(
        recipient.id,
        'BILLING_SCHEDULE_DUE',
        '청구 일정 확인',
        schedule_row.project_code||' '||schedule_row.project_name||'의 '||schedule_row.title||' 일정이 '||
          to_char(schedule_row.scheduled_date,'YYYY-MM-DD')||'에 도래합니다. 청구 조건과 발행 준비를 확인해 주세요.',
        'BILLING_SCHEDULE',schedule_row.id,
        'billing-schedule-due:'||schedule_row.id||':'||schedule_row.scheduled_date||':'||recipient.id,
        'billing-schedule-due'
      );
      created_notification_count := created_notification_count + 1;
    end loop;
  end loop;

  for billing_row in
    select b.id,b.billing_number,b.title,b.due_date,b.total_amount,
      greatest(0,b.total_amount-coalesce((
        select sum(a.amount)
        from public.payment_allocations a
        join public.payments pay on pay.id=a.payment_id and pay.status='CONFIRMED'
        where a.billing_id=b.id
      ),0)) as outstanding_amount,
      c.name as customer_name
    from public.billings b
    join public.customers c on c.id=b.customer_id
    where b.status in ('BILLED','PARTIALLY_PAID')
      and b.due_date < p_run_date
      and greatest(0,b.total_amount-coalesce((
        select sum(a.amount)
        from public.payment_allocations a
        join public.payments pay on pay.id=a.payment_id and pay.status='CONFIRMED'
        where a.billing_id=b.id
      ),0)) > 0
    order by b.due_date,b.billing_number
  loop
    overdue_count := overdue_count + 1;
    for recipient in
      select distinct e.id
      from public.employees e
      where e.user_status='ACTIVE'
        and (
          private.user_has_permission(e.id,'BILLING_MANAGE') or
          private.user_has_permission(e.id,'PAYMENT_MANAGE')
        )
    loop
      perform private.enqueue_notification(
        recipient.id,
        'BILLING_OVERDUE',
        '미수금 회수 확인',
        billing_row.customer_name||' '||billing_row.billing_number||'의 입금기한('||
          to_char(billing_row.due_date,'YYYY-MM-DD')||')이 지났습니다. 미수잔액 '||
          to_char(billing_row.outstanding_amount,'FM999,999,999,999,990')||'원을 확인해 주세요.',
        'BILLING',billing_row.id,
        'billing-overdue:'||billing_row.id||':'||billing_row.due_date||':'||recipient.id,
        'billing-overdue'
      );
      created_notification_count := created_notification_count + 1;
    end loop;
  end loop;

  update public.operational_alert_runs set
    status='COMPLETED',schedule_due_count=schedule_count,
    overdue_billing_count=overdue_count,notification_count=created_notification_count,
    completed_at=now(),updated_at=now()
  where id=run_id;

  return jsonb_build_object(
    'runId',run_id,'runDate',p_run_date,'status','COMPLETED',
    'scheduleDueCount',schedule_count,'overdueBillingCount',overdue_count,
    'notificationCount',created_notification_count
  );
exception when others then
  if run_id is not null then
    update public.operational_alert_runs set
      status='FAILED',error_code=sqlstate,completed_at=now(),updated_at=now()
    where id=run_id;
  end if;
  raise;
end;
$$;

create function public.run_operational_alerts(p_run_date date default current_date)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.role()<>'service_role' then
    raise exception 'service role required' using errcode='42501';
  end if;
  return private.run_operational_alerts(p_run_date);
end;
$$;

create function public.operational_alert_status()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare output jsonb;
begin
  if not (
    private.has_permission('BILLING_READ_ALL') or
    private.has_permission('PAYMENT_READ_ALL') or
    private.has_permission('PROJECT_FINANCE_READ_ALL') or
    private.has_permission('RBAC_MANAGE')
  ) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.started_at desc),'[]'::jsonb)
  into output
  from (
    select id,run_date,status,schedule_due_count,overdue_billing_count,
      notification_count,error_code,started_at,completed_at
    from public.operational_alert_runs
    order by started_at desc
    limit 30
  ) r;
  return output;
end;
$$;

grant execute on function public.run_operational_alerts(date) to service_role;
grant execute on function public.operational_alert_status() to authenticated;
revoke execute on function public.run_operational_alerts(date)
  from public,anon,authenticated;
revoke execute on function public.operational_alert_status() from public,anon;
revoke execute on function private.run_operational_alerts(date)
  from public,anon,authenticated;

commit;
