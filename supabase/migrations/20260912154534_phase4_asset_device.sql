begin;

create extension if not exists pgcrypto with schema extensions;

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null unique check (asset_code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  asset_type text not null check (asset_type in ('LAPTOP','DESKTOP','MONITOR','PHONE','TABLET','LICENSE','ETC')),
  manufacturer text check (manufacturer is null or length(manufacturer) <= 100),
  model text check (model is null or length(model) <= 160),
  serial_number text check (serial_number is null or length(serial_number) <= 160),
  purchase_date date,
  warranty_end_date date,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE','ASSIGNED','IN_USE','REPAIR','LOST','RETURNED','DISPOSED')),
  memo text check (memo is null or length(memo) <= 2000),
  version integer not null default 1 check (version > 0),
  archived_at timestamptz,
  created_by uuid references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (warranty_end_date is null or purchase_date is null or warranty_end_date >= purchase_date),
  check ((status = 'DISPOSED') = (archived_at is not null))
);

create unique index assets_serial_number_unique
  on public.assets(lower(serial_number)) where serial_number is not null;
create index assets_type_status on public.assets(asset_type,status,asset_code);
create index assets_created_by on public.assets(created_by) where created_by is not null;

create table public.asset_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete restrict,
  user_id uuid not null references public.employees(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  returned_at timestamptz,
  assigned_by uuid not null references public.employees(id) on delete restrict,
  returned_by uuid references public.employees(id) on delete restrict,
  return_condition text check (return_condition is null or length(return_condition) <= 1000),
  memo text check (memo is null or length(memo) <= 2000),
  created_at timestamptz not null default now(),
  check (returned_at is null or returned_at >= assigned_at),
  check ((returned_at is null) = (returned_by is null))
);

create unique index asset_assignments_one_active
  on public.asset_assignments(asset_id) where returned_at is null;
create index asset_assignments_user_time on public.asset_assignments(user_id,assigned_at desc);
create index asset_assignments_asset_time on public.asset_assignments(asset_id,assigned_at desc);
create index asset_assignments_assigned_by on public.asset_assignments(assigned_by);
create index asset_assignments_returned_by on public.asset_assignments(returned_by) where returned_by is not null;

create table public.registered_devices (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null unique,
  asset_id uuid not null references public.assets(id) on delete restrict,
  hostname text not null check (length(trim(hostname)) between 1 and 253),
  serial_number text not null check (length(trim(serial_number)) between 1 and 160),
  mac_hash bytea not null,
  os text not null check (length(trim(os)) between 1 and 160),
  device_token_hash bytea not null,
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz,
  active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.employees(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check (octet_length(mac_hash) = 32),
  check (octet_length(device_token_hash) = 32)
);

create unique index registered_devices_serial_unique on public.registered_devices(lower(serial_number));
create unique index registered_devices_one_active_per_asset on public.registered_devices(asset_id) where active;
create index registered_devices_active_seen on public.registered_devices(active,last_seen_at desc);
create index registered_devices_created_by on public.registered_devices(created_by);

create function private.touch_versioned_row() returns trigger
language plpgsql set search_path='' as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger touch_assets before update on public.assets
for each row execute function private.touch_versioned_row();
create trigger touch_registered_devices before update on public.registered_devices
for each row execute function private.touch_versioned_row();

create or replace function private.capture_audit() returns trigger
language plpgsql security definer set search_path='' as $$
declare b jsonb; a jsonb;
begin
 if TG_OP<>'INSERT' then b=to_jsonb(old); end if;
 if TG_OP<>'DELETE' then a=to_jsonb(new); end if;
 if TG_TABLE_NAME='employees' then b=b-'phone'-'profile_image'-'email'; a=a-'phone'-'profile_image'-'email'; end if;
 if TG_TABLE_NAME='leave_requests' then b=b-'reason'; a=a-'reason'; end if;
 if TG_TABLE_NAME='approval_request_steps' then b=b-'comment'; a=a-'comment'; end if;
 if TG_TABLE_NAME='registered_devices' then
   b=b-'mac_hash'-'device_token_hash'; a=a-'mac_hash'-'device_token_hash';
 end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id)
 values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(a->>'id',b->>'id',a->>'user_id',b->>'user_id',a->>'role_id',b->>'role_id'),b,a,nullif(current_setting('app.request_id',true),''));
 return coalesce(new,old);
end;
$$;

create trigger audit_assets after insert or update on public.assets
for each row execute function private.capture_audit();
create trigger audit_asset_assignments after insert or update on public.asset_assignments
for each row execute function private.capture_audit();
create trigger audit_registered_devices_insert after insert on public.registered_devices
for each row execute function private.capture_audit();
create trigger audit_registered_devices_update after update of asset_id,hostname,serial_number,mac_hash,os,device_token_hash,active on public.registered_devices
for each row when (
  old.asset_id is distinct from new.asset_id or old.hostname is distinct from new.hostname
  or old.serial_number is distinct from new.serial_number or old.mac_hash is distinct from new.mac_hash
  or old.os is distinct from new.os or old.device_token_hash is distinct from new.device_token_hash
  or old.active is distinct from new.active
) execute function private.capture_audit();

create function private.asset_device_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  target uuid;
  asset_row public.assets;
  assignment_row public.asset_assignments;
  device_row public.registered_devices;
  next_status text;
  notification_key text;
begin
  if auth.uid() is null then raise exception 'Unauthorized' using errcode='28000'; end if;
  perform set_config('app.request_id',left(coalesce(p_request_id,''),100),true);

  if p_action = 'asset.save' then
    perform private.require_permission('ASSET_WRITE');
    target := nullif(p_payload->>'id','')::uuid;
    if target is null then
      insert into public.assets(
        asset_code,asset_type,manufacturer,model,serial_number,purchase_date,warranty_end_date,status,memo,created_by,archived_at
      ) values (
        upper(trim(p_payload->>'asset_code')),p_payload->>'asset_type',nullif(trim(p_payload->>'manufacturer'),''),
        nullif(trim(p_payload->>'model'),''),nullif(trim(p_payload->>'serial_number'),''),
        nullif(p_payload->>'purchase_date','')::date,nullif(p_payload->>'warranty_end_date','')::date,
        coalesce(nullif(p_payload->>'status',''),'AVAILABLE'),nullif(trim(p_payload->>'memo'),''),auth.uid(),
        case when p_payload->>'status'='DISPOSED' then now() else null end
      ) returning id into target;
    else
      select * into asset_row from public.assets where id=target for update;
      if not found then raise exception 'NotFound' using errcode='P0002'; end if;
      if asset_row.version is distinct from (p_payload->>'version')::integer then
        raise exception 'Conflict' using errcode='40001';
      end if;
      next_status := p_payload->>'status';
      if exists(select 1 from public.asset_assignments where asset_id=target and returned_at is null)
         and next_status not in ('ASSIGNED','IN_USE','REPAIR','LOST') then
        raise exception 'Conflict' using errcode='40001';
      end if;
      if next_status='DISPOSED' and exists(select 1 from public.asset_assignments where asset_id=target and returned_at is null) then
        raise exception 'Conflict' using errcode='40001';
      end if;
      update public.assets set
        asset_code=upper(trim(p_payload->>'asset_code')),asset_type=p_payload->>'asset_type',
        manufacturer=nullif(trim(p_payload->>'manufacturer'),''),model=nullif(trim(p_payload->>'model'),''),
        serial_number=nullif(trim(p_payload->>'serial_number'),''),purchase_date=nullif(p_payload->>'purchase_date','')::date,
        warranty_end_date=nullif(p_payload->>'warranty_end_date','')::date,status=next_status,
        memo=nullif(trim(p_payload->>'memo'),''),archived_at=case when next_status='DISPOSED' then coalesce(archived_at,now()) else null end
      where id=target;
    end if;
    return jsonb_build_object('id',target,'message','자산 정보를 저장했습니다.');

  elsif p_action = 'asset.assign' then
    perform private.require_permission('ASSET_WRITE');
    target := (p_payload->>'asset_id')::uuid;
    select * into asset_row from public.assets where id=target for update;
    if not found then raise exception 'NotFound' using errcode='P0002'; end if;
    if asset_row.status not in ('AVAILABLE','RETURNED')
       or exists(select 1 from public.asset_assignments where asset_id=target and returned_at is null) then
      raise exception 'Conflict' using errcode='40001';
    end if;
    if not exists(select 1 from public.employees where id=(p_payload->>'user_id')::uuid and user_status='ACTIVE') then
      raise exception 'NotFound' using errcode='P0002';
    end if;
    insert into public.asset_assignments(asset_id,user_id,assigned_at,assigned_by,memo)
    values(target,(p_payload->>'user_id')::uuid,coalesce(nullif(p_payload->>'assigned_at','')::timestamptz,now()),auth.uid(),nullif(trim(p_payload->>'memo'),''))
    returning * into assignment_row;
    update public.assets set status='ASSIGNED' where id=target;
    notification_key := 'asset-assignment:'||assignment_row.id||':assigned';
    perform private.enqueue_notification(
      assignment_row.user_id,'ASSET_ASSIGNED','자산 지급 완료',asset_row.asset_code||' 자산이 지급되었습니다.',
      'ASSET_ASSIGNMENT',assignment_row.id,notification_key,'asset-assigned'
    );
    return jsonb_build_object('id',assignment_row.id,'message','자산을 지급했습니다.');

  elsif p_action = 'asset.return' then
    perform private.require_permission('ASSET_WRITE');
    target := (p_payload->>'assignment_id')::uuid;
    select * into assignment_row from public.asset_assignments where id=target for update;
    if not found then raise exception 'NotFound' using errcode='P0002'; end if;
    if assignment_row.returned_at is not null then raise exception 'Conflict' using errcode='40001'; end if;
    update public.asset_assignments set
      returned_at=coalesce(nullif(p_payload->>'returned_at','')::timestamptz,now()),returned_by=auth.uid(),
      return_condition=nullif(trim(p_payload->>'return_condition'),''),memo=coalesce(nullif(trim(p_payload->>'memo'),''),memo)
    where id=target returning * into assignment_row;
    update public.assets set status='RETURNED' where id=assignment_row.asset_id;
    perform private.enqueue_notification(
      assignment_row.user_id,'ASSET_RETURNED','자산 반납 완료','지급 자산의 반납 처리가 완료되었습니다.',
      'ASSET_ASSIGNMENT',assignment_row.id,'asset-assignment:'||assignment_row.id||':returned','asset-returned'
    );
    return jsonb_build_object('id',assignment_row.id,'message','자산 반납을 기록했습니다.');

  elsif p_action = 'device.register' then
    perform private.require_permission('DEVICE_MANAGE');
    if not exists(select 1 from public.assets where id=(p_payload->>'asset_id')::uuid and asset_type in ('LAPTOP','DESKTOP','PHONE','TABLET')) then
      raise exception 'NotFound' using errcode='P0002';
    end if;
    insert into public.registered_devices(
      device_id,asset_id,hostname,serial_number,mac_hash,os,device_token_hash,created_by
    ) values (
      coalesce(nullif(p_payload->>'device_id','')::uuid,gen_random_uuid()),(p_payload->>'asset_id')::uuid,
      trim(p_payload->>'hostname'),trim(p_payload->>'serial_number'),
      extensions.digest(lower(trim(p_payload->>'mac_address')),'sha256'),trim(p_payload->>'os'),
      extensions.digest(p_payload->>'device_token','sha256'),auth.uid()
    ) returning * into device_row;
    return jsonb_build_object('id',device_row.id,'device_id',device_row.device_id,'message','장치를 등록했습니다.');

  elsif p_action = 'device.status' then
    perform private.require_permission('DEVICE_MANAGE');
    target := (p_payload->>'id')::uuid;
    select * into device_row from public.registered_devices where id=target for update;
    if not found then raise exception 'NotFound' using errcode='P0002'; end if;
    if device_row.version is distinct from (p_payload->>'version')::integer then
      raise exception 'Conflict' using errcode='40001';
    end if;
    update public.registered_devices set active=(p_payload->>'active')::boolean where id=target;
    return jsonb_build_object('id',target,'message',case when (p_payload->>'active')::boolean then '장치를 활성화했습니다.' else '장치를 비활성화했습니다.' end);
  end if;
  raise exception 'unsupported asset/device action' using errcode='22023';
end;
$$;

create function public.asset_device_command(p_action text,p_payload jsonb,p_request_id text default null)
returns jsonb language sql security definer set search_path='' as $$
  select private.asset_device_command(p_action,p_payload,p_request_id);
$$;

create function private.device_agent_heartbeat(p_device_id uuid,p_device_token text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare device_row public.registered_devices;
begin
  if p_device_token is null or length(p_device_token) < 32 then
    raise exception 'Unauthorized' using errcode='28000';
  end if;
  select * into device_row from public.registered_devices
  where device_id=p_device_id and active
    and device_token_hash=extensions.digest(p_device_token,'sha256')
  for update;
  if not found then raise exception 'Unauthorized' using errcode='28000'; end if;
  update public.registered_devices set
    hostname=coalesce(nullif(trim(p_payload->>'hostname'),''),hostname),
    os=coalesce(nullif(trim(p_payload->>'os'),''),os),
    mac_hash=case when nullif(trim(p_payload->>'mac_address'),'') is null then mac_hash
      else extensions.digest(lower(trim(p_payload->>'mac_address')),'sha256') end,
    last_seen_at=clock_timestamp()
  where id=device_row.id;
  return jsonb_build_object('accepted',true,'server_time',clock_timestamp());
end;
$$;

create function public.device_agent_heartbeat(p_device_id uuid,p_device_token text,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql security definer set search_path='' as $$
  select private.device_agent_heartbeat(p_device_id,p_device_token,p_payload);
$$;

alter table public.assets enable row level security;
alter table public.asset_assignments enable row level security;
alter table public.registered_devices enable row level security;

revoke all on public.assets,public.asset_assignments,public.registered_devices from anon,authenticated;
grant select on public.assets,public.asset_assignments,public.registered_devices to authenticated;

create policy assets_read on public.assets for select to authenticated using(
  (select private.is_active()) and (
    (select private.has_permission('ASSET_READ')) or (select private.has_permission('ASSET_WRITE'))
    or exists(select 1 from public.asset_assignments aa where aa.asset_id=assets.id and aa.user_id=(select auth.uid()))
  )
);
create policy asset_assignments_read on public.asset_assignments for select to authenticated using(
  (select private.is_active()) and (
    user_id=(select auth.uid()) or (select private.has_permission('ASSET_READ')) or (select private.has_permission('ASSET_WRITE'))
  )
);
create policy registered_devices_read on public.registered_devices for select to authenticated using(
  (select private.is_active()) and (
    (select private.has_permission('DEVICE_MANAGE')) or (select private.has_permission('ASSET_READ'))
    or exists(select 1 from public.asset_assignments aa where aa.asset_id=registered_devices.asset_id and aa.user_id=(select auth.uid()))
  )
);

grant execute on function public.asset_device_command(text,jsonb,text) to authenticated;
grant execute on function public.device_agent_heartbeat(uuid,text,jsonb) to service_role;
revoke execute on function public.asset_device_command(text,jsonb,text),public.device_agent_heartbeat(uuid,text,jsonb) from public,anon;
revoke execute on function public.device_agent_heartbeat(uuid,text,jsonb) from authenticated;
revoke execute on function private.asset_device_command(text,jsonb,text),private.device_agent_heartbeat(uuid,text,jsonb),private.touch_versioned_row() from public,anon,authenticated;

commit;
