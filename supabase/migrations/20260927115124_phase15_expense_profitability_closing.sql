begin;

insert into public.permissions(code,description) values
 ('EXPENSE_MASTER_MANAGE','비용 유형 및 거래처 관리'),
 ('PROJECT_FINANCE_READ','담당 프로젝트 손익 조회'),
 ('PROJECT_FINANCE_READ_ALL','전체 프로젝트 손익 조회'),
 ('PROJECT_CLOSE','담당 프로젝트 마감'),
 ('PROJECT_REOPEN','프로젝트 마감 재개방')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (r.code='ADMIN' and p.code in ('EXPENSE_MASTER_MANAGE','PROJECT_FINANCE_READ','PROJECT_FINANCE_READ_ALL','PROJECT_CLOSE','PROJECT_REOPEN'))
 or (r.code='FINANCE_MANAGER' and p.code in ('EXPENSE_MASTER_MANAGE','PROJECT_FINANCE_READ_ALL','PROJECT_CLOSE','PROJECT_REOPEN'))
 or (r.code='PROJECT_MANAGER' and p.code in ('PROJECT_FINANCE_READ','PROJECT_CLOSE'))
 or (r.code='SALES' and p.code='PROJECT_FINANCE_READ')
on conflict do nothing;

create table public.expense_types (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check(code ~ '^[A-Z][A-Z0-9_]{1,39}$'),
 name text not null check(length(trim(name)) between 1 and 100),
 account_code text not null default '' check(length(account_code)<=30),
 vat_deductible boolean not null default true,
 active boolean not null default true,
 sort_order integer not null default 100 check(sort_order>=0),
 note text not null default '' check(length(note)<=1000),
 created_by uuid references public.employees(id) on delete restrict,
 updated_by uuid references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create sequence public.vendor_number_seq;
create table public.vendors (
 id uuid primary key default gen_random_uuid(),
 vendor_code text not null unique default ('V-'||lpad(nextval('public.vendor_number_seq')::text,6,'0')),
 name text not null check(length(trim(name)) between 1 and 160),
 business_registration_number text check(business_registration_number is null or business_registration_number ~ '^[0-9]{10}$'),
 representative_name text not null default '' check(length(representative_name)<=100),
 address text not null default '' check(length(address)<=500),
 business_type text not null default '' check(length(business_type)<=120),
 business_item text not null default '' check(length(business_item)<=120),
 contact_name text not null default '' check(length(contact_name)<=100),
 contact_email text check(contact_email is null or contact_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
 contact_phone text not null default '' check(length(contact_phone)<=50),
 status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE','ARCHIVED')),
 note text not null default '' check(length(note)<=2000),
 created_by uuid not null references public.employees(id) on delete restrict,
 updated_by uuid not null references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter sequence public.vendor_number_seq owned by public.vendors.vendor_code;
create unique index vendors_registration_unique on public.vendors(business_registration_number) where business_registration_number is not null;
create index vendors_status_name on public.vendors(status,name);

insert into public.expense_types(code,name,account_code,vat_deductible,sort_order) values
 ('TRANSPORT','교통비','811',true,10),
 ('MEAL','식비','812',true,20),
 ('MEETING','회의비','813',true,30),
 ('SUPPLIES','소모품비','814',true,40),
 ('ACCOMMODATION','숙박비','815',true,50),
 ('ENTERTAINMENT','접대비','816',false,60),
 ('SOFTWARE','소프트웨어·클라우드','817',true,70),
 ('OUTSOURCE','외주용역비','818',true,80),
 ('PURCHASE','구매비','819',true,90),
 ('COMMUNICATION','통신비','820',true,100),
 ('TAX_FEE','세금·수수료','821',false,110),
 ('ETC','기타','899',false,999)
on conflict(code) do update set name=excluded.name,account_code=excluded.account_code,
 vat_deductible=excluded.vat_deductible,sort_order=excluded.sort_order;

alter table public.expenses
 alter column corporate_card_id drop not null,
 add column expense_type_id uuid references public.expense_types(id) on delete restrict,
 add column vat_deductible_snapshot boolean not null default false,
 add column vendor_id uuid references public.vendors(id) on delete restrict,
 add column source_type text not null default 'CARD' check(source_type in ('CARD','CASH','TRANSFER','INVOICE','OTHER')),
 add column approval_status text not null default 'DRAFT' check(approval_status in ('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELED')),
 add column submitted_at timestamptz,
 add column reviewed_at timestamptz,
 add column reviewed_by uuid references public.employees(id) on delete restrict,
 add column rejection_reason text not null default '' check(length(rejection_reason)<=1000),
 add column paid_at timestamptz,
 add column payment_reference text not null default '' check(length(payment_reference)<=200),
 add constraint expenses_source_card_consistency check((source_type='CARD')=(corporate_card_id is not null)),
 add constraint expenses_approval_timestamps check(
  (approval_status in ('SUBMITTED','APPROVED','REJECTED') or submitted_at is null)
  and (approval_status in ('APPROVED','REJECTED') or reviewed_at is null)
 );

update public.expenses e set
 expense_type_id=t.id,
 approval_status='APPROVED',
 submitted_at=e.created_at,
 reviewed_at=e.created_at,
 reviewed_by=e.user_id,
 paid_at=e.transaction_date::timestamptz
from public.expense_types t where t.code=e.category;
update public.expenses e set vat_deductible_snapshot=t.vat_deductible
from public.expense_types t where t.id=e.expense_type_id;

alter table public.expenses drop constraint expenses_category_check;
alter table public.expenses add constraint expenses_category_check check(category in (
 'TRANSPORT','MEAL','MEETING','SUPPLIES','ACCOMMODATION','ENTERTAINMENT',
 'SOFTWARE','OUTSOURCE','PURCHASE','COMMUNICATION','TAX_FEE','ETC'
));
create index expenses_type_date on public.expenses(expense_type_id,transaction_date desc) where deleted_at is null;
create index expenses_vendor_date on public.expenses(vendor_id,transaction_date desc) where vendor_id is not null and deleted_at is null;
create index expenses_approval_status on public.expenses(approval_status,transaction_date desc) where deleted_at is null;

alter table public.projects
 add column closed_at timestamptz,
 add column closed_by uuid references public.employees(id) on delete restrict,
 add column closing_snapshot jsonb,
 add constraint projects_closing_consistency check((closed_at is null)=(closed_by is null) and (closed_at is null)=(closing_snapshot is null));

create table public.project_closings (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete restrict,
 closing_no integer not null check(closing_no>0),
 as_of_date date not null,
 status text not null default 'CLOSED' check(status in ('CLOSED','REOPENED')),
 checklist_snapshot jsonb not null,
 financial_snapshot jsonb not null,
 approval_request_id uuid references public.approval_requests(id) on delete restrict,
 note text not null default '' check(length(note)<=2000),
 closed_by uuid not null references public.employees(id) on delete restrict,
 closed_at timestamptz not null default now(),
 reopened_by uuid references public.employees(id) on delete restrict,
 reopened_at timestamptz,
 reopen_reason text not null default '' check(length(reopen_reason)<=1000),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(project_id,closing_no),
 check((status='REOPENED')=(reopened_at is not null and reopened_by is not null))
);
create unique index project_closings_current on public.project_closings(project_id) where status='CLOSED';
create index project_closings_project_history on public.project_closings(project_id,closing_no desc);

create table public.expense_finance_command_receipts (
 actor_user_id uuid not null references public.employees(id) on delete restrict,
 request_id text not null check(length(request_id) between 16 and 100),
 action text not null,
 payload_hash text not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(actor_user_id,request_id)
);

create trigger touch_expense_types before update on public.expense_types for each row execute function private.touch_versioned_row();
create trigger touch_vendors before update on public.vendors for each row execute function private.touch_versioned_row();
create trigger touch_project_closings before update on public.project_closings for each row execute function private.touch_versioned_row();
create trigger audit_expense_types after insert or update on public.expense_types for each row execute function private.capture_audit();
create trigger audit_vendors after insert or update on public.vendors for each row execute function private.capture_audit();
create trigger audit_project_closings after insert or update on public.project_closings for each row execute function private.capture_audit();

create function private.can_read_project_finance(p_project_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(
  select 1 from public.projects p where p.id=p_project_id and (
   private.has_permission('PROJECT_FINANCE_READ_ALL') or
   (private.has_permission('PROJECT_FINANCE_READ') and (
    p.project_manager_id=auth.uid() or p.sales_owner_id=auth.uid() or exists(
     select 1 from public.project_assignments a where a.project_id=p.id and a.user_id=auth.uid()
    )
   ))
  )
 );
$$;

create function private.assert_project_finance_open(p_project_id uuid)
returns void language plpgsql stable security definer set search_path='' as $$
begin
 if p_project_id is not null and exists(select 1 from public.projects p where p.id=p_project_id and p.closed_at is not null) then
  raise exception 'Project is closed. Reopen it before changing work or finance data.' using errcode='40001';
 end if;
end;
$$;

create or replace function private.validate_expense() returns trigger language plpgsql security definer set search_path='' as $$
declare new_month date:=date_trunc('month',new.transaction_date)::date;
declare old_month date;
begin
 perform private.assert_project_finance_open(new.project_id);
 if tg_op='UPDATE' then old_month:=date_trunc('month',old.transaction_date)::date; end if;
 if new.source_type='CARD' then
  if new.corporate_card_id is null or not exists(
   select 1 from public.project_card_assignments a where a.project_id=new.project_id and a.corporate_card_id=new.corporate_card_id
    and new.transaction_date>=a.assigned_from and (a.assigned_to is null or new.transaction_date<=a.assigned_to)
  ) then raise exception 'Card is not assigned to this project on transaction date' using errcode='22023'; end if;
  if old_month is not null and old_month<new_month then
   perform pg_advisory_xact_lock(hashtextextended('corporate-card-settlement:'||old_month::text,0));
   perform pg_advisory_xact_lock(hashtextextended('corporate-card-settlement:'||new_month::text,0));
  else
   perform pg_advisory_xact_lock(hashtextextended('corporate-card-settlement:'||new_month::text,0));
   if old_month is not null and old_month<>new_month then
    perform pg_advisory_xact_lock(hashtextextended('corporate-card-settlement:'||old_month::text,0));
   end if;
  end if;
  if exists(select 1 from public.monthly_card_reports r where r.settlement_month=new_month and r.status in ('CLOSED','SENT')) then
   raise exception 'Settlement month is closed' using errcode='40001';
  end if;
  if old_month is not null and old_month<>new_month and exists(
   select 1 from public.monthly_card_reports r where r.settlement_month=old_month and r.status in ('CLOSED','SENT')
  ) then raise exception 'Settlement month is closed' using errcode='40001'; end if;
 end if;
 return new;
end;
$$;

create function private.guard_direct_project_mutation()
returns trigger language plpgsql security definer set search_path='' as $$
declare project_ref uuid;
begin
 project_ref:=case when tg_op='DELETE' then old.project_id else new.project_id end;
 perform private.assert_project_finance_open(project_ref);
 return case when tg_op='DELETE' then old else new end;
end;
$$;
create trigger guard_work_log_project_closing before insert or update or delete on public.daily_work_logs
 for each row execute function private.guard_direct_project_mutation();
create trigger guard_billing_schedule_project_closing before insert or update or delete on public.billing_schedules
 for each row execute function private.guard_direct_project_mutation();
create trigger guard_billing_project_closing before insert or update or delete on public.billings
 for each row execute function private.guard_direct_project_mutation();
create function private.guard_payment_project_mutation()
returns trigger language plpgsql security definer set search_path='' as $$
declare payment_ref uuid; project_ref uuid;
begin
 payment_ref:=case when tg_op='INSERT' then new.id else old.id end;
 project_ref:=case when tg_op='DELETE' then old.project_id else new.project_id end;
 perform private.assert_project_finance_open(project_ref);
 for project_ref in
  select distinct b.project_id from public.payment_allocations a join public.billings b on b.id=a.billing_id
  where a.payment_id=payment_ref
 loop perform private.assert_project_finance_open(project_ref); end loop;
 return case when tg_op='DELETE' then old else new end;
end;
$$;
create trigger guard_payment_project_closing before insert or update or delete on public.payments
 for each row execute function private.guard_payment_project_mutation();

create function private.guard_tax_invoice_project_mutation()
returns trigger language plpgsql security definer set search_path='' as $$
declare billing_ref uuid; project_ref uuid;
begin
 billing_ref:=case when tg_op='DELETE' then old.billing_id else new.billing_id end;
 select b.project_id into project_ref from public.billings b where b.id=billing_ref;
 perform private.assert_project_finance_open(project_ref);
 return case when tg_op='DELETE' then old else new end;
end;
$$;
create trigger guard_tax_invoice_project_closing before insert or update or delete on public.tax_invoices
 for each row execute function private.guard_tax_invoice_project_mutation();

create function private.guard_payment_allocation_project_mutation()
returns trigger language plpgsql security definer set search_path='' as $$
declare billing_ref uuid; project_ref uuid;
begin
 billing_ref:=case when tg_op='DELETE' then old.billing_id else new.billing_id end;
 select b.project_id into project_ref from public.billings b where b.id=billing_ref;
 perform private.assert_project_finance_open(project_ref);
 return case when tg_op='DELETE' then old else new end;
end;
$$;
create trigger guard_payment_allocation_project_closing before insert or update or delete on public.payment_allocations
 for each row execute function private.guard_payment_allocation_project_mutation();

create function private.guard_closed_project_row()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.closed_at is not null and coalesce(current_setting('app.project_closing_command',true),'')<>'on' then
  raise exception 'Project is closed. Use the reopen command first.' using errcode='40001';
 end if;
 return new;
end;
$$;
create trigger guard_closed_project_row before update on public.projects for each row execute function private.guard_closed_project_row();

create function private.project_financial_summary_data(p_project_id uuid,p_as_of date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 select jsonb_build_object(
  'project_id',p.id,'project_code',p.project_code,'project_name',p.project_name,
  'customer_name',p.customer_name,'status',p.status,'as_of_date',p_as_of,
  'closed_at',p.closed_at,
  'contract_supply_amount',coalesce(c.supply_amount,0),
  'contract_vat_amount',coalesce(c.vat_amount,0),
  'contract_total_amount',coalesce(c.total_amount,0),
  'billed_supply_amount',coalesce(finance.billed_supply,0),
  'billed_total_amount',coalesce(finance.billed_total,0),
  'tax_issued_total_amount',coalesce(finance.tax_issued_total,0),
  'received_amount',coalesce(finance.received_total,0),
  'outstanding_amount',greatest(coalesce(finance.billed_total,0)-coalesce(finance.received_total,0),0),
  'planned_labor_cost',coalesce(labor.planned_cost,0),
  'actual_work_minutes',coalesce(labor.actual_minutes,0),
  'labor_cost',coalesce(labor.actual_cost,0),
  'expense_recorded_total',coalesce(expense.recorded_total,0),
  'expense_cost',coalesce(expense.expense_cost,0),
  'total_cost',coalesce(labor.actual_cost,0)+coalesce(expense.expense_cost,0),
  'gross_profit',coalesce(c.supply_amount,0)-coalesce(labor.actual_cost,0)-coalesce(expense.expense_cost,0),
  'profit_margin',case when coalesce(c.supply_amount,0)>0 then round(
   (coalesce(c.supply_amount,0)-coalesce(labor.actual_cost,0)-coalesce(expense.expense_cost,0))*100/c.supply_amount,2
  ) else null end,
  'forecast_total_cost',coalesce(labor.planned_cost,0)+coalesce(expense.expense_cost,0),
  'forecast_gross_profit',coalesce(c.supply_amount,0)-coalesce(labor.planned_cost,0)-coalesce(expense.expense_cost,0),
  'expense_by_type','{}'::jsonb
 ) into result
 from public.projects p
 left join public.contracts c on c.id=p.contract_id and c.status not in ('CANCELED','TERMINATED')
 left join lateral (
  select
   coalesce(sum(b.supply_amount) filter(where b.status<>'CANCELED' and b.billing_date<=p_as_of),0) billed_supply,
   coalesce(sum(b.total_amount) filter(where b.status<>'CANCELED' and b.billing_date<=p_as_of),0) billed_total,
   coalesce((select sum(t.total_amount) from public.tax_invoices t join public.billings tb on tb.id=t.billing_id
    where tb.project_id=p.id and t.status='ISSUED' and t.issue_date<=p_as_of),0) tax_issued_total,
   coalesce((select sum(a.amount) from public.payment_allocations a
    join public.payments pay on pay.id=a.payment_id and pay.status='CONFIRMED' and pay.received_date<=p_as_of
    join public.billings ab on ab.id=a.billing_id where ab.project_id=p.id and ab.status<>'CANCELED'),0) received_total
  from public.billings b where b.project_id=p.id
 ) finance on true
 left join lateral (
  select
   coalesce((select sum(coalesce(latest.planned_mm,a.planned_mm,0)*coalesce(latest.monthly_cost_rate,0))
    from public.project_assignments a left join lateral (
     select r.planned_mm,r.monthly_cost_rate from public.project_assignment_rates r
     where r.assignment_id=a.id order by r.snapshot_no desc limit 1
    ) latest on true where a.project_id=p.id and a.status<>'CANCELED'),0) planned_cost,
   coalesce(sum(l.work_minutes),0) actual_minutes,
   coalesce(sum(round((l.work_minutes::numeric/9600)*coalesce(rate.monthly_cost_rate,employee_rate.monthly_cost_rate,0),2)),0) actual_cost
  from public.daily_work_logs l
  left join lateral (
   select r.monthly_cost_rate from public.project_assignments a
   join public.project_assignment_rates r on r.assignment_id=a.id
   where a.project_id=p.id and a.user_id=l.user_id and r.created_at::date<=l.work_date
   order by r.created_at desc,r.snapshot_no desc limit 1
  ) rate on true
  left join lateral (
   select r.monthly_cost_rate from public.employee_cost_rates r where r.user_id=l.user_id
    and l.work_date>=r.effective_from and (r.effective_to is null or l.work_date<=r.effective_to)
   order by r.effective_from desc limit 1
  ) employee_rate on true
  where l.project_id=p.id and l.deleted_at is null and l.work_date<=p_as_of
 ) labor on true
 left join lateral (
  select coalesce(sum(e.total_amount),0) recorded_total,
   coalesce(sum(e.supply_amount+case when e.vat_deductible_snapshot then 0 else e.vat_amount end),0) expense_cost
  from public.expenses e
  left join public.expense_types t on t.id=e.expense_type_id
  where e.project_id=p.id and e.deleted_at is null and e.approval_status='APPROVED' and e.transaction_date<=p_as_of
 ) expense on true
 where p.id=p_project_id;
 if result is null then raise exception 'NotFound' using errcode='P0002'; end if;

 -- Build the expense type map separately. The scalar totals above intentionally use one row per expense.
 result:=jsonb_set(result,'{expense_by_type}',coalesce((
  select jsonb_object_agg(type_name,type_cost) from (
   select coalesce(t.name,e.category) type_name,
    sum(e.supply_amount+case when e.vat_deductible_snapshot then 0 else e.vat_amount end) type_cost
   from public.expenses e left join public.expense_types t on t.id=e.expense_type_id
   where e.project_id=p_project_id and e.deleted_at is null and e.approval_status='APPROVED' and e.transaction_date<=p_as_of
   group by coalesce(t.name,e.category)
  ) grouped
 ),'{}'::jsonb));
 return result;
end;
$$;

create function private.project_closing_check_data(p_project_id uuid,p_as_of date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare checks jsonb; summary jsonb; can_close boolean;
begin
 summary:=private.project_financial_summary_data(p_project_id,p_as_of);
 select jsonb_build_array(
  jsonb_build_object('code','PROJECT_STATE','label','프로젝트 수행 상태','passed',p.status in ('IN_PROGRESS','ON_HOLD','COMPLETED'),
   'detail',case when p.status in ('IN_PROGRESS','ON_HOLD','COMPLETED') then '마감 가능한 수행 상태입니다.' else '진행 중 또는 보류 상태에서 마감할 수 있습니다.' end),
  jsonb_build_object('code','CONTRACT_LINKED','label','유효 계약 연결','passed',p.contract_id is not null and c.status in ('SIGNED','ACTIVE','COMPLETED'),
   'detail',case when p.contract_id is null then '프로젝트에 계약이 연결되지 않았습니다.' else '계약 상태: '||coalesce(c.status,'없음') end),
  jsonb_build_object('code','INSPECTION_COMPLETE','label','검수 완료','passed',exists(
   select 1 from public.inspections i where i.project_id=p.id and i.status='COMPLETED' and i.result in ('PASSED','WAIVED')),
   'detail','완료 및 합격(또는 면제)된 검수가 1건 이상 필요합니다.'),
  jsonb_build_object('code','BILLING_PLAN_COMPLETE','label','청구 계획 처리 완료','passed',
   exists(select 1 from public.billing_schedules s where s.project_id=p.id) and not exists(
    select 1 from public.billing_schedules s where s.project_id=p.id and s.status in ('SCHEDULED','READY')),
   'detail','모든 청구 일정이 청구 생성 또는 취소 상태여야 합니다.'),
  jsonb_build_object('code','BILLING_CONFIRMED','label','청구 확정','passed',not exists(
   select 1 from public.billings b where b.project_id=p.id and b.status='DRAFT'),
   'detail','초안 상태 청구서가 없어야 합니다.'),
  jsonb_build_object('code','TAX_POLICY','label','세금계산서 발급 완료','passed',not exists(
   select 1 from public.billings b where b.project_id=p.id and b.status not in ('DRAFT','CANCELED') and not exists(
    select 1 from public.tax_invoices t where t.billing_id=b.id and t.status='ISSUED')),
   'detail','확정된 모든 청구서에 전자발급 완료 세금계산서가 필요합니다.'),
  jsonb_build_object('code','OUTSTANDING_ZERO','label','미수금 0원','passed',(summary->>'outstanding_amount')::numeric=0,
   'detail','현재 미수금 '||to_char((summary->>'outstanding_amount')::numeric,'FM999,999,999,999,990')||'원'),
  jsonb_build_object('code','EXPENSES_CLOSED','label','비용 승인·지급 완료','passed',not exists(
   select 1 from public.expenses e where e.project_id=p.id and e.deleted_at is null and (e.approval_status<>'APPROVED' or e.paid_at is null)),
   'detail','취소되지 않은 모든 비용은 승인 및 지급 처리가 필요합니다.'),
  jsonb_build_object('code','WORK_CLOSED','label','공수 입력 완료','passed',not exists(
   select 1 from public.daily_work_logs l where l.project_id=p.id and l.deleted_at is null and l.status<>'DONE') and not exists(
   select 1 from public.project_assignments a where a.project_id=p.id and a.status not in ('ENDED','CANCELED')),
   'detail','미완료 업무일지와 진행 중 투입 이력이 없어야 합니다.'),
  jsonb_build_object('code','REQUIRED_DOCUMENTS','label','필수 문서 등록','passed',
   exists(select 1 from public.project_document_links l join public.documents d on d.id=l.document_id
    where l.project_id=p.id and d.archived_at is null and d.category in ('DELIVERABLE','COMPLETION_REPORT'))
   and exists(select 1 from public.project_document_links l join public.documents d on d.id=l.document_id
    where l.project_id=p.id and d.archived_at is null and d.category='INSPECTION'),
   'detail','산출물/완료보고서와 검수 문서가 각각 1건 이상 필요합니다.')
 ) into checks
 from public.projects p left join public.contracts c on c.id=p.contract_id where p.id=p_project_id;
 if checks is null then raise exception 'NotFound' using errcode='P0002'; end if;
 select bool_and((item->>'passed')::boolean) into can_close from jsonb_array_elements(checks) item;
 return jsonb_build_object('project_id',p_project_id,'as_of_date',p_as_of,'can_close',coalesce(can_close,false),'checks',checks,'financial_summary',summary);
end;
$$;

create function public.project_financial_summary(p_project_id uuid,p_as_of date default current_date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='28000'; end if;
 if not private.can_read_project_finance(p_project_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 return private.project_financial_summary_data(p_project_id,p_as_of);
end;
$$;

create function public.project_financial_portfolio(p_as_of date default current_date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare output jsonb;
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='28000'; end if;
 if not (private.has_permission('PROJECT_FINANCE_READ') or private.has_permission('PROJECT_FINANCE_READ_ALL')) then
  raise exception 'Forbidden' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(private.project_financial_summary_data(p.id,p_as_of) order by p.project_code),'[]'::jsonb) into output
 from public.projects p where p.archived_at is null and private.can_read_project_finance(p.id);
 return output;
end;
$$;

create function public.project_closing_check(p_project_id uuid,p_as_of date default current_date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='28000'; end if;
 if not private.can_read_project_finance(p_project_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 return private.project_closing_check_data(p_project_id,p_as_of);
end;
$$;

create function private.expense_finance_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 target uuid:=nullif(p_payload->>'id','')::uuid;
 target_project uuid:=nullif(p_payload->>'project_id','')::uuid;
 expense_row public.expenses;
 vendor_row public.vendors;
 type_row public.expense_types;
 project_row public.projects;
 closing_row public.project_closings;
 existing_hash text;
 content_hash text;
 output jsonb;
 check_result jsonb;
 finance_result jsonb;
 closing_number integer;
 source_value text;
 type_code text;
 type_vat_deductible boolean;
 card_ref uuid;
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='28000'; end if;
 if p_request_id is null or length(p_request_id) not between 16 and 100 then raise exception 'ValidationError' using errcode='22023'; end if;
 perform set_config('app.request_id',p_request_id,true);
 content_hash:=encode(extensions.digest(convert_to(p_action||':'||p_payload::text,'UTF8'),'sha256'),'hex');
 select payload_hash,result into existing_hash,output from public.expense_finance_command_receipts
  where actor_user_id=auth.uid() and request_id=p_request_id;
 if found then
  if existing_hash<>content_hash then raise exception 'Conflict' using errcode='40001'; end if;
  return output;
 end if;

 if p_action='expense_type.save' then
  perform private.require_permission('EXPENSE_MASTER_MANAGE');
  if target is null then
   insert into public.expense_types(code,name,account_code,vat_deductible,active,sort_order,note,created_by,updated_by)
   values(upper(trim(p_payload->>'code')),trim(p_payload->>'name'),coalesce(trim(p_payload->>'account_code'),''),
    coalesce((p_payload->>'vat_deductible')::boolean,true),coalesce((p_payload->>'active')::boolean,true),
    coalesce((p_payload->>'sort_order')::integer,100),coalesce(trim(p_payload->>'note'),''),auth.uid(),auth.uid()) returning id into target;
  else
   select * into type_row from public.expense_types where id=target for update;
   if not found then raise exception 'NotFound' using errcode='P0002'; end if;
   if type_row.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   update public.expense_types set name=trim(p_payload->>'name'),account_code=coalesce(trim(p_payload->>'account_code'),''),
    vat_deductible=coalesce((p_payload->>'vat_deductible')::boolean,true),active=coalesce((p_payload->>'active')::boolean,true),
    sort_order=coalesce((p_payload->>'sort_order')::integer,100),note=coalesce(trim(p_payload->>'note'),''),updated_by=auth.uid()
   where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','비용 유형을 저장했습니다.');

 elsif p_action='vendor.save' then
  perform private.require_permission('EXPENSE_MASTER_MANAGE');
  if target is null then
   insert into public.vendors(name,business_registration_number,representative_name,address,business_type,business_item,
    contact_name,contact_email,contact_phone,status,note,created_by,updated_by)
   values(trim(p_payload->>'name'),nullif(regexp_replace(coalesce(p_payload->>'business_registration_number',''),'[^0-9]','','g'),''),
    coalesce(trim(p_payload->>'representative_name'),''),coalesce(trim(p_payload->>'address'),''),coalesce(trim(p_payload->>'business_type'),''),
    coalesce(trim(p_payload->>'business_item'),''),coalesce(trim(p_payload->>'contact_name'),''),nullif(trim(p_payload->>'contact_email'),''),
    coalesce(trim(p_payload->>'contact_phone'),''),coalesce(p_payload->>'status','ACTIVE'),coalesce(trim(p_payload->>'note'),''),auth.uid(),auth.uid())
   returning id into target;
  else
   select * into vendor_row from public.vendors where id=target for update;
   if not found then raise exception 'NotFound' using errcode='P0002'; end if;
   if vendor_row.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   update public.vendors set name=trim(p_payload->>'name'),
    business_registration_number=nullif(regexp_replace(coalesce(p_payload->>'business_registration_number',''),'[^0-9]','','g'),''),
    representative_name=coalesce(trim(p_payload->>'representative_name'),''),address=coalesce(trim(p_payload->>'address'),''),
    business_type=coalesce(trim(p_payload->>'business_type'),''),business_item=coalesce(trim(p_payload->>'business_item'),''),
    contact_name=coalesce(trim(p_payload->>'contact_name'),''),contact_email=nullif(trim(p_payload->>'contact_email'),''),
    contact_phone=coalesce(trim(p_payload->>'contact_phone'),''),status=coalesce(p_payload->>'status','ACTIVE'),
    note=coalesce(trim(p_payload->>'note'),''),updated_by=auth.uid() where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','거래처를 저장했습니다.');

 elsif p_action='expense.save' then
  if not (private.has_permission('EXPENSE_WRITE_SELF') or private.has_permission('EXPENSE_MANAGE')) then
   raise exception 'Forbidden' using errcode='42501';
  end if;
  source_value:=p_payload->>'source_type';
  card_ref:=nullif(p_payload->>'corporate_card_id','')::uuid;
  select code,vat_deductible into type_code,type_vat_deductible from public.expense_types where id=(p_payload->>'expense_type_id')::uuid and active;
  if type_code is null then raise exception 'NotFound' using errcode='P0002'; end if;
  if source_value='CARD' and card_ref is null or source_value<>'CARD' and card_ref is not null then
   raise exception 'ValidationError' using errcode='22023';
  end if;
  if not private.can_read_project(target_project) then raise exception 'Forbidden' using errcode='42501'; end if;
  if target is null then
   insert into public.expenses(transaction_date,project_id,corporate_card_id,user_id,merchant,purpose,category,
    expense_type_id,vat_deductible_snapshot,vendor_id,source_type,supply_amount,vat_amount,memo,approval_status)
   values((p_payload->>'transaction_date')::date,target_project,card_ref,auth.uid(),trim(p_payload->>'merchant'),trim(p_payload->>'purpose'),
    type_code,(p_payload->>'expense_type_id')::uuid,type_vat_deductible,nullif(p_payload->>'vendor_id','')::uuid,source_value,
    (p_payload->>'supply_amount')::numeric,(p_payload->>'vat_amount')::numeric,coalesce(trim(p_payload->>'memo'),''),'DRAFT') returning id into target;
  else
   select * into expense_row from public.expenses where id=target for update;
   if not found or expense_row.deleted_at is not null then raise exception 'NotFound' using errcode='P0002'; end if;
   if expense_row.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   if expense_row.user_id<>auth.uid() and not private.has_permission('EXPENSE_MANAGE') then raise exception 'Forbidden' using errcode='42501'; end if;
   if expense_row.approval_status not in ('DRAFT','REJECTED') then raise exception 'Only draft or rejected expenses can be edited' using errcode='40001'; end if;
   update public.expenses set transaction_date=(p_payload->>'transaction_date')::date,project_id=target_project,
    corporate_card_id=card_ref,merchant=trim(p_payload->>'merchant'),purpose=trim(p_payload->>'purpose'),category=type_code,
    expense_type_id=(p_payload->>'expense_type_id')::uuid,vat_deductible_snapshot=type_vat_deductible,vendor_id=nullif(p_payload->>'vendor_id','')::uuid,
    source_type=source_value,supply_amount=(p_payload->>'supply_amount')::numeric,vat_amount=(p_payload->>'vat_amount')::numeric,
    memo=coalesce(trim(p_payload->>'memo'),''),approval_status='DRAFT',submitted_at=null,reviewed_at=null,reviewed_by=null,rejection_reason='' where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','비용 내역을 저장했습니다.');

 elsif p_action in ('expense.submit','expense.approve','expense.reject','expense.mark_paid','expense.cancel') then
  select * into expense_row from public.expenses where id=target for update;
  if not found or expense_row.deleted_at is not null then raise exception 'NotFound' using errcode='P0002'; end if;
  if expense_row.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
  if p_action='expense.submit' then
   if expense_row.user_id<>auth.uid() and not private.has_permission('EXPENSE_MANAGE') then raise exception 'Forbidden' using errcode='42501'; end if;
   if expense_row.approval_status not in ('DRAFT','REJECTED') then raise exception 'Conflict' using errcode='40001'; end if;
   update public.expenses set approval_status='SUBMITTED',submitted_at=now(),reviewed_at=null,reviewed_by=null,rejection_reason='' where id=target;
   output:=jsonb_build_object('id',target,'message','비용 승인을 요청했습니다.');
  elsif p_action='expense.approve' then
   perform private.require_permission('EXPENSE_MANAGE');
   if expense_row.approval_status<>'SUBMITTED' then raise exception 'Conflict' using errcode='40001'; end if;
   update public.expenses set approval_status='APPROVED',reviewed_at=now(),reviewed_by=auth.uid(),rejection_reason='',
    paid_at=case when coalesce((p_payload->>'mark_paid')::boolean,false) then now() else paid_at end,
    payment_reference=case when coalesce((p_payload->>'mark_paid')::boolean,false) then coalesce(trim(p_payload->>'payment_reference'),'') else payment_reference end
   where id=target;
   output:=jsonb_build_object('id',target,'message','비용을 승인했습니다.');
  elsif p_action='expense.reject' then
   perform private.require_permission('EXPENSE_MANAGE');
   if expense_row.approval_status<>'SUBMITTED' then raise exception 'Conflict' using errcode='40001'; end if;
   update public.expenses set approval_status='REJECTED',reviewed_at=now(),reviewed_by=auth.uid(),
    rejection_reason=trim(p_payload->>'reason') where id=target;
   output:=jsonb_build_object('id',target,'message','비용을 반려했습니다.');
  elsif p_action='expense.mark_paid' then
   perform private.require_permission('EXPENSE_MANAGE');
   if expense_row.approval_status<>'APPROVED' or expense_row.paid_at is not null then raise exception 'Conflict' using errcode='40001'; end if;
   update public.expenses set paid_at=coalesce(nullif(p_payload->>'paid_at','')::timestamptz,now()),
    payment_reference=coalesce(trim(p_payload->>'payment_reference'),'') where id=target;
   output:=jsonb_build_object('id',target,'message','지급 완료로 처리했습니다.');
  else
   if expense_row.user_id<>auth.uid() and not private.has_permission('EXPENSE_MANAGE') then raise exception 'Forbidden' using errcode='42501'; end if;
   if expense_row.approval_status not in ('DRAFT','REJECTED') then raise exception 'Only draft or rejected expenses can be canceled' using errcode='40001'; end if;
   update public.expenses set approval_status='CANCELED',submitted_at=null,reviewed_at=null,reviewed_by=null,rejection_reason='',deleted_at=now() where id=target;
   output:=jsonb_build_object('id',target,'message','비용을 취소했습니다.');
  end if;

 elsif p_action='project.close' then
  perform private.require_permission('PROJECT_CLOSE');
  select * into project_row from public.projects where id=target_project for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if not (private.has_permission('PROJECT_FINANCE_READ_ALL') or project_row.project_manager_id=auth.uid()) then raise exception 'Forbidden' using errcode='42501'; end if;
  if project_row.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
  if project_row.closed_at is not null then raise exception 'Conflict' using errcode='40001'; end if;
  check_result:=private.project_closing_check_data(project_row.id,(p_payload->>'as_of_date')::date);
  if not (check_result->>'can_close')::boolean then raise exception 'Closing requirements are not satisfied' using errcode='22023'; end if;
  finance_result:=check_result->'financial_summary';
  select coalesce(max(closing_no),0)+1 into closing_number from public.project_closings where project_id=project_row.id;
  perform set_config('app.project_closing_command','on',true);
  update public.projects set status='COMPLETED',actual_start_date=coalesce(actual_start_date,planned_start_date),
   actual_end_date=coalesce(actual_end_date,(p_payload->>'as_of_date')::date),closed_at=now(),closed_by=auth.uid(),closing_snapshot=finance_result
  where id=project_row.id;
  insert into public.project_closings(project_id,closing_no,as_of_date,checklist_snapshot,financial_snapshot,note,closed_by)
  values(project_row.id,closing_number,(p_payload->>'as_of_date')::date,check_result,finance_result,coalesce(trim(p_payload->>'note'),''),auth.uid())
  returning id into target;
  output:=jsonb_build_object('id',target,'project_id',project_row.id,'message','프로젝트를 마감했습니다.');

 elsif p_action='project.reopen' then
  perform private.require_permission('PROJECT_REOPEN');
  select * into project_row from public.projects where id=target_project for update;
  if not found or project_row.closed_at is null then raise exception 'NotFound' using errcode='P0002'; end if;
  if project_row.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
  if length(trim(coalesce(p_payload->>'reason','')))<5 then raise exception 'ValidationError' using errcode='22023'; end if;
  select * into closing_row from public.project_closings where project_id=project_row.id and status='CLOSED' for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  update public.project_closings set status='REOPENED',reopened_at=now(),reopened_by=auth.uid(),reopen_reason=trim(p_payload->>'reason') where id=closing_row.id;
  perform set_config('app.project_closing_command','on',true);
  update public.projects set status='IN_PROGRESS',actual_end_date=null,closed_at=null,closed_by=null,closing_snapshot=null where id=project_row.id;
  output:=jsonb_build_object('id',closing_row.id,'project_id',project_row.id,'message','프로젝트 마감을 재개방했습니다.');
 else
  raise exception 'ValidationError' using errcode='22023';
 end if;

 insert into public.expense_finance_command_receipts(actor_user_id,request_id,action,payload_hash,result)
 values(auth.uid(),p_request_id,p_action,content_hash,output);
 return output;
end;
$$;

create function public.expense_finance_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language sql volatile security definer set search_path='' as $$
 select private.expense_finance_command(p_action,p_payload,p_request_id);
$$;

create or replace function public.card_month_amount(p_month date)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare result numeric;
begin
 perform private.require_permission('EXPENSE_READ_ALL');
 select coalesce(sum(total_amount),0) into result from public.expenses
 where transaction_date>=p_month and transaction_date<(p_month+interval '1 month')::date
  and deleted_at is null and source_type='CARD';
 return result;
end;
$$;

alter table public.expense_types enable row level security;
alter table public.vendors enable row level security;
alter table public.project_closings enable row level security;
alter table public.expense_finance_command_receipts enable row level security;

create policy expense_types_read on public.expense_types for select to authenticated using(
 private.is_active() and (
  private.has_permission('EXPENSE_READ_SELF') or private.has_permission('EXPENSE_READ_PROJECT') or
  private.has_permission('EXPENSE_READ_ALL') or private.has_permission('EXPENSE_MANAGE') or
  private.has_permission('EXPENSE_MASTER_MANAGE')
 )
);
create policy vendors_read on public.vendors for select to authenticated using(
 private.is_active() and (
  private.has_permission('EXPENSE_READ_SELF') or private.has_permission('EXPENSE_READ_PROJECT') or
  private.has_permission('EXPENSE_READ_ALL') or private.has_permission('EXPENSE_MANAGE') or
  private.has_permission('EXPENSE_MASTER_MANAGE')
 )
);
create policy project_closings_read on public.project_closings for select to authenticated using(
 private.can_read_project_finance(project_id)
);

grant select on public.expense_types,public.vendors,public.project_closings to authenticated;
revoke insert,update,delete on public.expense_types,public.vendors,public.project_closings from public,anon,authenticated;
revoke all on public.expense_finance_command_receipts from public,anon,authenticated;

revoke execute on function private.can_read_project_finance(uuid),private.assert_project_finance_open(uuid),
 private.guard_direct_project_mutation(),private.guard_payment_project_mutation(),private.guard_tax_invoice_project_mutation(),
 private.guard_payment_allocation_project_mutation(),private.guard_closed_project_row(),
 private.project_financial_summary_data(uuid,date),private.project_closing_check_data(uuid,date),
 private.expense_finance_command(text,jsonb,text) from public,anon,authenticated;
grant execute on function private.can_read_project_finance(uuid) to authenticated;
revoke execute on function public.project_financial_summary(uuid,date),public.project_financial_portfolio(date),
 public.project_closing_check(uuid,date),public.expense_finance_command(text,jsonb,text) from public,anon;
grant execute on function public.project_financial_summary(uuid,date),public.project_financial_portfolio(date),
 public.project_closing_check(uuid,date),public.expense_finance_command(text,jsonb,text) to authenticated;

commit;
