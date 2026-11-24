begin;

insert into public.permissions(code,description) values
 ('QUOTATION_READ','담당 견적 조회'),
 ('QUOTATION_READ_ALL','전체 견적 조회'),
 ('QUOTATION_MANAGE','견적과 Revision 작성'),
 ('QUOTATION_APPROVE','견적 승인 및 반려')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (r.code='ADMIN' and p.code in ('QUOTATION_READ','QUOTATION_READ_ALL','QUOTATION_MANAGE','QUOTATION_APPROVE'))
   or (r.code='SALES' and p.code in ('QUOTATION_READ','QUOTATION_MANAGE'))
   or (r.code in ('PROJECT_MANAGER','FINANCE_MANAGER') and p.code in ('QUOTATION_READ_ALL','QUOTATION_APPROVE'))
on conflict do nothing;

create sequence public.quotation_number_seq;

create table public.quotations (
 id uuid primary key default gen_random_uuid(),
 quotation_number text not null unique default
  ('Q-'||to_char(current_date,'YYYYMM')||'-'||lpad(nextval('public.quotation_number_seq')::text,5,'0')),
 customer_id uuid not null references public.customers(id) on delete restrict,
 opportunity_id uuid not null references public.opportunities(id) on delete restrict,
 current_revision_id uuid,
 approved_revision_id uuid,
 status text not null default 'DRAFT'
  check(status in ('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELED','ARCHIVED')),
 created_by uuid not null references public.employees(id) on delete restrict,
 updated_by uuid not null references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter sequence public.quotation_number_seq owned by public.quotations.quotation_number;

create table public.quotation_revisions (
 id uuid primary key default gen_random_uuid(),
 quotation_id uuid not null references public.quotations(id) on delete restrict,
 revision_no integer not null check(revision_no>0),
 project_name text not null check(length(trim(project_name)) between 1 and 200),
 quotation_date date not null,
 valid_until date not null,
 vat_rate numeric(5,2) not null default 10 check(vat_rate between 0 and 100),
 supply_amount numeric(18,2) not null default 0 check(supply_amount>=0),
 vat_amount numeric(18,2) not null default 0 check(vat_amount>=0),
 total_amount numeric(18,2) not null default 0 check(total_amount>=0),
 expected_cost numeric(18,2) not null default 0 check(expected_cost>=0),
 expected_profit numeric(18,2) not null default 0,
 expected_profit_rate numeric(9,4) not null default 0,
 note text not null default '' check(length(note)<=4000),
 status text not null default 'DRAFT'
  check(status in ('DRAFT','SUBMITTED','APPROVED','REJECTED','SUPERSEDED','CANCELED')),
 approval_subject_id uuid unique references public.approval_subjects(id) on delete restrict,
 created_by uuid not null references public.employees(id) on delete restrict,
 updated_by uuid not null references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(quotation_id,revision_no),
 check(valid_until>=quotation_date),
 check(total_amount=supply_amount+vat_amount),
 check(expected_profit=supply_amount-expected_cost)
);

alter table public.quotations
 add constraint quotations_current_revision_fkey foreign key(current_revision_id)
 references public.quotation_revisions(id) on delete restrict,
 add constraint quotations_approved_revision_fkey foreign key(approved_revision_id)
 references public.quotation_revisions(id) on delete restrict;

create table public.quotation_items (
 id uuid primary key default gen_random_uuid(),
 revision_id uuid not null references public.quotation_revisions(id) on delete restrict,
 item_name text not null check(length(trim(item_name)) between 1 and 200),
 role_name text not null default '' check(length(role_name)<=120),
 headcount integer not null default 1 check(headcount between 0 and 10000),
 man_month numeric(12,2) not null default 0 check(man_month>=0),
 period_start date,
 period_end date,
 quantity numeric(12,2) not null default 1 check(quantity>0),
 unit_price numeric(18,2) not null default 0 check(unit_price>=0),
 amount numeric(18,2) generated always as (round(quantity*unit_price,2)) stored,
 note text not null default '' check(length(note)<=2000),
 sort_order integer not null default 0,
 active boolean not null default true,
 created_by uuid not null references public.employees(id) on delete restrict,
 updated_by uuid not null references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(period_start is null or period_end is null or period_start<=period_end)
);

create table public.quotation_command_receipts (
 actor_user_id uuid not null references public.employees(id) on delete restrict,
 request_id text not null check(length(request_id) between 16 and 100),
 action text not null,
 payload_hash text not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(actor_user_id,request_id)
);

create index quotations_opportunity on public.quotations(opportunity_id,updated_at desc);
create index quotations_customer on public.quotations(customer_id,updated_at desc);
create index quotations_status on public.quotations(status,updated_at desc);
create index quotation_revisions_parent on public.quotation_revisions(quotation_id,revision_no desc);
create index quotation_items_revision on public.quotation_items(revision_id,active,sort_order,id);

create trigger touch_quotations before update on public.quotations
 for each row execute function private.touch_versioned_row();
create trigger touch_quotation_revisions before update on public.quotation_revisions
 for each row execute function private.touch_versioned_row();
create trigger touch_quotation_items before update on public.quotation_items
 for each row execute function private.touch_versioned_row();
create trigger audit_quotations after insert or update on public.quotations
 for each row execute function private.capture_audit();
create trigger audit_quotation_revisions after insert or update on public.quotation_revisions
 for each row execute function private.capture_audit();
create trigger audit_quotation_items after insert or update on public.quotation_items
 for each row execute function private.capture_audit();

alter table public.quotations enable row level security;
alter table public.quotation_revisions enable row level security;
alter table public.quotation_items enable row level security;
alter table public.quotation_command_receipts enable row level security;

create function private.can_read_quotation(p_quotation_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(
  select 1 from public.quotations q join public.opportunities o on o.id=q.opportunity_id
  where q.id=p_quotation_id and (
   private.has_permission('QUOTATION_READ_ALL') or private.has_permission('QUOTATION_APPROVE') or
   ((private.has_permission('QUOTATION_READ') or private.has_permission('QUOTATION_MANAGE')) and o.sales_owner_id=auth.uid())
  )
 );
$$;

create policy quotations_read on public.quotations for select to authenticated using(
 private.can_read_quotation(id)
);
create policy quotation_revisions_read on public.quotation_revisions for select to authenticated using(
 private.can_read_quotation(quotation_id)
);
create policy quotation_items_read on public.quotation_items for select to authenticated using(
 exists(select 1 from public.quotation_revisions r where r.id=revision_id and private.can_read_quotation(r.quotation_id))
);

grant select on public.quotations,public.quotation_revisions,public.quotation_items to authenticated;
revoke insert,update,delete on public.quotations,public.quotation_revisions,public.quotation_items
 from public,anon,authenticated;
revoke all on public.quotation_command_receipts from public,anon,authenticated;
revoke all on sequence public.quotation_number_seq from public,anon,authenticated;

create function private.refresh_quotation_revision(p_revision_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare subtotal numeric(18,2);
begin
 select coalesce(sum(amount),0) into subtotal from public.quotation_items
  where revision_id=p_revision_id and active;
 update public.quotation_revisions set
  supply_amount=subtotal,
  vat_amount=round(subtotal*vat_rate/100,2),
  total_amount=subtotal+round(subtotal*vat_rate/100,2),
  expected_profit=subtotal-expected_cost,
  expected_profit_rate=case when subtotal=0 then 0 else round((subtotal-expected_cost)*100/subtotal,4) end,
  updated_by=auth.uid()
 where id=p_revision_id;
end;
$$;

create function private.quotation_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 target uuid:=nullif(p_payload->>'id','')::uuid;
 target_revision_id uuid:=nullif(p_payload->>'revision_id','')::uuid;
 opportunity_id uuid:=nullif(p_payload->>'opportunity_id','')::uuid;
 q public.quotations;
 r public.quotation_revisions;
 item_row public.quotation_items;
 opp public.opportunities;
 approval_row public.approval_requests;
 step_row public.approval_request_steps;
 subject_id uuid;
 approval_id uuid;
 approver uuid;
 next_revision integer;
 output jsonb;
 content_hash text;
 existing_hash text;
 decision text;
 can_manage_all boolean:=private.has_permission('QUOTATION_READ_ALL');
begin
 if p_request_id is null or length(p_request_id) not between 16 and 100 then
  raise exception 'ValidationError' using errcode='22023';
 end if;
 perform set_config('app.request_id',p_request_id,true);
 content_hash:=encode(extensions.digest(convert_to(p_action||':'||p_payload::text,'UTF8'),'sha256'),'hex');
 select payload_hash,result into existing_hash,output from public.quotation_command_receipts
  where actor_user_id=auth.uid() and request_id=p_request_id;
 if found then
  if existing_hash<>content_hash then raise exception 'Conflict' using errcode='40001'; end if;
  return output;
 end if;

 if p_action='quotation.create' then
  perform private.require_permission('QUOTATION_MANAGE');
  select * into opp from public.opportunities where id=opportunity_id for share;
  if not found or opp.stage in ('LOST','ARCHIVED') then raise exception 'NotFound' using errcode='P0002'; end if;
  if opp.sales_owner_id<>auth.uid() and not can_manage_all then raise exception 'Forbidden' using errcode='42501'; end if;
  insert into public.quotations(customer_id,opportunity_id,created_by,updated_by)
   values(opp.customer_id,opp.id,auth.uid(),auth.uid()) returning * into q;
  insert into public.quotation_revisions(quotation_id,revision_no,project_name,quotation_date,valid_until,
   vat_rate,expected_cost,note,created_by,updated_by)
  values(q.id,1,trim(p_payload->>'project_name'),(p_payload->>'quotation_date')::date,
   (p_payload->>'valid_until')::date,coalesce((p_payload->>'vat_rate')::numeric,10),
   coalesce((p_payload->>'expected_cost')::numeric,0),coalesce(trim(p_payload->>'note'),''),auth.uid(),auth.uid())
  returning * into r;
  update public.quotations set current_revision_id=r.id,updated_by=auth.uid() where id=q.id;
  output:=jsonb_build_object('id',q.id,'revision_id',r.id,'message','견적 초안을 만들었습니다.','redirect','/quotations/'||q.id::text);

 elsif p_action='revision.save' then
  perform private.require_permission('QUOTATION_MANAGE');
  select * into r from public.quotation_revisions where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  select * into q from public.quotations where id=r.quotation_id for update;
  if not private.can_read_quotation(q.id) or (not can_manage_all and q.created_by<>auth.uid() and not exists(
   select 1 from public.opportunities o where o.id=q.opportunity_id and o.sales_owner_id=auth.uid()
  )) then raise exception 'Forbidden' using errcode='42501'; end if;
  if r.status<>'DRAFT' or r.version is distinct from (p_payload->>'version')::integer then
   raise exception 'Conflict' using errcode='40001';
  end if;
  update public.quotation_revisions set project_name=trim(p_payload->>'project_name'),
   quotation_date=(p_payload->>'quotation_date')::date,valid_until=(p_payload->>'valid_until')::date,
   vat_rate=coalesce((p_payload->>'vat_rate')::numeric,10),expected_cost=coalesce((p_payload->>'expected_cost')::numeric,0),
   note=coalesce(trim(p_payload->>'note'),''),updated_by=auth.uid() where id=r.id;
  perform private.refresh_quotation_revision(r.id);
  output:=jsonb_build_object('id',q.id,'revision_id',r.id,'message','견적 Revision을 저장했습니다.');

 elsif p_action='item.save' then
  perform private.require_permission('QUOTATION_MANAGE');
  select * into r from public.quotation_revisions where id=target_revision_id for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  select * into q from public.quotations where id=r.quotation_id for update;
  if r.status<>'DRAFT' then raise exception 'Conflict' using errcode='40001'; end if;
  if not can_manage_all and not exists(select 1 from public.opportunities o where o.id=q.opportunity_id and o.sales_owner_id=auth.uid()) then
   raise exception 'Forbidden' using errcode='42501';
  end if;
  if target is null then
   insert into public.quotation_items(revision_id,item_name,role_name,headcount,man_month,period_start,period_end,
    quantity,unit_price,note,sort_order,created_by,updated_by)
   values(r.id,trim(p_payload->>'item_name'),coalesce(trim(p_payload->>'role_name'),''),
    coalesce((p_payload->>'headcount')::integer,1),coalesce((p_payload->>'man_month')::numeric,0),
    nullif(p_payload->>'period_start','')::date,nullif(p_payload->>'period_end','')::date,
    (p_payload->>'quantity')::numeric,(p_payload->>'unit_price')::numeric,coalesce(trim(p_payload->>'note'),''),
    coalesce((p_payload->>'sort_order')::integer,0),auth.uid(),auth.uid()) returning * into item_row;
  else
   select * into item_row from public.quotation_items where id=target and revision_id=r.id for update;
   if not found then raise exception 'NotFound' using errcode='P0002'; end if;
   if item_row.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   update public.quotation_items set item_name=trim(p_payload->>'item_name'),role_name=coalesce(trim(p_payload->>'role_name'),''),
    headcount=coalesce((p_payload->>'headcount')::integer,1),man_month=coalesce((p_payload->>'man_month')::numeric,0),
    period_start=nullif(p_payload->>'period_start','')::date,period_end=nullif(p_payload->>'period_end','')::date,
    quantity=(p_payload->>'quantity')::numeric,unit_price=(p_payload->>'unit_price')::numeric,
    note=coalesce(trim(p_payload->>'note'),''),sort_order=coalesce((p_payload->>'sort_order')::integer,0),
    active=true,updated_by=auth.uid() where id=item_row.id returning * into item_row;
  end if;
  perform private.refresh_quotation_revision(r.id);
  output:=jsonb_build_object('id',q.id,'item_id',item_row.id,'message','견적 항목을 저장했습니다.');

 elsif p_action='item.archive' then
  perform private.require_permission('QUOTATION_MANAGE');
  select * into item_row from public.quotation_items where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  select * into r from public.quotation_revisions where id=item_row.revision_id for update;
  select * into q from public.quotations where id=r.quotation_id for update;
  if r.status<>'DRAFT' or item_row.version is distinct from (p_payload->>'version')::integer then
   raise exception 'Conflict' using errcode='40001';
  end if;
  if not can_manage_all and not exists(select 1 from public.opportunities o where o.id=q.opportunity_id and o.sales_owner_id=auth.uid()) then
   raise exception 'Forbidden' using errcode='42501';
  end if;
  update public.quotation_items set active=false,updated_by=auth.uid() where id=item_row.id;
  perform private.refresh_quotation_revision(r.id);
  output:=jsonb_build_object('id',q.id,'message','견적 항목을 보관했습니다.');

 elsif p_action='revision.create' then
  perform private.require_permission('QUOTATION_MANAGE');
  select * into q from public.quotations where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if q.status not in ('DRAFT','REJECTED') then raise exception 'Conflict' using errcode='40001'; end if;
  if not can_manage_all and not exists(select 1 from public.opportunities o where o.id=q.opportunity_id and o.sales_owner_id=auth.uid()) then
   raise exception 'Forbidden' using errcode='42501';
  end if;
  select * into r from public.quotation_revisions where id=q.current_revision_id for update;
  next_revision:=r.revision_no+1;
  update public.quotation_revisions set status='SUPERSEDED',updated_by=auth.uid() where id=r.id;
  insert into public.quotation_revisions(quotation_id,revision_no,project_name,quotation_date,valid_until,vat_rate,
   supply_amount,vat_amount,total_amount,expected_cost,expected_profit,expected_profit_rate,note,created_by,updated_by)
  values(q.id,next_revision,r.project_name,current_date,greatest(current_date,r.valid_until),r.vat_rate,
   r.supply_amount,r.vat_amount,r.total_amount,r.expected_cost,r.expected_profit,r.expected_profit_rate,r.note,auth.uid(),auth.uid())
  returning * into r;
  insert into public.quotation_items(revision_id,item_name,role_name,headcount,man_month,period_start,period_end,
   quantity,unit_price,note,sort_order,created_by,updated_by)
  select r.id,item_name,role_name,headcount,man_month,period_start,period_end,quantity,unit_price,note,sort_order,auth.uid(),auth.uid()
   from public.quotation_items where revision_id=q.current_revision_id and active order by sort_order,id;
  update public.quotations set current_revision_id=r.id,status='DRAFT',updated_by=auth.uid() where id=q.id;
  output:=jsonb_build_object('id',q.id,'revision_id',r.id,'message','새 견적 Revision을 만들었습니다.');

 elsif p_action='quotation.submit' then
  perform private.require_permission('QUOTATION_MANAGE');
  select * into q from public.quotations where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if not can_manage_all and not exists(select 1 from public.opportunities o where o.id=q.opportunity_id and o.sales_owner_id=auth.uid()) then
   raise exception 'Forbidden' using errcode='42501';
  end if;
  select * into r from public.quotation_revisions where id=q.current_revision_id for update;
  if q.status<>'DRAFT' or r.status<>'DRAFT' or r.version is distinct from (p_payload->>'revision_version')::integer then
   raise exception 'Conflict' using errcode='40001';
  end if;
  if r.supply_amount<=0 or not exists(select 1 from public.quotation_items where revision_id=r.id and active) then
   raise exception 'ValidationError' using errcode='22023';
  end if;
  select e.id into approver from public.employees e
   where e.user_status='ACTIVE' and e.id<>auth.uid() and private.user_has_permission(e.id,'QUOTATION_APPROVE')
   order by case when private.user_has_permission(e.id,'FINANCE_MANAGER') then 0 else 1 end,e.created_at,e.id limit 1;
  if approver is null then raise exception 'NotFound' using errcode='P0002'; end if;
  insert into public.approval_subjects(request_type,reference_id) values('QUOTATION',r.id) returning id into subject_id;
  insert into public.approval_requests(approval_subject_id,request_type,reference_id,requester_id,route_snapshot)
   values(subject_id,'QUOTATION',r.id,auth.uid(),jsonb_build_array(jsonb_build_object(
    'step_order',1,'approver_type','ROLE_FALLBACK','approver_id',approver))) returning id into approval_id;
  insert into public.approval_request_steps(approval_request_id,step_order,approver_type,approver_id)
   values(approval_id,1,'ROLE_FALLBACK',approver);
  update public.quotation_revisions set status='SUBMITTED',approval_subject_id=subject_id,updated_by=auth.uid() where id=r.id;
  update public.quotations set status='SUBMITTED',updated_by=auth.uid() where id=q.id;
  perform private.enqueue_notification(approver,'QUOTATION_APPROVAL_REQUEST','견적 승인 요청',
   q.quotation_number||' 견적의 승인을 요청했습니다.','APPROVAL_REQUEST',approval_id,
   'quotation:'||r.id||':approval','quotation-approval-request');
  output:=jsonb_build_object('id',q.id,'approval_request_id',approval_id,'message','견적 승인을 요청했습니다.');

 elsif p_action='approval.decide' then
  perform private.require_permission('QUOTATION_APPROVE');
  decision:=p_payload->>'decision';
  select * into approval_row from public.approval_requests where id=target for update;
  if not found or approval_row.request_type<>'QUOTATION' then raise exception 'NotFound' using errcode='P0002'; end if;
  if approval_row.status<>'PENDING' or approval_row.version is distinct from (p_payload->>'version')::integer then
   raise exception 'Conflict' using errcode='40001';
  end if;
  select * into step_row from public.approval_request_steps
   where approval_request_id=approval_row.id and step_order=approval_row.current_step_order for update;
  if step_row.approver_id<>auth.uid() or step_row.status<>'PENDING' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into r from public.quotation_revisions where id=approval_row.reference_id for update;
  select * into q from public.quotations where id=r.quotation_id for update;
  if not found or r.status<>'SUBMITTED' then raise exception 'Conflict' using errcode='40001'; end if;
  if decision='APPROVED' then
   update public.approval_request_steps set status='APPROVED',approved_at=now(),comment=nullif(trim(p_payload->>'comment'),'') where id=step_row.id;
   update public.approval_requests set status='APPROVED',version=version+1 where id=approval_row.id;
   update public.quotation_revisions set status='APPROVED',updated_by=auth.uid() where id=r.id;
   update public.quotations set status='APPROVED',approved_revision_id=r.id,updated_by=auth.uid() where id=q.id;
   perform private.enqueue_notification(approval_row.requester_id,'QUOTATION_APPROVED','견적 승인 완료',
    q.quotation_number||' 견적이 승인되었습니다.','QUOTATION',q.id,'quotation:'||r.id||':approved','quotation-approved');
   output:=jsonb_build_object('id',approval_row.id,'message','견적을 승인했습니다.');
  elsif decision='REJECTED' then
   update public.approval_request_steps set status='REJECTED',approved_at=now(),comment=nullif(trim(p_payload->>'comment'),'') where id=step_row.id;
   update public.approval_requests set status='REJECTED',version=version+1 where id=approval_row.id;
   update public.quotation_revisions set status='REJECTED',updated_by=auth.uid() where id=r.id;
   update public.quotations set status='REJECTED',updated_by=auth.uid() where id=q.id;
   perform private.enqueue_notification(approval_row.requester_id,'QUOTATION_REJECTED','견적 승인 반려',
    q.quotation_number||' 견적이 반려되었습니다.','QUOTATION',q.id,'quotation:'||r.id||':rejected','quotation-rejected');
   output:=jsonb_build_object('id',approval_row.id,'message','견적을 반려했습니다.');
  else
   raise exception 'ValidationError' using errcode='22023';
  end if;
 else
  raise exception 'ValidationError' using errcode='22023';
 end if;

 insert into public.quotation_command_receipts(actor_user_id,request_id,action,payload_hash,result)
 values(auth.uid(),p_request_id,p_action,content_hash,output);
 return output;
end;
$$;

create function public.quotation_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language sql volatile security definer set search_path='' as $$
 select private.quotation_command(p_action,p_payload,p_request_id);
$$;

revoke execute on function private.can_read_quotation(uuid) from public,anon;
grant execute on function private.can_read_quotation(uuid) to authenticated;
revoke execute on function private.refresh_quotation_revision(uuid),
 private.quotation_command(text,jsonb,text) from public,anon,authenticated;
revoke execute on function public.quotation_command(text,jsonb,text) from public,anon;
grant execute on function public.quotation_command(text,jsonb,text) to authenticated;

commit;
