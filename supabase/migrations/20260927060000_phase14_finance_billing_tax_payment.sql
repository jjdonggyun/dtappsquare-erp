begin;

insert into public.permissions(code,description) values
 ('BILLING_READ','담당 프로젝트 청구 조회'),
 ('BILLING_READ_ALL','전체 청구 조회'),
 ('BILLING_MANAGE','청구 일정 및 청구서 관리'),
 ('TAX_INVOICE_READ','담당 프로젝트 세금계산서 조회'),
 ('TAX_INVOICE_READ_ALL','전체 세금계산서 조회'),
 ('TAX_INVOICE_MANAGE','세금계산서 발행자료 및 발급 결과 관리'),
 ('PAYMENT_READ','담당 프로젝트 입금 조회'),
 ('PAYMENT_READ_ALL','전체 입금 조회'),
 ('PAYMENT_MANAGE','입금 및 수금 배분 관리'),
 ('FINANCE_SETTINGS_MANAGE','공급자 세무정보 및 입금계좌 관리')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (r.code='ADMIN' and p.code in (
  'BILLING_READ','BILLING_READ_ALL','BILLING_MANAGE','TAX_INVOICE_READ','TAX_INVOICE_READ_ALL',
  'TAX_INVOICE_MANAGE','PAYMENT_READ','PAYMENT_READ_ALL','PAYMENT_MANAGE','FINANCE_SETTINGS_MANAGE'))
 or (r.code='FINANCE_MANAGER' and p.code in (
  'BILLING_READ_ALL','BILLING_MANAGE','TAX_INVOICE_READ_ALL','TAX_INVOICE_MANAGE',
  'PAYMENT_READ_ALL','PAYMENT_MANAGE','FINANCE_SETTINGS_MANAGE'))
 or (r.code='PROJECT_MANAGER' and p.code in ('BILLING_READ','TAX_INVOICE_READ','PAYMENT_READ'))
 or (r.code='SALES' and p.code in ('BILLING_READ','TAX_INVOICE_READ','PAYMENT_READ'))
on conflict do nothing;

create sequence public.billing_number_seq;
create sequence public.tax_invoice_number_seq;
create sequence public.payment_number_seq;

create table public.company_tax_profiles (
 id text primary key default 'default' check(id='default'),
 business_registration_number text not null check(business_registration_number ~ '^[0-9]{10}$'),
 company_name text not null check(length(trim(company_name)) between 1 and 160),
 representative_name text not null check(length(trim(representative_name)) between 1 and 100),
 address text not null check(length(trim(address)) between 1 and 500),
 business_type text not null check(length(trim(business_type)) between 1 and 120),
 business_item text not null check(length(trim(business_item)) between 1 and 120),
 email text,
 phone text not null default '' check(length(phone)<=50),
 updated_by uuid not null references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.company_bank_accounts (
 id uuid primary key default gen_random_uuid(),
 bank_name text not null check(length(trim(bank_name)) between 1 and 80),
 account_number text not null check(length(regexp_replace(account_number,'[^0-9]','','g')) between 8 and 24),
 account_holder text not null check(length(trim(account_holder)) between 1 and 100),
 purpose text not null default '수금계좌' check(length(purpose)<=100),
 is_default boolean not null default false,
 active boolean not null default true,
 note text not null default '' check(length(note)<=1000),
 created_by uuid not null references public.employees(id) on delete restrict,
 updated_by uuid not null references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(bank_name,account_number)
);
create unique index company_bank_accounts_default on public.company_bank_accounts(is_default) where is_default and active;

create table public.billing_schedules (
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null references public.contracts(id) on delete restrict,
 project_id uuid not null references public.projects(id) on delete restrict,
 sequence_no integer not null check(sequence_no>0),
 title text not null check(length(trim(title)) between 1 and 200),
 billing_condition text not null default '' check(length(billing_condition)<=1000),
 scheduled_date date not null,
 supply_amount numeric(18,2) not null check(supply_amount>=0),
 vat_rate numeric(5,2) not null default 10 check(vat_rate between 0 and 100),
 vat_amount numeric(18,2) not null default 0 check(vat_amount>=0),
 total_amount numeric(18,2) not null default 0 check(total_amount>=0),
 status text not null default 'SCHEDULED' check(status in ('SCHEDULED','READY','BILLED','CANCELED')),
 note text not null default '' check(length(note)<=2000),
 created_by uuid not null references public.employees(id) on delete restrict,
 updated_by uuid not null references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(contract_id,sequence_no),
 check(total_amount=supply_amount+vat_amount)
);
create index billing_schedules_project_date on public.billing_schedules(project_id,scheduled_date,status);

create table public.billings (
 id uuid primary key default gen_random_uuid(),
 billing_number text not null unique default ('BIL-'||to_char(current_date,'YYYYMM')||'-'||lpad(nextval('public.billing_number_seq')::text,5,'0')),
 schedule_id uuid unique references public.billing_schedules(id) on delete restrict,
 customer_id uuid not null references public.customers(id) on delete restrict,
 project_id uuid not null references public.projects(id) on delete restrict,
 contract_id uuid not null references public.contracts(id) on delete restrict,
 bank_account_id uuid references public.company_bank_accounts(id) on delete restrict,
 title text not null check(length(trim(title)) between 1 and 200),
 billing_date date not null,
 due_date date not null,
 supply_amount numeric(18,2) not null check(supply_amount>=0),
 vat_rate numeric(5,2) not null default 10 check(vat_rate between 0 and 100),
 vat_amount numeric(18,2) not null default 0 check(vat_amount>=0),
 total_amount numeric(18,2) not null default 0 check(total_amount>=0),
 status text not null default 'DRAFT' check(status in ('DRAFT','BILLED','PARTIALLY_PAID','PAID','CANCELED')),
 note text not null default '' check(length(note)<=2000),
 issued_at timestamptz,
 canceled_at timestamptz,
 created_by uuid not null references public.employees(id) on delete restrict,
 updated_by uuid not null references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(due_date>=billing_date),
 check(total_amount=supply_amount+vat_amount),
 check((status='CANCELED')=(canceled_at is not null))
);
alter sequence public.billing_number_seq owned by public.billings.billing_number;
create index billings_project_due on public.billings(project_id,due_date,status);
create index billings_customer_due on public.billings(customer_id,due_date,status);

create table public.tax_invoices (
 id uuid primary key default gen_random_uuid(),
 invoice_number text not null unique default ('TAX-'||to_char(current_date,'YYYYMM')||'-'||lpad(nextval('public.tax_invoice_number_seq')::text,5,'0')),
 billing_id uuid not null references public.billings(id) on delete restrict,
 original_tax_invoice_id uuid references public.tax_invoices(id) on delete restrict,
 correction_reason text not null default '' check(length(correction_reason)<=500),
 issue_date date not null,
 supply_date date not null,
 purpose text not null default 'CHARGE' check(purpose in ('CHARGE','RECEIPT')),
 status text not null default 'DRAFT' check(status in ('DRAFT','READY','ISSUED','CANCELED')),
 issue_channel text check(issue_channel in ('HOMETAX','ASP','CERTIFIED_ERP')),
 nts_approval_number text unique check(nts_approval_number is null or nts_approval_number ~ '^[0-9]{24}$'),
 supplier_registration_number text not null check(supplier_registration_number ~ '^[0-9]{10}$'),
 supplier_name text not null,
 supplier_representative_name text not null,
 supplier_address text not null,
 supplier_business_type text not null,
 supplier_business_item text not null,
 supplier_email text,
 buyer_registration_number text not null check(buyer_registration_number ~ '^[0-9]{10}$'),
 buyer_name text not null,
 buyer_representative_name text not null,
 buyer_address text not null,
 buyer_business_type text not null,
 buyer_business_item text not null,
 recipient_name text not null default '',
 recipient_email text not null check(recipient_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
 supply_amount numeric(18,2) not null check(supply_amount>=0),
 vat_amount numeric(18,2) not null check(vat_amount>=0),
 total_amount numeric(18,2) not null check(total_amount=supply_amount+vat_amount),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 99),
 note text not null default '' check(length(note)<=2000),
 issued_at timestamptz,
 transmitted_at timestamptz,
 canceled_at timestamptz,
 created_by uuid not null references public.employees(id) on delete restrict,
 updated_by uuid not null references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((status='ISSUED')=(nts_approval_number is not null and issued_at is not null)),
 check((status='CANCELED')=(canceled_at is not null))
);
alter sequence public.tax_invoice_number_seq owned by public.tax_invoices.invoice_number;
create index tax_invoices_billing on public.tax_invoices(billing_id,created_at desc);
create index tax_invoices_issue_date on public.tax_invoices(issue_date,status);

create table public.payments (
 id uuid primary key default gen_random_uuid(),
 payment_number text not null unique default ('PAY-'||to_char(current_date,'YYYYMM')||'-'||lpad(nextval('public.payment_number_seq')::text,5,'0')),
 customer_id uuid not null references public.customers(id) on delete restrict,
 project_id uuid references public.projects(id) on delete restrict,
 bank_account_id uuid references public.company_bank_accounts(id) on delete restrict,
 received_date date not null,
 amount numeric(18,2) not null check(amount>0),
 payer_name text not null check(length(trim(payer_name)) between 1 and 160),
 bank_reference text not null default '' check(length(bank_reference)<=200),
 note text not null default '' check(length(note)<=2000),
 status text not null default 'CONFIRMED' check(status in ('CONFIRMED','CANCELED')),
 canceled_at timestamptz,
 created_by uuid not null references public.employees(id) on delete restrict,
 updated_by uuid not null references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((status='CANCELED')=(canceled_at is not null))
);
alter sequence public.payment_number_seq owned by public.payments.payment_number;
create index payments_customer_date on public.payments(customer_id,received_date desc);
create index payments_project_date on public.payments(project_id,received_date desc) where project_id is not null;

create table public.payment_allocations (
 id uuid primary key default gen_random_uuid(),
 payment_id uuid not null references public.payments(id) on delete restrict,
 billing_id uuid not null references public.billings(id) on delete restrict,
 amount numeric(18,2) not null check(amount>0),
 created_by uuid not null references public.employees(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(payment_id,billing_id)
);
create index payment_allocations_billing on public.payment_allocations(billing_id);

create table public.finance_command_receipts (
 actor_user_id uuid not null references public.employees(id) on delete restrict,
 request_id text not null check(length(request_id) between 16 and 100),
 action text not null,
 payload_hash text not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(actor_user_id,request_id)
);

create function private.derive_finance_amounts()
returns trigger language plpgsql set search_path='' as $$
begin
 new.vat_amount:=round(new.supply_amount*new.vat_rate/100,2);
 new.total_amount:=new.supply_amount+new.vat_amount;
 return new;
end;
$$;
create trigger derive_billing_schedule_amounts before insert or update of supply_amount,vat_rate on public.billing_schedules for each row execute function private.derive_finance_amounts();
create trigger derive_billing_amounts before insert or update of supply_amount,vat_rate on public.billings for each row execute function private.derive_finance_amounts();

create trigger touch_company_tax_profiles before update on public.company_tax_profiles for each row execute function private.touch_versioned_row();
create trigger touch_company_bank_accounts before update on public.company_bank_accounts for each row execute function private.touch_versioned_row();
create trigger touch_billing_schedules before update on public.billing_schedules for each row execute function private.touch_versioned_row();
create trigger touch_billings before update on public.billings for each row execute function private.touch_versioned_row();
create trigger touch_tax_invoices before update on public.tax_invoices for each row execute function private.touch_versioned_row();
create trigger touch_payments before update on public.payments for each row execute function private.touch_versioned_row();

create trigger audit_company_tax_profiles after insert or update on public.company_tax_profiles for each row execute function private.capture_audit();
create trigger audit_company_bank_accounts after insert or update on public.company_bank_accounts for each row execute function private.capture_audit();
create trigger audit_billing_schedules after insert or update on public.billing_schedules for each row execute function private.capture_audit();
create trigger audit_billings after insert or update on public.billings for each row execute function private.capture_audit();
create trigger audit_tax_invoices after insert or update on public.tax_invoices for each row execute function private.capture_audit();
create trigger audit_payments after insert or update on public.payments for each row execute function private.capture_audit();
create trigger audit_payment_allocations after insert or update or delete on public.payment_allocations for each row execute function private.capture_audit();

alter table public.company_tax_profiles enable row level security;
alter table public.company_bank_accounts enable row level security;
alter table public.billing_schedules enable row level security;
alter table public.billings enable row level security;
alter table public.tax_invoices enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.finance_command_receipts enable row level security;

create function private.can_read_finance_project(p_project_id uuid,p_domain text)
returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(
  select 1 from public.projects p where p.id=p_project_id and (
   (p_domain='BILLING' and private.has_permission('BILLING_READ_ALL')) or
   (p_domain='TAX_INVOICE' and private.has_permission('TAX_INVOICE_READ_ALL')) or
   (p_domain='PAYMENT' and private.has_permission('PAYMENT_READ_ALL')) or
   (p_domain='BILLING' and private.has_permission('BILLING_READ') and (p.project_manager_id=auth.uid() or p.sales_owner_id=auth.uid())) or
   (p_domain='TAX_INVOICE' and private.has_permission('TAX_INVOICE_READ') and (p.project_manager_id=auth.uid() or p.sales_owner_id=auth.uid())) or
   (p_domain='PAYMENT' and private.has_permission('PAYMENT_READ') and (p.project_manager_id=auth.uid() or p.sales_owner_id=auth.uid()))
  )
 );
$$;

create policy company_tax_profiles_read on public.company_tax_profiles for select to authenticated using(
 private.is_active() and (private.has_permission('FINANCE_SETTINGS_MANAGE') or private.has_permission('TAX_INVOICE_MANAGE'))
);
create policy company_bank_accounts_read on public.company_bank_accounts for select to authenticated using(
 private.is_active() and (private.has_permission('FINANCE_SETTINGS_MANAGE') or private.has_permission('BILLING_MANAGE') or private.has_permission('PAYMENT_MANAGE'))
);
create policy billing_schedules_read on public.billing_schedules for select to authenticated using(private.can_read_finance_project(project_id,'BILLING'));
create policy billings_read on public.billings for select to authenticated using(private.can_read_finance_project(project_id,'BILLING'));
create policy tax_invoices_read on public.tax_invoices for select to authenticated using(
 exists(select 1 from public.billings b where b.id=billing_id and private.can_read_finance_project(b.project_id,'TAX_INVOICE'))
);
create policy payments_read on public.payments for select to authenticated using(
 (project_id is not null and private.can_read_finance_project(project_id,'PAYMENT')) or private.has_permission('PAYMENT_READ_ALL')
);
create policy payment_allocations_read on public.payment_allocations for select to authenticated using(
 exists(select 1 from public.billings b where b.id=billing_id and private.can_read_finance_project(b.project_id,'PAYMENT'))
);

grant select on public.company_tax_profiles,public.company_bank_accounts,public.billing_schedules,public.billings,
 public.tax_invoices,public.payments,public.payment_allocations to authenticated;
revoke insert,update,delete on public.company_tax_profiles,public.company_bank_accounts,public.billing_schedules,public.billings,
 public.tax_invoices,public.payments,public.payment_allocations from public,anon,authenticated;
revoke all on public.finance_command_receipts from public,anon,authenticated;
revoke all on sequence public.billing_number_seq,public.tax_invoice_number_seq,public.payment_number_seq from public,anon,authenticated;
revoke execute on function private.derive_finance_amounts() from public,anon,authenticated;
grant execute on function private.can_read_finance_project(uuid,text) to authenticated;
revoke execute on function private.can_read_finance_project(uuid,text) from public,anon;

create function private.refresh_billing_collection(p_billing_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare total_paid numeric(18,2); billed public.billings;
begin
 select * into billed from public.billings where id=p_billing_id for update;
 if not found or billed.status in ('DRAFT','CANCELED') then return; end if;
 select coalesce(sum(a.amount),0) into total_paid from public.payment_allocations a
 join public.payments p on p.id=a.payment_id where a.billing_id=p_billing_id and p.status='CONFIRMED';
 update public.billings set status=case when total_paid>=billed.total_amount then 'PAID'
   when total_paid>0 then 'PARTIALLY_PAID' else 'BILLED' end,updated_by=auth.uid() where id=p_billing_id;
end;
$$;

create function private.finance_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 target uuid:=nullif(p_payload->>'id','')::uuid;
 schedule_ref uuid:=nullif(p_payload->>'schedule_id','')::uuid;
 billing_ref uuid:=nullif(p_payload->>'billing_id','')::uuid;
 payment_ref uuid:=nullif(p_payload->>'payment_id','')::uuid;
 project_ref uuid:=nullif(p_payload->>'project_id','')::uuid;
 contract_ref uuid:=nullif(p_payload->>'contract_id','')::uuid;
 bank_ref uuid:=nullif(p_payload->>'bank_account_id','')::uuid;
 customer_ref uuid;
 row_version integer;
 s public.billing_schedules;
 b public.billings;
 t public.tax_invoices;
 pay public.payments;
 profile public.company_tax_profiles;
 customer public.customers;
 amount_value numeric(18,2);
 item_supply numeric(18,2);
 item_vat numeric(18,2);
 paid_total numeric(18,2);
 allocated_total numeric(18,2);
 output jsonb;
 content_hash text;
 existing_hash text;
 normalized_registration text;
 item jsonb;
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='28000'; end if;
 if p_request_id is null or length(p_request_id) not between 16 and 100 then raise exception 'ValidationError' using errcode='22023'; end if;
 perform set_config('app.request_id',p_request_id,true);
 content_hash:=encode(extensions.digest(convert_to(p_action||':'||p_payload::text,'UTF8'),'sha256'),'hex');
 select payload_hash,result into existing_hash,output from public.finance_command_receipts
  where actor_user_id=auth.uid() and request_id=p_request_id;
 if found then
  if existing_hash<>content_hash then raise exception 'Conflict' using errcode='40001'; end if;
  return output;
 end if;

 if p_action='company_tax_profile.save' then
  perform private.require_permission('FINANCE_SETTINGS_MANAGE');
  normalized_registration:=regexp_replace(coalesce(p_payload->>'business_registration_number',''),'[^0-9]','','g');
  if length(normalized_registration)<>10 then raise exception 'ValidationError' using errcode='22023'; end if;
  if exists(select 1 from public.company_tax_profiles where id='default') then
   select version into row_version from public.company_tax_profiles where id='default' for update;
   if row_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   update public.company_tax_profiles set business_registration_number=normalized_registration,company_name=trim(p_payload->>'company_name'),
    representative_name=trim(p_payload->>'representative_name'),address=trim(p_payload->>'address'),
    business_type=trim(p_payload->>'business_type'),business_item=trim(p_payload->>'business_item'),
    email=nullif(lower(trim(p_payload->>'email')),''),phone=coalesce(trim(p_payload->>'phone'),''),updated_by=auth.uid() where id='default';
  else
   insert into public.company_tax_profiles(id,business_registration_number,company_name,representative_name,address,business_type,business_item,email,phone,updated_by)
   values('default',normalized_registration,trim(p_payload->>'company_name'),trim(p_payload->>'representative_name'),trim(p_payload->>'address'),
    trim(p_payload->>'business_type'),trim(p_payload->>'business_item'),nullif(lower(trim(p_payload->>'email')),''),coalesce(trim(p_payload->>'phone'),''),auth.uid());
  end if;
  output:=jsonb_build_object('id','default','message','공급자 세무정보를 저장했습니다.');

 elsif p_action='bank_account.save' then
  perform private.require_permission('FINANCE_SETTINGS_MANAGE');
  if coalesce((p_payload->>'is_default')::boolean,false) then update public.company_bank_accounts set is_default=false,updated_by=auth.uid() where is_default and active and (target is null or id<>target); end if;
  if target is null then
   insert into public.company_bank_accounts(bank_name,account_number,account_holder,purpose,is_default,active,note,created_by,updated_by)
   values(trim(p_payload->>'bank_name'),trim(p_payload->>'account_number'),trim(p_payload->>'account_holder'),coalesce(trim(p_payload->>'purpose'),'수금계좌'),
    coalesce((p_payload->>'is_default')::boolean,false),true,coalesce(trim(p_payload->>'note'),''),auth.uid(),auth.uid()) returning id into target;
  else
   select version into row_version from public.company_bank_accounts where id=target for update;
   if not found then raise exception 'NotFound' using errcode='P0002'; end if;
   if row_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   update public.company_bank_accounts set bank_name=trim(p_payload->>'bank_name'),account_number=trim(p_payload->>'account_number'),
    account_holder=trim(p_payload->>'account_holder'),purpose=coalesce(trim(p_payload->>'purpose'),'수금계좌'),
    is_default=coalesce((p_payload->>'is_default')::boolean,false),active=coalesce((p_payload->>'active')::boolean,true),
    note=coalesce(trim(p_payload->>'note'),''),updated_by=auth.uid() where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','수금계좌를 저장했습니다.');

 elsif p_action='schedule.save' then
  perform private.require_permission('BILLING_MANAGE');
  if not exists(select 1 from public.projects where id=project_ref and contract_id=contract_ref) then
   raise exception 'ValidationError' using errcode='22023';
  end if;
  if target is null then
   insert into public.billing_schedules(contract_id,project_id,sequence_no,title,billing_condition,scheduled_date,supply_amount,vat_rate,note,created_by,updated_by)
   values(contract_ref,project_ref,(p_payload->>'sequence_no')::integer,trim(p_payload->>'title'),coalesce(trim(p_payload->>'billing_condition'),''),
    (p_payload->>'scheduled_date')::date,(p_payload->>'supply_amount')::numeric,coalesce((p_payload->>'vat_rate')::numeric,10),coalesce(trim(p_payload->>'note'),''),auth.uid(),auth.uid()) returning id into target;
  else
   select * into s from public.billing_schedules where id=target for update;
   if not found then raise exception 'NotFound' using errcode='P0002'; end if;
   if s.status not in ('SCHEDULED','READY') or s.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   update public.billing_schedules set sequence_no=(p_payload->>'sequence_no')::integer,title=trim(p_payload->>'title'),
    billing_condition=coalesce(trim(p_payload->>'billing_condition'),''),scheduled_date=(p_payload->>'scheduled_date')::date,
    supply_amount=(p_payload->>'supply_amount')::numeric,vat_rate=coalesce((p_payload->>'vat_rate')::numeric,10),
    status=coalesce(p_payload->>'status',s.status),note=coalesce(trim(p_payload->>'note'),''),updated_by=auth.uid() where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','청구 일정을 저장했습니다.');

 elsif p_action='schedule.cancel' then
  perform private.require_permission('BILLING_MANAGE');
  select * into s from public.billing_schedules where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if s.status not in ('SCHEDULED','READY') or s.version is distinct from (p_payload->>'version')::integer or exists(select 1 from public.billings where schedule_id=target) then raise exception 'Conflict' using errcode='40001'; end if;
  update public.billing_schedules set status='CANCELED',updated_by=auth.uid() where id=target;
  output:=jsonb_build_object('id',target,'message','청구 일정을 취소했습니다.');

 elsif p_action='billing.create' then
  perform private.require_permission('BILLING_MANAGE');
  select * into s from public.billing_schedules where id=schedule_ref for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if s.status not in ('SCHEDULED','READY') or exists(select 1 from public.billings where schedule_id=s.id) then raise exception 'Conflict' using errcode='40001'; end if;
  select customer_id into customer_ref from public.contracts where id=s.contract_id;
  if customer_ref is null then raise exception 'ValidationError' using errcode='22023'; end if;
  if bank_ref is null then select id into bank_ref from public.company_bank_accounts where active order by is_default desc,created_at limit 1; end if;
  insert into public.billings(schedule_id,customer_id,project_id,contract_id,bank_account_id,title,billing_date,due_date,supply_amount,vat_rate,note,created_by,updated_by)
  values(s.id,customer_ref,s.project_id,s.contract_id,bank_ref,s.title,(p_payload->>'billing_date')::date,(p_payload->>'due_date')::date,s.supply_amount,s.vat_rate,coalesce(trim(p_payload->>'note'),s.note),auth.uid(),auth.uid()) returning id into target;
  update public.billing_schedules set status='BILLED',updated_by=auth.uid() where id=s.id;
  output:=jsonb_build_object('id',target,'message','청구서 초안을 생성했습니다.','redirect','/finance/billings/'||target::text);

 elsif p_action='billing.issue' then
  perform private.require_permission('BILLING_MANAGE');
  select * into b from public.billings where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if b.status<>'DRAFT' or b.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
  update public.billings set status='BILLED',issued_at=now(),updated_by=auth.uid() where id=target;
  output:=jsonb_build_object('id',target,'message','청구서를 발행 상태로 전환했습니다.');

 elsif p_action='billing.cancel' then
  perform private.require_permission('BILLING_MANAGE');
  select * into b from public.billings where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if b.status not in ('DRAFT','BILLED') or b.version is distinct from (p_payload->>'version')::integer
   or exists(select 1 from public.payment_allocations a join public.payments p on p.id=a.payment_id where a.billing_id=target and p.status='CONFIRMED')
   or exists(select 1 from public.tax_invoices where billing_id=target and status='ISSUED') then raise exception 'Conflict' using errcode='40001'; end if;
  update public.tax_invoices set status='CANCELED',canceled_at=now(),updated_by=auth.uid() where billing_id=target and status in ('DRAFT','READY');
  update public.billings set status='CANCELED',canceled_at=now(),updated_by=auth.uid() where id=target;
  output:=jsonb_build_object('id',target,'message','청구서를 취소했습니다. 연결된 미발급 세금계산서도 취소했습니다.','redirect','/finance/billings');

 elsif p_action='tax_invoice.create' then
  perform private.require_permission('TAX_INVOICE_MANAGE');
  select * into b from public.billings where id=billing_ref and status in ('BILLED','PARTIALLY_PAID','PAID') for share;
  if not found then raise exception 'Conflict' using errcode='40001'; end if;
  select * into profile from public.company_tax_profiles where id='default';
  if not found then raise exception 'ValidationError' using errcode='22023'; end if;
  select * into customer from public.customers where id=b.customer_id;
  if customer.business_registration_number is null or customer.representative_name is null or customer.address='' or customer.business_type='' or customer.business_item='' or customer.billing_email is null then
   raise exception 'ValidationError' using errcode='22023';
  end if;
  insert into public.tax_invoices(billing_id,issue_date,supply_date,purpose,supplier_registration_number,supplier_name,
   supplier_representative_name,supplier_address,supplier_business_type,supplier_business_item,supplier_email,
   buyer_registration_number,buyer_name,buyer_representative_name,buyer_address,buyer_business_type,buyer_business_item,
   recipient_name,recipient_email,supply_amount,vat_amount,total_amount,items,note,created_by,updated_by)
  values(b.id,(p_payload->>'issue_date')::date,coalesce(nullif(p_payload->>'supply_date','')::date,b.billing_date),coalesce(p_payload->>'purpose','CHARGE'),
   profile.business_registration_number,profile.company_name,profile.representative_name,profile.address,profile.business_type,profile.business_item,profile.email,
   customer.business_registration_number,customer.name,customer.representative_name,customer.address,customer.business_type,customer.business_item,
   customer.billing_contact_name,customer.billing_email,b.supply_amount,b.vat_amount,b.total_amount,
   jsonb_build_array(jsonb_build_object('date',coalesce(nullif(p_payload->>'supply_date','')::date,b.billing_date),'name',b.title,'specification','',
    'quantity',1,'unitPrice',b.supply_amount,'supplyAmount',b.supply_amount,'vatAmount',b.vat_amount,'note','')),
   coalesce(trim(p_payload->>'note'),''),auth.uid(),auth.uid()) returning id into target;
  output:=jsonb_build_object('id',target,'message','세금계산서 발행자료 초안을 생성했습니다.','redirect','/finance/tax-invoices/'||target::text);

 elsif p_action='tax_invoice.save' then
  perform private.require_permission('TAX_INVOICE_MANAGE');
  select * into t from public.tax_invoices where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if t.status<>'DRAFT' or t.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
  if jsonb_typeof(p_payload->'items')<>'array' or jsonb_array_length(p_payload->'items') not between 1 and 99 then raise exception 'ValidationError' using errcode='22023'; end if;
  item_supply:=0; item_vat:=0;
  for item in select value from jsonb_array_elements(p_payload->'items') loop
   if length(trim(coalesce(item->>'name','')))=0 or coalesce((item->>'supplyAmount')::numeric,-1)<0 or coalesce((item->>'vatAmount')::numeric,-1)<0 then raise exception 'ValidationError' using errcode='22023'; end if;
   item_supply:=item_supply+(item->>'supplyAmount')::numeric; item_vat:=item_vat+(item->>'vatAmount')::numeric;
  end loop;
  update public.tax_invoices set issue_date=(p_payload->>'issue_date')::date,supply_date=(p_payload->>'supply_date')::date,
   purpose=coalesce(p_payload->>'purpose','CHARGE'),recipient_name=coalesce(trim(p_payload->>'recipient_name'),''),recipient_email=lower(trim(p_payload->>'recipient_email')),
   supply_amount=item_supply,vat_amount=item_vat,total_amount=item_supply+item_vat,items=p_payload->'items',note=coalesce(trim(p_payload->>'note'),''),updated_by=auth.uid() where id=target;
  output:=jsonb_build_object('id',target,'message','세금계산서 발행자료를 저장했습니다.');

 elsif p_action='tax_invoice.ready' then
  perform private.require_permission('TAX_INVOICE_MANAGE');
  select * into t from public.tax_invoices where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if t.status<>'DRAFT' or t.version is distinct from (p_payload->>'version')::integer or t.total_amount<=0 then raise exception 'Conflict' using errcode='40001'; end if;
  select coalesce(sum((value->>'supplyAmount')::numeric),0),coalesce(sum((value->>'vatAmount')::numeric),0) into item_supply,item_vat from jsonb_array_elements(t.items);
  if item_supply<>t.supply_amount or item_vat<>t.vat_amount then raise exception 'ValidationError' using errcode='22023'; end if;
  update public.tax_invoices set status='READY',updated_by=auth.uid() where id=target;
  output:=jsonb_build_object('id',target,'message','발행자료를 확정했습니다. 홈택스 또는 등록 ASP에서 발급 후 승인번호를 기록하세요.');

 elsif p_action='tax_invoice.cancel' then
  perform private.require_permission('TAX_INVOICE_MANAGE');
  select * into t from public.tax_invoices where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if t.status not in ('DRAFT','READY') or t.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
  update public.tax_invoices set status='CANCELED',canceled_at=now(),updated_by=auth.uid() where id=target;
  output:=jsonb_build_object('id',target,'message','미발급 세금계산서 발행자료를 취소했습니다.','redirect','/finance/tax-invoices');

 elsif p_action='tax_invoice.record_issue' then
  perform private.require_permission('TAX_INVOICE_MANAGE');
  select * into t from public.tax_invoices where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if t.status<>'READY' or t.version is distinct from (p_payload->>'version')::integer or coalesce(p_payload->>'nts_approval_number','') !~ '^[0-9]{24}$' or p_payload->>'issue_channel' not in ('HOMETAX','ASP','CERTIFIED_ERP') then
   raise exception 'ValidationError' using errcode='22023';
  end if;
  update public.tax_invoices set status='ISSUED',issue_channel=p_payload->>'issue_channel',nts_approval_number=p_payload->>'nts_approval_number',issued_at=now(),
   transmitted_at=nullif(p_payload->>'transmitted_at','')::timestamptz,updated_by=auth.uid() where id=target;
  output:=jsonb_build_object('id',target,'message','국세청 승인번호를 기록해 발급 완료 처리했습니다.');

 elsif p_action='payment.save' then
  perform private.require_permission('PAYMENT_MANAGE');
  if target is null then
   insert into public.payments(customer_id,project_id,bank_account_id,received_date,amount,payer_name,bank_reference,note,created_by,updated_by)
   values((p_payload->>'customer_id')::uuid,project_ref,bank_ref,(p_payload->>'received_date')::date,(p_payload->>'amount')::numeric,
    trim(p_payload->>'payer_name'),coalesce(trim(p_payload->>'bank_reference'),''),coalesce(trim(p_payload->>'note'),''),auth.uid(),auth.uid()) returning id into target;
  else
   select * into pay from public.payments where id=target for update;
   if not found then raise exception 'NotFound' using errcode='P0002'; end if;
   if pay.status<>'CONFIRMED' or pay.version is distinct from (p_payload->>'version')::integer or exists(select 1 from public.payment_allocations where payment_id=target) then raise exception 'Conflict' using errcode='40001'; end if;
   update public.payments set customer_id=(p_payload->>'customer_id')::uuid,project_id=project_ref,bank_account_id=bank_ref,
    received_date=(p_payload->>'received_date')::date,amount=(p_payload->>'amount')::numeric,payer_name=trim(p_payload->>'payer_name'),
    bank_reference=coalesce(trim(p_payload->>'bank_reference'),''),note=coalesce(trim(p_payload->>'note'),''),updated_by=auth.uid() where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','입금내역을 저장했습니다.','redirect','/finance/payments');

 elsif p_action='payment.allocate' then
  perform private.require_permission('PAYMENT_MANAGE');
  select * into pay from public.payments where id=payment_ref and status='CONFIRMED' for update;
  select * into b from public.billings where id=billing_ref and status not in ('DRAFT','CANCELED') for update;
  if pay.id is null or b.id is null or pay.customer_id<>b.customer_id then raise exception 'ValidationError' using errcode='22023'; end if;
  amount_value:=(p_payload->>'amount')::numeric;
  if amount_value<=0 then raise exception 'ValidationError' using errcode='22023'; end if;
  select coalesce(sum(amount),0) into allocated_total from public.payment_allocations where payment_id=payment_ref;
  select coalesce(sum(a.amount),0) into paid_total from public.payment_allocations a join public.payments p on p.id=a.payment_id
   where a.billing_id=billing_ref and p.status='CONFIRMED';
  if allocated_total+amount_value>pay.amount or paid_total+amount_value>b.total_amount then raise exception 'Conflict' using errcode='40001'; end if;
  insert into public.payment_allocations(payment_id,billing_id,amount,created_by) values(payment_ref,billing_ref,amount_value,auth.uid()) returning id into target;
  perform private.refresh_billing_collection(billing_ref);
  output:=jsonb_build_object('id',target,'message','입금액을 청구서에 배분했습니다.');

 elsif p_action='payment.cancel' then
  perform private.require_permission('PAYMENT_MANAGE');
  select * into pay from public.payments where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if pay.status<>'CONFIRMED' or pay.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
  update public.payments set status='CANCELED',canceled_at=now(),updated_by=auth.uid() where id=target;
  for billing_ref in select billing_id from public.payment_allocations where payment_id=target loop perform private.refresh_billing_collection(billing_ref); end loop;
  output:=jsonb_build_object('id',target,'message','입금내역을 취소했습니다. 배분된 청구잔액도 다시 계산했습니다.');

 else
  raise exception 'ValidationError' using errcode='22023';
 end if;

 insert into public.finance_command_receipts(actor_user_id,request_id,action,payload_hash,result)
 values(auth.uid(),p_request_id,p_action,content_hash,output);
 return output;
end;
$$;

create function public.finance_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language sql security definer set search_path='' as $$
 select private.finance_command(p_action,p_payload,p_request_id);
$$;

grant execute on function public.finance_command(text,jsonb,text) to authenticated;
revoke execute on function public.finance_command(text,jsonb,text) from public,anon;
revoke execute on function private.refresh_billing_collection(uuid),private.finance_command(text,jsonb,text) from public,anon,authenticated;

commit;
