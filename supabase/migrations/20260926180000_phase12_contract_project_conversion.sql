begin;

insert into public.permissions(code,description) values
 ('CONTRACT_READ','담당 계약 조회'),
 ('CONTRACT_READ_ALL','전체 계약 조회'),
 ('CONTRACT_MANAGE','계약 작성, 서명 및 프로젝트 전환'),
 ('CONTRACT_APPROVE','계약 승인 및 반려')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (r.code='ADMIN' and p.code in ('CONTRACT_READ','CONTRACT_READ_ALL','CONTRACT_MANAGE','CONTRACT_APPROVE'))
   or (r.code='SALES' and p.code in ('CONTRACT_READ','CONTRACT_MANAGE'))
   or (r.code in ('PROJECT_MANAGER','FINANCE_MANAGER') and p.code in ('CONTRACT_READ_ALL','CONTRACT_APPROVE'))
on conflict do nothing;

create sequence public.contract_number_seq;

create table public.contracts (
 id uuid primary key default gen_random_uuid(),
 contract_number text not null unique default
  ('C-'||to_char(current_date,'YYYYMM')||'-'||lpad(nextval('public.contract_number_seq')::text,5,'0')),
 customer_id uuid not null references public.customers(id) on delete restrict,
 opportunity_id uuid not null references public.opportunities(id) on delete restrict,
 quotation_revision_id uuid not null unique references public.quotation_revisions(id) on delete restrict,
 contract_name text not null check(length(trim(contract_name)) between 1 and 200),
 purchase_order_number text not null default '' check(length(purchase_order_number)<=100),
 contract_date date not null,
 start_date date not null,
 end_date date not null,
 signed_date date,
 supply_amount numeric(18,2) not null check(supply_amount>=0),
 vat_rate numeric(5,2) not null default 10 check(vat_rate between 0 and 100),
 vat_amount numeric(18,2) not null default 0 check(vat_amount>=0),
 total_amount numeric(18,2) not null default 0 check(total_amount>=0),
 payment_terms text not null default '' check(length(payment_terms)<=2000),
 warranty_terms text not null default '' check(length(warranty_terms)<=2000),
 note text not null default '' check(length(note)<=4000),
 status text not null default 'DRAFT'
  check(status in ('DRAFT','SUBMITTED','APPROVED','REJECTED','SIGNED','ACTIVE','COMPLETED','TERMINATED','CANCELED')),
 approval_subject_id uuid unique references public.approval_subjects(id) on delete restrict,
 current_amendment_no integer not null default 0 check(current_amendment_no>=0),
 created_by uuid not null references public.employees(id) on delete restrict,
 updated_by uuid not null references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(end_date>=start_date),
 check(total_amount=supply_amount+vat_amount),
 check(status not in ('SIGNED','ACTIVE','COMPLETED','TERMINATED') or signed_date is not null)
);
alter sequence public.contract_number_seq owned by public.contracts.contract_number;

create table public.contract_amendments (
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null references public.contracts(id) on delete restrict,
 amendment_no integer not null check(amendment_no>=0),
 reason text not null default '' check(length(reason)<=1000),
 snapshot jsonb not null,
 created_by uuid not null references public.employees(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(contract_id,amendment_no)
);

create table public.contract_command_receipts (
 actor_user_id uuid not null references public.employees(id) on delete restrict,
 request_id text not null check(length(request_id) between 16 and 100),
 action text not null,
 payload_hash text not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(actor_user_id,request_id)
);

alter table public.projects
 add column contract_id uuid references public.contracts(id) on delete restrict,
 add column opportunity_id uuid references public.opportunities(id) on delete restrict,
 add column quotation_revision_id uuid references public.quotation_revisions(id) on delete restrict,
 add column sales_owner_id uuid references public.employees(id) on delete restrict;
create unique index projects_contract_unique on public.projects(contract_id) where contract_id is not null;
create index projects_opportunity_id on public.projects(opportunity_id) where opportunity_id is not null;
create index projects_quotation_revision_id on public.projects(quotation_revision_id) where quotation_revision_id is not null;
create index projects_sales_owner_id on public.projects(sales_owner_id) where sales_owner_id is not null;

create index contracts_customer on public.contracts(customer_id,updated_at desc);
create index contracts_opportunity on public.contracts(opportunity_id,updated_at desc);
create index contracts_status on public.contracts(status,updated_at desc);
create index contract_amendments_parent on public.contract_amendments(contract_id,amendment_no desc);

create function private.derive_contract_financials()
returns trigger language plpgsql set search_path='' as $$
begin
 new.vat_amount:=round(new.supply_amount*new.vat_rate/100,2);
 new.total_amount:=new.supply_amount+new.vat_amount;
 return new;
end;
$$;
create trigger derive_contract_financials before insert or update of supply_amount,vat_rate on public.contracts
 for each row execute function private.derive_contract_financials();
create trigger touch_contracts before update on public.contracts
 for each row execute function private.touch_versioned_row();
create trigger audit_contracts after insert or update on public.contracts
 for each row execute function private.capture_audit();
create trigger audit_contract_amendments after insert on public.contract_amendments
 for each row execute function private.capture_audit();

alter table public.contracts enable row level security;
alter table public.contract_amendments enable row level security;
alter table public.contract_command_receipts enable row level security;

create function private.can_read_contract(p_contract_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(
  select 1 from public.contracts c join public.opportunities o on o.id=c.opportunity_id
  where c.id=p_contract_id and (
   private.has_permission('CONTRACT_READ_ALL') or private.has_permission('CONTRACT_APPROVE') or
   ((private.has_permission('CONTRACT_READ') or private.has_permission('CONTRACT_MANAGE')) and o.sales_owner_id=auth.uid())
  )
 );
$$;
create policy contracts_read on public.contracts for select to authenticated using(private.can_read_contract(id));
create policy contract_amendments_read on public.contract_amendments for select to authenticated using(
 private.can_read_contract(contract_id)
);

grant select on public.contracts,public.contract_amendments to authenticated;
revoke insert,update,delete on public.contracts,public.contract_amendments from public,anon,authenticated;
revoke all on public.contract_command_receipts from public,anon,authenticated;
revoke all on sequence public.contract_number_seq from public,anon,authenticated;
revoke execute on function private.can_read_contract(uuid) from public,anon;
grant execute on function private.can_read_contract(uuid) to authenticated;
revoke execute on function private.derive_contract_financials() from public,anon,authenticated;

create function private.contract_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 target uuid:=nullif(p_payload->>'id','')::uuid;
 source_revision_id uuid:=nullif(p_payload->>'quotation_revision_id','')::uuid;
 c public.contracts;
 qr public.quotation_revisions;
 q public.quotations;
 opp public.opportunities;
 customer public.customers;
 approval_row public.approval_requests;
 step_row public.approval_request_steps;
 subject_id uuid;
 approval_id uuid;
 approver uuid;
 project_id uuid;
 manager_id uuid;
 output jsonb;
 content_hash text;
 existing_hash text;
 decision text;
 can_manage_all boolean:=private.has_permission('CONTRACT_READ_ALL');
begin
 if p_request_id is null or length(p_request_id) not between 16 and 100 then
  raise exception 'ValidationError' using errcode='22023';
 end if;
 perform set_config('app.request_id',p_request_id,true);
 content_hash:=encode(extensions.digest(convert_to(p_action||':'||p_payload::text,'UTF8'),'sha256'),'hex');
 select payload_hash,result into existing_hash,output from public.contract_command_receipts
  where actor_user_id=auth.uid() and request_id=p_request_id;
 if found then
  if existing_hash<>content_hash then raise exception 'Conflict' using errcode='40001'; end if;
  return output;
 end if;

 if p_action='contract.create' then
  perform private.require_permission('CONTRACT_MANAGE');
  select * into qr from public.quotation_revisions where id=source_revision_id and status='APPROVED' for share;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  select * into q from public.quotations where id=qr.quotation_id and approved_revision_id=qr.id and status='APPROVED' for share;
  if not found then raise exception 'Conflict' using errcode='40001'; end if;
  select * into opp from public.opportunities where id=q.opportunity_id for share;
  if opp.sales_owner_id<>auth.uid() and not can_manage_all then raise exception 'Forbidden' using errcode='42501'; end if;
  insert into public.contracts(customer_id,opportunity_id,quotation_revision_id,contract_name,purchase_order_number,
   contract_date,start_date,end_date,supply_amount,vat_rate,payment_terms,warranty_terms,note,created_by,updated_by)
  values(q.customer_id,q.opportunity_id,qr.id,trim(p_payload->>'contract_name'),
   coalesce(trim(p_payload->>'purchase_order_number'),''),(p_payload->>'contract_date')::date,
   (p_payload->>'start_date')::date,(p_payload->>'end_date')::date,
   coalesce((p_payload->>'supply_amount')::numeric,qr.supply_amount),
   coalesce((p_payload->>'vat_rate')::numeric,qr.vat_rate),coalesce(trim(p_payload->>'payment_terms'),''),
   coalesce(trim(p_payload->>'warranty_terms'),''),coalesce(trim(p_payload->>'note'),''),auth.uid(),auth.uid())
  returning * into c;
  insert into public.contract_amendments(contract_id,amendment_no,reason,snapshot,created_by)
   values(c.id,0,'최초 계약',to_jsonb(c)-'approval_subject_id',auth.uid());
  output:=jsonb_build_object('id',c.id,'message','승인 견적에서 계약 초안을 만들었습니다.','redirect','/contracts/'||c.id::text);

 elsif p_action='contract.save' then
  perform private.require_permission('CONTRACT_MANAGE');
  select * into c from public.contracts where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if not can_manage_all and not exists(select 1 from public.opportunities o where o.id=c.opportunity_id and o.sales_owner_id=auth.uid()) then
   raise exception 'Forbidden' using errcode='42501';
  end if;
  if c.status not in ('DRAFT','REJECTED') or c.version is distinct from (p_payload->>'version')::integer then
   raise exception 'Conflict' using errcode='40001';
  end if;
  insert into public.contract_amendments(contract_id,amendment_no,reason,snapshot,created_by)
   values(c.id,c.current_amendment_no+1,coalesce(nullif(trim(p_payload->>'change_reason'),''),'계약 초안 수정'),
    to_jsonb(c)-'approval_subject_id',auth.uid());
  update public.contracts set contract_name=trim(p_payload->>'contract_name'),
   purchase_order_number=coalesce(trim(p_payload->>'purchase_order_number'),''),
   contract_date=(p_payload->>'contract_date')::date,start_date=(p_payload->>'start_date')::date,
   end_date=(p_payload->>'end_date')::date,supply_amount=(p_payload->>'supply_amount')::numeric,
   vat_rate=(p_payload->>'vat_rate')::numeric,payment_terms=coalesce(trim(p_payload->>'payment_terms'),''),
   warranty_terms=coalesce(trim(p_payload->>'warranty_terms'),''),note=coalesce(trim(p_payload->>'note'),''),
   status='DRAFT',current_amendment_no=current_amendment_no+1,updated_by=auth.uid() where id=c.id;
  output:=jsonb_build_object('id',c.id,'message','계약 초안을 저장했습니다.');

 elsif p_action='contract.submit' then
  perform private.require_permission('CONTRACT_MANAGE');
  select * into c from public.contracts where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if not can_manage_all and not exists(select 1 from public.opportunities o where o.id=c.opportunity_id and o.sales_owner_id=auth.uid()) then
   raise exception 'Forbidden' using errcode='42501';
  end if;
  if c.status not in ('DRAFT','REJECTED') or c.version is distinct from (p_payload->>'version')::integer then
   raise exception 'Conflict' using errcode='40001';
  end if;
  select e.id into approver from public.employees e
   where e.user_status='ACTIVE' and e.id<>auth.uid() and private.user_has_permission(e.id,'CONTRACT_APPROVE')
   order by e.created_at,e.id limit 1;
  if approver is null then raise exception 'NotFound' using errcode='P0002'; end if;
  insert into public.approval_subjects(request_type,reference_id) values('CONTRACT',c.id) returning id into subject_id;
  insert into public.approval_requests(approval_subject_id,request_type,reference_id,requester_id,route_snapshot)
   values(subject_id,'CONTRACT',c.id,auth.uid(),jsonb_build_array(jsonb_build_object(
    'step_order',1,'approver_type','ROLE_FALLBACK','approver_id',approver))) returning id into approval_id;
  insert into public.approval_request_steps(approval_request_id,step_order,approver_type,approver_id)
   values(approval_id,1,'ROLE_FALLBACK',approver);
  update public.contracts set status='SUBMITTED',approval_subject_id=subject_id,updated_by=auth.uid() where id=c.id;
  perform private.enqueue_notification(approver,'CONTRACT_APPROVAL_REQUEST','계약 승인 요청',
   c.contract_number||' 계약의 승인을 요청했습니다.','APPROVAL_REQUEST',approval_id,
   'contract:'||c.id||':approval','contract-approval-request');
  output:=jsonb_build_object('id',c.id,'approval_request_id',approval_id,'message','계약 승인을 요청했습니다.');

 elsif p_action='approval.decide' then
  perform private.require_permission('CONTRACT_APPROVE');
  decision:=p_payload->>'decision';
  select * into approval_row from public.approval_requests where id=target for update;
  if not found or approval_row.request_type<>'CONTRACT' then raise exception 'NotFound' using errcode='P0002'; end if;
  if approval_row.status<>'PENDING' or approval_row.version is distinct from (p_payload->>'version')::integer then
   raise exception 'Conflict' using errcode='40001';
  end if;
  select * into step_row from public.approval_request_steps
   where approval_request_id=approval_row.id and step_order=approval_row.current_step_order for update;
  if step_row.approver_id<>auth.uid() or step_row.status<>'PENDING' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into c from public.contracts where id=approval_row.reference_id for update;
  if not found or c.status<>'SUBMITTED' then raise exception 'Conflict' using errcode='40001'; end if;
  if decision='APPROVED' then
   update public.approval_request_steps set status='APPROVED',approved_at=now(),comment=nullif(trim(p_payload->>'comment'),'') where id=step_row.id;
   update public.approval_requests set status='APPROVED',version=version+1 where id=approval_row.id;
   update public.contracts set status='APPROVED',updated_by=auth.uid() where id=c.id;
   perform private.enqueue_notification(approval_row.requester_id,'CONTRACT_APPROVED','계약 승인 완료',
    c.contract_number||' 계약이 승인되었습니다.','CONTRACT',c.id,'contract:'||c.id||':approved','contract-approved');
   output:=jsonb_build_object('id',approval_row.id,'message','계약을 승인했습니다.');
  elsif decision='REJECTED' then
   update public.approval_request_steps set status='REJECTED',approved_at=now(),comment=nullif(trim(p_payload->>'comment'),'') where id=step_row.id;
   update public.approval_requests set status='REJECTED',version=version+1 where id=approval_row.id;
   update public.contracts set status='REJECTED',updated_by=auth.uid() where id=c.id;
   perform private.enqueue_notification(approval_row.requester_id,'CONTRACT_REJECTED','계약 승인 반려',
    c.contract_number||' 계약이 반려되었습니다.','CONTRACT',c.id,'contract:'||c.id||':rejected','contract-rejected');
   output:=jsonb_build_object('id',approval_row.id,'message','계약을 반려했습니다.');
  else
   raise exception 'ValidationError' using errcode='22023';
  end if;

 elsif p_action='contract.sign' then
  perform private.require_permission('CONTRACT_MANAGE');
  select * into c from public.contracts where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if not can_manage_all and not exists(select 1 from public.opportunities o where o.id=c.opportunity_id and o.sales_owner_id=auth.uid()) then
   raise exception 'Forbidden' using errcode='42501';
  end if;
  if c.status<>'APPROVED' or c.version is distinct from (p_payload->>'version')::integer then
   raise exception 'Conflict' using errcode='40001';
  end if;
  update public.contracts set status='SIGNED',signed_date=(p_payload->>'signed_date')::date,updated_by=auth.uid() where id=c.id;
  output:=jsonb_build_object('id',c.id,'message','계약 서명을 확정했습니다.');

 elsif p_action='contract.create_project' then
  perform private.require_permission('CONTRACT_MANAGE');
  select * into c from public.contracts where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if not can_manage_all and not exists(select 1 from public.opportunities o where o.id=c.opportunity_id and o.sales_owner_id=auth.uid()) then
   raise exception 'Forbidden' using errcode='42501';
  end if;
  if c.status not in ('SIGNED','ACTIVE') then raise exception 'Conflict' using errcode='40001'; end if;
  select id into project_id from public.projects where contract_id=c.id;
  if project_id is null then
   manager_id:=(p_payload->>'project_manager_id')::uuid;
   if not exists(select 1 from public.employees where id=manager_id and user_status='ACTIVE') then
    raise exception 'NotFound' using errcode='P0002';
   end if;
   select * into customer from public.customers where id=c.customer_id;
   select * into opp from public.opportunities where id=c.opportunity_id;
   insert into public.projects(project_code,project_name,customer_name,customer_id,description,planned_start_date,
    planned_end_date,status,project_manager_id,created_by,contract_id,opportunity_id,quotation_revision_id,sales_owner_id)
   values(upper(trim(p_payload->>'project_code')),c.contract_name,customer.name,c.customer_id,
    nullif(trim(p_payload->>'description'),''),c.start_date,c.end_date,'PLANNING',manager_id,auth.uid(),
    c.id,c.opportunity_id,c.quotation_revision_id,opp.sales_owner_id) returning id into project_id;
   update public.contracts set status='ACTIVE',updated_by=auth.uid() where id=c.id;
  end if;
  output:=jsonb_build_object('id',c.id,'project_id',project_id,'message','계약에서 프로젝트를 생성했습니다.',
   'redirect','/admin/projects/'||project_id::text);
 else
  raise exception 'ValidationError' using errcode='22023';
 end if;

 insert into public.contract_command_receipts(actor_user_id,request_id,action,payload_hash,result)
 values(auth.uid(),p_request_id,p_action,content_hash,output);
 return output;
end;
$$;

create function public.contract_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language sql volatile security definer set search_path='' as $$
 select private.contract_command(p_action,p_payload,p_request_id);
$$;

revoke execute on function private.contract_command(text,jsonb,text) from public,anon,authenticated;
revoke execute on function public.contract_command(text,jsonb,text) from public,anon;
grant execute on function public.contract_command(text,jsonb,text) to authenticated;

commit;
