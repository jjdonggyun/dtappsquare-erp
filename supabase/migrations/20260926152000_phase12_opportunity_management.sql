begin;

insert into public.permissions(code,description) values
 ('OPPORTUNITY_READ','담당 영업기회 조회'),
 ('OPPORTUNITY_READ_ALL','전체 영업기회 조회'),
 ('OPPORTUNITY_MANAGE','영업기회 등록 및 단계 변경')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (r.code='ADMIN' and p.code in ('OPPORTUNITY_READ','OPPORTUNITY_READ_ALL','OPPORTUNITY_MANAGE'))
   or (r.code='SALES' and p.code in ('OPPORTUNITY_READ','OPPORTUNITY_MANAGE'))
   or (r.code in ('PROJECT_MANAGER','FINANCE_MANAGER') and p.code='OPPORTUNITY_READ_ALL')
on conflict do nothing;

create sequence public.opportunity_number_seq;

create table public.opportunities (
 id uuid primary key default gen_random_uuid(),
 opportunity_code text not null unique default
  ('OPP-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.opportunity_number_seq')::text,5,'0')),
 customer_id uuid not null references public.customers(id) on delete restrict,
 sales_owner_id uuid not null references public.employees(id) on delete restrict,
 title text not null check(length(trim(title)) between 1 and 200),
 expected_project_name text not null default '' check(length(expected_project_name)<=200),
 expected_amount numeric(18,2) not null default 0 check(expected_amount>=0),
 probability numeric(5,2) not null default 10 check(probability between 0 and 100),
 expected_revenue numeric(18,2) generated always as (round(expected_amount*probability/100,2)) stored,
 expected_start_date date,
 expected_end_date date,
 proposal_due_date date,
 competitor text not null default '' check(length(competitor)<=300),
 note text not null default '' check(length(note)<=4000),
 stage text not null default 'LEAD'
  check(stage in ('LEAD','PROPOSAL','QUOTATION','NEGOTIATION','ON_HOLD','WON','LOST','ARCHIVED')),
 lost_reason text not null default '' check(length(lost_reason)<=1000),
 closed_at timestamptz,
 archived_at timestamptz,
 created_by uuid not null references public.employees(id) on delete restrict,
 updated_by uuid not null references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(expected_start_date is null or expected_end_date is null or expected_start_date<=expected_end_date),
 check((stage='ARCHIVED')=(archived_at is not null)),
 check((stage in ('WON','LOST'))=(closed_at is not null) or stage='ARCHIVED'),
 check(stage<>'LOST' or length(trim(lost_reason))>0)
);

alter sequence public.opportunity_number_seq owned by public.opportunities.opportunity_code;
create index opportunities_owner_stage on public.opportunities(sales_owner_id,stage,updated_at desc);
create index opportunities_customer on public.opportunities(customer_id,updated_at desc);
create index opportunities_expected_close on public.opportunities(expected_end_date)
 where stage not in ('WON','LOST','ARCHIVED');
create index opportunities_title_search on public.opportunities(lower(title));

create table public.sales_command_receipts (
 actor_user_id uuid not null references public.employees(id) on delete restrict,
 request_id text not null check(length(request_id) between 16 and 100),
 action text not null,
 payload_hash text not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(actor_user_id,request_id)
);

create trigger touch_opportunities before update on public.opportunities
 for each row execute function private.touch_versioned_row();
create trigger audit_opportunities after insert or update on public.opportunities
 for each row execute function private.capture_audit();

alter table public.opportunities enable row level security;
alter table public.sales_command_receipts enable row level security;

create policy opportunities_read on public.opportunities for select to authenticated using(
 private.is_active() and (
  private.has_permission('OPPORTUNITY_READ_ALL') or
  ((private.has_permission('OPPORTUNITY_READ') or private.has_permission('OPPORTUNITY_MANAGE')) and sales_owner_id=auth.uid())
 )
);

grant select on table public.opportunities to authenticated;
revoke insert,update,delete on table public.opportunities from public,anon,authenticated;
revoke all on table public.sales_command_receipts from public,anon,authenticated;
revoke all on sequence public.opportunity_number_seq from public,anon,authenticated;

create function public.sales_owner_options()
returns table(id uuid,name text,employee_number text)
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_permission('OPPORTUNITY_MANAGE');
 return query
 select e.id,e.name,e.employee_number
 from public.employees e
 where e.user_status='ACTIVE'
   and exists(
    select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
    where ur.user_id=e.id and r.active and r.code in ('SALES','ADMIN')
   )
 order by e.name,e.id;
end;
$$;

create function private.sales_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 target uuid:=nullif(p_payload->>'id','')::uuid;
 customer uuid:=nullif(p_payload->>'customer_id','')::uuid;
 owner uuid:=coalesce(nullif(p_payload->>'sales_owner_id','')::uuid,auth.uid());
 row_version integer;
 current_stage text;
 current_owner uuid;
 next_stage text;
 output jsonb;
 content_hash text;
 existing_hash text;
 can_manage_all boolean:=private.has_permission('OPPORTUNITY_READ_ALL');
begin
 perform private.require_permission('OPPORTUNITY_MANAGE');
 if p_request_id is null or length(p_request_id) not between 16 and 100 then
  raise exception 'ValidationError' using errcode='22023';
 end if;
 perform set_config('app.request_id',p_request_id,true);
 content_hash:=encode(extensions.digest(convert_to(p_action||':'||p_payload::text,'UTF8'),'sha256'),'hex');
 select payload_hash,result into existing_hash,output from public.sales_command_receipts
  where actor_user_id=auth.uid() and request_id=p_request_id;
 if found then
  if existing_hash<>content_hash then raise exception 'Conflict' using errcode='40001'; end if;
  return output;
 end if;

 if p_action='opportunity.save' then
  if customer is null or not exists(select 1 from public.customers where id=customer and status='ACTIVE') then
   raise exception 'NotFound' using errcode='P0002';
  end if;
  if owner<>auth.uid() and not can_manage_all then raise exception 'Forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.employees where id=owner and user_status='ACTIVE') then
   raise exception 'NotFound' using errcode='P0002';
  end if;
  if target is null then
   insert into public.opportunities(customer_id,sales_owner_id,title,expected_project_name,expected_amount,probability,
    expected_start_date,expected_end_date,proposal_due_date,competitor,note,created_by,updated_by)
   values(customer,owner,trim(p_payload->>'title'),coalesce(trim(p_payload->>'expected_project_name'),''),
    coalesce((p_payload->>'expected_amount')::numeric,0),coalesce((p_payload->>'probability')::numeric,10),
    nullif(p_payload->>'expected_start_date','')::date,nullif(p_payload->>'expected_end_date','')::date,
    nullif(p_payload->>'proposal_due_date','')::date,coalesce(trim(p_payload->>'competitor'),''),
    coalesce(trim(p_payload->>'note'),''),auth.uid(),auth.uid()) returning id into target;
  else
   select version,stage,sales_owner_id into row_version,current_stage,current_owner
    from public.opportunities where id=target for update;
   if not found then raise exception 'NotFound' using errcode='P0002'; end if;
   if current_owner<>auth.uid() and not can_manage_all then raise exception 'Forbidden' using errcode='42501'; end if;
   if row_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   if current_stage in ('WON','LOST','ARCHIVED') then raise exception 'Conflict' using errcode='40001'; end if;
   update public.opportunities set customer_id=customer,sales_owner_id=owner,title=trim(p_payload->>'title'),
    expected_project_name=coalesce(trim(p_payload->>'expected_project_name'),''),
    expected_amount=coalesce((p_payload->>'expected_amount')::numeric,0),
    probability=coalesce((p_payload->>'probability')::numeric,10),
    expected_start_date=nullif(p_payload->>'expected_start_date','')::date,
    expected_end_date=nullif(p_payload->>'expected_end_date','')::date,
    proposal_due_date=nullif(p_payload->>'proposal_due_date','')::date,
    competitor=coalesce(trim(p_payload->>'competitor'),''),note=coalesce(trim(p_payload->>'note'),''),
    updated_by=auth.uid() where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','영업기회를 저장했습니다.','redirect','/opportunities/'||target::text);

 elsif p_action='opportunity.transition' then
  next_stage:=p_payload->>'to_stage';
  select version,stage,sales_owner_id into row_version,current_stage,current_owner
   from public.opportunities where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if current_owner<>auth.uid() and not can_manage_all then raise exception 'Forbidden' using errcode='42501'; end if;
  if row_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
  if not (
   (current_stage='LEAD' and next_stage in ('PROPOSAL','ON_HOLD','LOST')) or
   (current_stage='PROPOSAL' and next_stage in ('QUOTATION','ON_HOLD','LOST')) or
   (current_stage='QUOTATION' and next_stage in ('NEGOTIATION','WON','ON_HOLD','LOST')) or
   (current_stage='NEGOTIATION' and next_stage in ('WON','ON_HOLD','LOST')) or
   (current_stage='ON_HOLD' and next_stage in ('LEAD','PROPOSAL','QUOTATION','NEGOTIATION','LOST'))
  ) then raise exception 'Conflict' using errcode='40001';
  end if;
  if next_stage='LOST' and length(trim(coalesce(p_payload->>'lost_reason','')))=0 then
   raise exception 'ValidationError' using errcode='22023';
  end if;
  update public.opportunities set stage=next_stage,
   probability=case when next_stage='WON' then 100 when next_stage='LOST' then 0 else probability end,
   lost_reason=case when next_stage='LOST' then trim(p_payload->>'lost_reason') else '' end,
   closed_at=case when next_stage in ('WON','LOST') then now() else null end,
   updated_by=auth.uid() where id=target;
  output:=jsonb_build_object('id',target,'message','영업 단계를 변경했습니다.','redirect','/opportunities/'||target::text);

 elsif p_action='opportunity.archive' then
  select version,stage,sales_owner_id into row_version,current_stage,current_owner
   from public.opportunities where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if current_owner<>auth.uid() and not can_manage_all then raise exception 'Forbidden' using errcode='42501'; end if;
  if row_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
  if current_stage='WON' then raise exception 'Conflict' using errcode='40001'; end if;
  update public.opportunities set stage='ARCHIVED',archived_at=now(),closed_at=null,updated_by=auth.uid()
   where id=target;
  output:=jsonb_build_object('id',target,'message','영업기회를 보관했습니다.','redirect','/opportunities');
 else
  raise exception 'ValidationError' using errcode='22023';
 end if;

 insert into public.sales_command_receipts(actor_user_id,request_id,action,payload_hash,result)
 values(auth.uid(),p_request_id,p_action,content_hash,output);
 return output;
end;
$$;

create function public.sales_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language sql volatile security definer set search_path='' as $$
 select private.sales_command(p_action,p_payload,p_request_id);
$$;

revoke execute on function public.sales_owner_options() from public,anon;
grant execute on function public.sales_owner_options() to authenticated;
revoke execute on function private.sales_command(text,jsonb,text) from public,anon,authenticated;
revoke execute on function public.sales_command(text,jsonb,text) from public,anon;
grant execute on function public.sales_command(text,jsonb,text) to authenticated;

commit;
