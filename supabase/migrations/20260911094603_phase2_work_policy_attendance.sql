begin;

create extension if not exists btree_gist with schema extensions;

create table public.work_policies (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Z][A-Z0-9_]{1,60}$'),
  version integer not null check (version > 0),
  name text not null check (length(name) between 1 and 100),
  check_in_time time not null,
  check_out_time time not null,
  break_start time,
  break_end time,
  late_grace_minutes integer not null default 0 check (late_grace_minutes between 0 and 180),
  timezone text not null default 'Asia/Seoul',
  working_days smallint[] not null default array[1,2,3,4,5]::smallint[],
  active boolean not null default true,
  created_by uuid references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (code, version),
  check ((break_start is null) = (break_end is null)),
  check (cardinality(working_days) between 1 and 7),
  check (working_days <@ array[1,2,3,4,5,6,7]::smallint[]),
  check ((active and archived_at is null) or (not active and archived_at is not null))
);

create index work_policies_code_version on public.work_policies(code, version desc);
create index work_policies_created_by on public.work_policies(created_by);

create table public.user_work_policy_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.employees(id) on delete restrict,
  work_policy_id uuid not null references public.work_policies(id) on delete restrict,
  effective_from date not null,
  effective_to date,
  assigned_by uuid not null references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from),
  exclude using gist (
    user_id with =,
    (daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)')) with &&
  )
);

create index work_policy_assignments_user_period
  on public.user_work_policy_assignments(user_id, effective_from desc, effective_to);
create index work_policy_assignments_policy on public.user_work_policy_assignments(work_policy_id);
create index work_policy_assignments_assigned_by on public.user_work_policy_assignments(assigned_by);

create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.employees(id) on delete restrict,
  work_policy_id uuid not null references public.work_policies(id) on delete restrict,
  work_date date not null,
  event_type text not null check (event_type in ('CHECK_IN','CHECK_OUT')),
  occurred_at timestamptz not null default now(),
  device_id uuid,
  ip_address inet,
  verification_type text not null check (verification_type in ('WEB','DEVICE_AGENT','ADMIN')),
  verification_status text not null check (verification_status in ('PENDING','VERIFIED','REJECTED')),
  idempotency_key text not null check (length(idempotency_key) between 16 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (user_id, work_date, event_type)
);

create index attendance_events_user_time on public.attendance_events(user_id, occurred_at desc);
create index attendance_events_work_date_status on public.attendance_events(work_date, event_type);
create index attendance_events_policy on public.attendance_events(work_policy_id);
create index attendance_events_device on public.attendance_events(device_id) where device_id is not null;

create table public.attendance_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.employees(id) on delete restrict,
  work_date date not null,
  work_policy_id uuid not null references public.work_policies(id) on delete restrict,
  policy_snapshot jsonb not null,
  shift_start_at timestamptz not null,
  shift_end_at timestamptz not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  worked_minutes integer not null default 0 check (worked_minutes >= 0),
  attendance_status text not null check (attendance_status in ('NORMAL','LATE','ABSENT','EARLY_LEAVE','VACATION','HALF_DAY','REMOTE','BUSINESS_TRIP')),
  status_flags text[] not null default '{}'::text[],
  calculation_version integer not null default 1,
  version integer not null default 1,
  last_calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date),
  check (check_out_at is null or (check_in_at is not null and check_out_at >= check_in_at))
);

create index attendance_summaries_date_status on public.attendance_daily_summaries(work_date, attendance_status);
create index attendance_summaries_user_month on public.attendance_daily_summaries(user_id, work_date desc);
create index attendance_summaries_policy on public.attendance_daily_summaries(work_policy_id);

create table public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  attendance_summary_id uuid not null references public.attendance_daily_summaries(id) on delete restrict,
  corrected_check_in_at timestamptz,
  corrected_check_out_at timestamptz,
  reason text not null check (length(trim(reason)) between 2 and 500),
  corrected_by uuid not null references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (corrected_check_out_at is null or (corrected_check_in_at is not null and corrected_check_out_at >= corrected_check_in_at))
);

create index attendance_corrections_summary_time on public.attendance_corrections(attendance_summary_id, created_at desc);
create index attendance_corrections_actor on public.attendance_corrections(corrected_by);

create function private.prevent_used_policy_schedule_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.user_work_policy_assignments a where a.work_policy_id = old.id
  ) and row(
    new.code, new.version, new.check_in_time, new.check_out_time, new.break_start,
    new.break_end, new.late_grace_minutes, new.timezone, new.working_days
  ) is distinct from row(
    old.code, old.version, old.check_in_time, old.check_out_time, old.break_start,
    old.break_end, old.late_grace_minutes, old.timezone, old.working_days
  ) then
    raise exception 'assigned policy schedules are immutable' using errcode = '40001';
  end if;
  return new;
end;
$$;

create trigger work_policy_schedule_immutable
before update on public.work_policies for each row
execute function private.prevent_used_policy_schedule_change();

create trigger touch_work_policy before update on public.work_policies
for each row execute function private.touch_row();

create trigger touch_attendance_summary before update on public.attendance_daily_summaries
for each row execute function private.touch_row();

create trigger audit_work_policies after insert or update on public.work_policies
for each row execute function private.capture_audit();
create trigger audit_work_policy_assignments after insert or update on public.user_work_policy_assignments
for each row execute function private.capture_audit();
create trigger audit_attendance_corrections after insert on public.attendance_corrections
for each row execute function private.capture_audit();

create function private.request_ip()
returns inet language plpgsql stable set search_path = '' as $$
declare
  header_value text;
begin
  header_value := split_part(
    coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''),
    ',', 1
  );
  if trim(header_value) = '' then return null; end if;
  return trim(header_value)::inet;
exception when others then
  return null;
end;
$$;

create function private.resolve_work_policy(p_user_id uuid, p_moment timestamptz)
returns public.work_policies
language plpgsql stable security definer set search_path = '' as $$
declare
  result public.work_policies;
begin
  select p.* into result
  from public.user_work_policy_assignments a
  join public.work_policies p on p.id = a.work_policy_id
  where a.user_id = p_user_id
    and (p_moment at time zone p.timezone)::date >= a.effective_from
    and (a.effective_to is null or (p_moment at time zone p.timezone)::date < a.effective_to)
  order by a.effective_from desc
  limit 1;
  if not found then
    raise exception 'work policy not assigned' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

create function private.policy_for_work_date(p_user_id uuid, p_work_date date)
returns public.work_policies
language plpgsql stable security definer set search_path = '' as $$
declare
  result public.work_policies;
begin
  select p.* into result
  from public.user_work_policy_assignments a
  join public.work_policies p on p.id = a.work_policy_id
  where a.user_id = p_user_id
    and p_work_date >= a.effective_from
    and (a.effective_to is null or p_work_date < a.effective_to)
  order by a.effective_from desc
  limit 1;
  if not found then
    raise exception 'work policy not assigned' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

create function private.calculate_attendance_summary(p_user_id uuid, p_work_date date)
returns public.attendance_daily_summaries
language plpgsql security definer set search_path = '' as $$
declare
  policy public.work_policies;
  summary public.attendance_daily_summaries;
  first_in timestamptz;
  last_out timestamptz;
  correction public.attendance_corrections;
  shift_start timestamptz;
  shift_end timestamptz;
  break_start_at timestamptz;
  break_end_at timestamptz;
  total_minutes integer := 0;
  break_minutes integer := 0;
  flags text[] := '{}'::text[];
  status text := 'NORMAL';
begin
  policy := private.policy_for_work_date(p_user_id, p_work_date);
  shift_start := (p_work_date + policy.check_in_time) at time zone policy.timezone;
  shift_end := (
    p_work_date + case when policy.check_out_time <= policy.check_in_time then 1 else 0 end
    + policy.check_out_time
  ) at time zone policy.timezone;

  select min(occurred_at) filter (where event_type = 'CHECK_IN'),
         max(occurred_at) filter (where event_type = 'CHECK_OUT')
    into first_in, last_out
  from public.attendance_events
  where user_id = p_user_id and work_date = p_work_date and verification_status = 'VERIFIED';

  select c.* into correction
  from public.attendance_corrections c
  join public.attendance_daily_summaries s on s.id = c.attendance_summary_id
  where s.user_id = p_user_id and s.work_date = p_work_date
  order by c.created_at desc, c.id desc limit 1;
  if found then
    first_in := correction.corrected_check_in_at;
    last_out := correction.corrected_check_out_at;
  end if;

  if first_in is null then
    status := 'ABSENT';
    flags := array['ABSENT'];
  else
    if first_in >= shift_start + make_interval(mins => policy.late_grace_minutes + 1) then
      flags := array_append(flags, 'LATE');
    end if;
    if last_out is not null and last_out < shift_end then
      flags := array_append(flags, 'EARLY_LEAVE');
    end if;
    if 'LATE' = any(flags) then status := 'LATE';
    elsif 'EARLY_LEAVE' = any(flags) then status := 'EARLY_LEAVE';
    end if;
  end if;

  if first_in is not null and last_out is not null then
    total_minutes := greatest(0, floor(extract(epoch from (last_out - first_in)) / 60)::integer);
    if policy.break_start is not null then
      break_start_at := (p_work_date + policy.break_start) at time zone policy.timezone;
      break_end_at := (
        p_work_date + case when policy.break_end <= policy.break_start then 1 else 0 end
        + policy.break_end
      ) at time zone policy.timezone;
      if least(last_out, break_end_at) > greatest(first_in, break_start_at) then
        break_minutes := floor(extract(epoch from (
          least(last_out, break_end_at) - greatest(first_in, break_start_at)
        )) / 60)::integer;
      end if;
    end if;
  end if;

  insert into public.attendance_daily_summaries(
    user_id, work_date, work_policy_id, policy_snapshot, shift_start_at, shift_end_at,
    check_in_at, check_out_at, worked_minutes, attendance_status, status_flags
  ) values (
    p_user_id, p_work_date, policy.id,
    jsonb_build_object(
      'code', policy.code, 'version', policy.version, 'name', policy.name,
      'check_in_time', policy.check_in_time, 'check_out_time', policy.check_out_time,
      'break_start', policy.break_start, 'break_end', policy.break_end,
      'late_grace_minutes', policy.late_grace_minutes, 'timezone', policy.timezone
    ),
    shift_start, shift_end, first_in, last_out, greatest(0, total_minutes - break_minutes),
    status, flags
  )
  on conflict (user_id, work_date) do update set
    work_policy_id = excluded.work_policy_id,
    policy_snapshot = excluded.policy_snapshot,
    shift_start_at = excluded.shift_start_at,
    shift_end_at = excluded.shift_end_at,
    check_in_at = excluded.check_in_at,
    check_out_at = excluded.check_out_at,
    worked_minutes = excluded.worked_minutes,
    attendance_status = excluded.attendance_status,
    status_flags = excluded.status_flags,
    calculation_version = public.attendance_daily_summaries.calculation_version + 1,
    version = public.attendance_daily_summaries.version + 1,
    last_calculated_at = now()
  returning * into summary;
  return summary;
end;
$$;

create function private.attendance_command(p_action text, p_payload jsonb, p_request_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  policy public.work_policies;
  event_row public.attendance_events;
  summary public.attendance_daily_summaries;
  moment timestamptz := clock_timestamp();
  work_day date;
  event_kind text;
begin
  perform private.require_permission('ATTENDANCE_READ_SELF');
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid attendance payload' using errcode = '22023';
  end if;
  if p_action not in ('attendance.check_in', 'attendance.check_out') then
    raise exception 'unsupported attendance action' using errcode = '22023';
  end if;
  if p_request_id is null or length(p_request_id) not between 16 and 100 then
    raise exception 'invalid idempotency key' using errcode = '22023';
  end if;
  perform set_config('app.request_id', p_request_id, true);
  policy := private.resolve_work_policy(auth.uid(), moment);
  work_day := (moment at time zone policy.timezone)::date;
  event_kind := case when p_action = 'attendance.check_in' then 'CHECK_IN' else 'CHECK_OUT' end;

  if event_kind = 'CHECK_OUT' and not exists (
    select 1 from public.attendance_events
    where user_id = auth.uid() and work_date = work_day and event_type = 'CHECK_IN'
  ) then
    raise exception 'check-in is required' using errcode = '40001';
  end if;

  insert into public.attendance_events(
    user_id, work_policy_id, work_date, event_type, occurred_at, ip_address,
    verification_type, verification_status, idempotency_key
  ) values (
    auth.uid(), policy.id, work_day, event_kind, moment, private.request_ip(),
    'WEB', 'VERIFIED', p_request_id
  )
  on conflict (user_id, idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning * into event_row;

  summary := private.calculate_attendance_summary(auth.uid(), event_row.work_date);
  return jsonb_build_object(
    'message', case when event_kind = 'CHECK_IN' then '출근이 기록되었습니다.' else '퇴근이 기록되었습니다.' end,
    'event_id', event_row.id,
    'work_date', event_row.work_date,
    'status', summary.attendance_status
  );
end;
$$;

create function private.workforce_command(p_action text, p_payload jsonb, p_request_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  policy_id uuid;
  summary_id uuid;
  next_version integer;
  effective_start date;
  policy_timezone text;
  corrected_in timestamptz;
  corrected_out timestamptz;
begin
  perform set_config('app.request_id', coalesce(p_request_id, ''), true);
  if p_action = 'work_policy.create' then
    perform private.require_permission('WORK_POLICY_MANAGE');
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_payload->>'timezone') then
      raise exception 'invalid timezone' using errcode = '22023';
    end if;
    select coalesce(max(version), 0) + 1 into next_version
      from public.work_policies where code = p_payload->>'code';
    insert into public.work_policies(
      code, version, name, check_in_time, check_out_time, break_start, break_end,
      late_grace_minutes, timezone, working_days, created_by
    ) values (
      p_payload->>'code', next_version, p_payload->>'name',
      (p_payload->>'check_in_time')::time, (p_payload->>'check_out_time')::time,
      nullif(p_payload->>'break_start', '')::time, nullif(p_payload->>'break_end', '')::time,
      (p_payload->>'late_grace_minutes')::integer, p_payload->>'timezone',
      array(select jsonb_array_elements_text(p_payload->'working_days')::smallint), auth.uid()
    ) returning id into target;
    return jsonb_build_object('id', target, 'version', next_version, 'message', '근무정책 버전을 생성했습니다.');

  elsif p_action = 'work_policy.assign' then
    perform private.require_permission('WORK_POLICY_MANAGE');
    target := (p_payload->>'user_id')::uuid;
    policy_id := (p_payload->>'work_policy_id')::uuid;
    effective_start := (p_payload->>'effective_from')::date;
    if not exists (select 1 from public.employees where id = target and user_status = 'ACTIVE')
      or not exists (select 1 from public.work_policies where id = policy_id and active) then
      raise exception 'employee or policy not found' using errcode = 'P0002';
    end if;
    update public.user_work_policy_assignments
      set effective_to = effective_start
      where user_id = target and effective_from < effective_start
        and (effective_to is null or effective_to > effective_start);
    insert into public.user_work_policy_assignments(
      user_id, work_policy_id, effective_from, effective_to, assigned_by
    ) values (
      target, policy_id, effective_start, nullif(p_payload->>'effective_to', '')::date, auth.uid()
    ) returning id into target;
    return jsonb_build_object('id', target, 'message', '근무정책을 배정했습니다.');

  elsif p_action = 'attendance.correct' then
    perform private.require_permission('ATTENDANCE_MANAGE');
    target := (p_payload->>'user_id')::uuid;
    effective_start := (p_payload->>'work_date')::date;
    select id into summary_id from public.attendance_daily_summaries
      where user_id = target and work_date = effective_start for update;
    if not found then
      perform private.calculate_attendance_summary(target, effective_start);
      select id into summary_id from public.attendance_daily_summaries
        where user_id = target and work_date = effective_start for update;
    end if;
    select timezone into policy_timezone from public.work_policies
      where id = (select work_policy_id from public.attendance_daily_summaries where id = summary_id);
    corrected_in := case when nullif(p_payload->>'check_in_time', '') is null then null
      else (effective_start + (p_payload->>'check_in_time')::time) at time zone policy_timezone end;
    corrected_out := case when nullif(p_payload->>'check_out_time', '') is null then null
      else (effective_start
        + case when (p_payload->>'check_out_time')::time <= (p_payload->>'check_in_time')::time then 1 else 0 end
        + (p_payload->>'check_out_time')::time) at time zone policy_timezone end;
    insert into public.attendance_corrections(
      attendance_summary_id, corrected_check_in_at, corrected_check_out_at, reason, corrected_by
    ) values (
      summary_id, corrected_in, corrected_out, p_payload->>'reason', auth.uid()
    );
    perform private.calculate_attendance_summary(target, effective_start);
    return jsonb_build_object('id', summary_id, 'message', '근태 보정 이력을 기록했습니다.');
  end if;
  raise exception 'unsupported workforce action' using errcode = '22023';
end;
$$;

create function public.attendance_command(p_action text, p_payload jsonb default '{}'::jsonb, p_request_id text default null)
returns jsonb language sql security definer set search_path = '' as $$
  select private.attendance_command(p_action, p_payload, p_request_id);
$$;

create function public.workforce_command(p_action text, p_payload jsonb, p_request_id text default null)
returns jsonb language sql security definer set search_path = '' as $$
  select private.workforce_command(p_action, p_payload, p_request_id);
$$;

alter table public.work_policies enable row level security;
alter table public.user_work_policy_assignments enable row level security;
alter table public.attendance_events enable row level security;
alter table public.attendance_daily_summaries enable row level security;
alter table public.attendance_corrections enable row level security;

create policy work_policy_read on public.work_policies for select to authenticated using (
  (select private.is_active()) and (
    (select private.has_permission('WORK_POLICY_MANAGE'))
    or exists (
      select 1 from public.user_work_policy_assignments a
      where a.work_policy_id = work_policies.id and (
        a.user_id = (select auth.uid())
        or exists (
          select 1 from public.employees e
          where e.id = a.user_id and (select private.manages_organization(e.organization_id))
        )
      )
    )
  )
);

create policy work_policy_assignment_read on public.user_work_policy_assignments for select to authenticated using (
  (select private.is_active()) and (
    user_id = (select auth.uid())
    or (select private.has_permission('WORK_POLICY_MANAGE'))
    or exists (
      select 1 from public.employees e
      where e.id = user_id and (select private.manages_organization(e.organization_id))
    )
  )
);

create policy attendance_event_read on public.attendance_events for select to authenticated using (
  (select private.is_active()) and (
    user_id = (select auth.uid())
    or (select private.has_permission('ATTENDANCE_MANAGE'))
    or exists (
      select 1 from public.employees e
      where e.id = user_id and (select private.manages_organization(e.organization_id))
    )
  )
);

create policy attendance_summary_read on public.attendance_daily_summaries for select to authenticated using (
  (select private.is_active()) and (
    user_id = (select auth.uid())
    or (select private.has_permission('ATTENDANCE_MANAGE'))
    or exists (
      select 1 from public.employees e
      where e.id = user_id and (select private.manages_organization(e.organization_id))
    )
  )
);

create policy attendance_correction_read on public.attendance_corrections for select to authenticated using (
  (select private.is_active()) and exists (
    select 1 from public.attendance_daily_summaries s
    where s.id = attendance_summary_id and (
      s.user_id = (select auth.uid())
      or (select private.has_permission('ATTENDANCE_MANAGE'))
      or exists (
        select 1 from public.employees e
        where e.id = s.user_id and (select private.manages_organization(e.organization_id))
      )
    )
  )
);

grant select on public.work_policies, public.user_work_policy_assignments,
  public.attendance_events, public.attendance_daily_summaries, public.attendance_corrections
  to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.work_policies,
  public.user_work_policy_assignments, public.attendance_events,
  public.attendance_daily_summaries, public.attendance_corrections from anon, authenticated;
grant execute on function public.attendance_command(text,jsonb,text),
  public.workforce_command(text,jsonb,text) to authenticated;
revoke execute on function private.prevent_used_policy_schedule_change(), private.request_ip(),
  private.resolve_work_policy(uuid,timestamptz), private.policy_for_work_date(uuid,date),
  private.calculate_attendance_summary(uuid,date), private.attendance_command(text,jsonb,text),
  private.workforce_command(text,jsonb,text) from public, anon, authenticated;

commit;
