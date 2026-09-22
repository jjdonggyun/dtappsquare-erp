begin;

insert into public.permissions(code,description) values
 ('CORPORATE_CARD_READ','법인카드 조회'),('CORPORATE_CARD_MANAGE','법인카드 관리'),
 ('EXPENSE_READ_SELF','본인 비용 조회'),('EXPENSE_WRITE_SELF','본인 비용 작성'),
 ('EXPENSE_READ_PROJECT','담당 프로젝트 비용 조회'),('EXPENSE_READ_ALL','전사 비용 조회'),('EXPENSE_MANAGE','비용 관리'),
 ('CARD_SETTLEMENT_READ','월 정산 조회'),('CARD_SETTLEMENT_MANAGE','월 정산 관리'),
 ('CARD_SETTLEMENT_SEND','월 정산 발송'),('CARD_SETTLEMENT_REOPEN','마감월 재개방')
on conflict(code) do nothing;
insert into public.roles(code,name,system) values('FINANCE_MANAGER','법인카드 관리자',true) on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where
 (r.code='EMPLOYEE' and p.code in ('EXPENSE_READ_SELF','EXPENSE_WRITE_SELF'))
 or (r.code='PROJECT_MANAGER' and p.code in ('EXPENSE_READ_PROJECT','CORPORATE_CARD_READ'))
 or (r.code='FINANCE_MANAGER' and p.code in ('CORPORATE_CARD_READ','CORPORATE_CARD_MANAGE','EXPENSE_READ_ALL','EXPENSE_MANAGE','CARD_SETTLEMENT_READ','CARD_SETTLEMENT_MANAGE','CARD_SETTLEMENT_SEND','CARD_SETTLEMENT_REOPEN'))
 or (r.code='ADMIN' and (p.code like 'CORPORATE_CARD_%' or p.code like 'EXPENSE_%' or p.code like 'CARD_SETTLEMENT_%'))
on conflict do nothing;

create table public.corporate_cards(
 id uuid primary key default gen_random_uuid(),
 card_name text not null check(length(trim(card_name)) between 1 and 120),
 card_company text not null check(length(trim(card_company)) between 1 and 120),
 identifier text not null unique check(length(trim(identifier)) between 1 and 100),
 last_four text not null check(last_four ~ '^[0-9]{4}$'),
 status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE','LOST')),
 memo text not null default '' check(length(memo)<=2000),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create trigger touch_corporate_cards before update on public.corporate_cards for each row execute function private.touch_versioned_row();
create trigger audit_corporate_cards after insert or update on public.corporate_cards for each row execute function private.capture_audit();

create table public.project_card_assignments(
 id uuid primary key default gen_random_uuid(),
 corporate_card_id uuid not null references public.corporate_cards(id) on delete restrict,
 project_id uuid not null references public.projects(id) on delete restrict,
 responsible_user_id uuid not null references public.employees(id) on delete restrict,
 assigned_from date not null,assigned_to date,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','ENDED')),
 memo text not null default '' check(length(memo)<=2000),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(assigned_to is null or assigned_to>=assigned_from),
 check(status='ACTIVE' or assigned_to is not null)
);
create index project_card_assignments_card_dates on public.project_card_assignments(corporate_card_id,assigned_from,assigned_to);
create index project_card_assignments_project on public.project_card_assignments(project_id,assigned_from desc);
create trigger touch_project_card_assignments before update on public.project_card_assignments for each row execute function private.touch_versioned_row();
create trigger audit_project_card_assignments after insert or update on public.project_card_assignments for each row execute function private.capture_audit();
create function private.validate_card_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.corporate_card_id::text,0));
 if exists(select 1 from public.project_card_assignments a where a.corporate_card_id=new.corporate_card_id and a.id<>new.id
   and daterange(a.assigned_from,coalesce(a.assigned_to,'infinity'::date),'[]') && daterange(new.assigned_from,coalesce(new.assigned_to,'infinity'::date),'[]'))
 then raise exception 'Card assignment period overlaps' using errcode='40001'; end if;
 return new;
end;
$$;
create trigger validate_card_assignment before insert or update of corporate_card_id,assigned_from,assigned_to on public.project_card_assignments for each row execute function private.validate_card_assignment();

create table public.expenses(
 id uuid primary key default gen_random_uuid(),
 transaction_date date not null,
 project_id uuid not null references public.projects(id) on delete restrict,
 corporate_card_id uuid not null references public.corporate_cards(id) on delete restrict,
 user_id uuid not null references public.employees(id) on delete restrict,
 merchant text not null check(length(trim(merchant)) between 1 and 200),
 purpose text not null check(length(trim(purpose)) between 1 and 500),
 category text not null check(category in ('TRANSPORT','MEAL','MEETING','SUPPLIES','ACCOMMODATION','ENTERTAINMENT','ETC')),
 supply_amount numeric(14,2) not null check(supply_amount>=0),
 vat_amount numeric(14,2) not null check(vat_amount>=0),
 total_amount numeric(14,2) generated always as(supply_amount+vat_amount) stored,
 memo text not null default '' check(length(memo)<=2000),
 receipt_key text check(receipt_key is null or length(receipt_key)<=500),
 settlement_status text not null default 'DRAFT' check(settlement_status in ('DRAFT','SUBMITTED','SETTLED')),
 deleted_at timestamptz,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index expenses_project_month on public.expenses(project_id,transaction_date desc) where deleted_at is null;
create index expenses_card_month on public.expenses(corporate_card_id,transaction_date desc) where deleted_at is null;
create index expenses_user_month on public.expenses(user_id,transaction_date desc) where deleted_at is null;
create trigger touch_expenses before update on public.expenses for each row execute function private.touch_versioned_row();
create trigger audit_expenses after insert or update on public.expenses for each row execute function private.capture_audit();
create function private.validate_expense() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.project_card_assignments a where a.project_id=new.project_id and a.corporate_card_id=new.corporate_card_id
   and new.transaction_date>=a.assigned_from and (a.assigned_to is null or new.transaction_date<=a.assigned_to))
 then raise exception 'Card is not assigned to this project on transaction date' using errcode='22023'; end if;
 if exists(select 1 from public.monthly_card_reports r where r.settlement_month=date_trunc('month',new.transaction_date)::date and r.status in ('CLOSED','SENT'))
 then raise exception 'Settlement month is closed' using errcode='40001'; end if;
 if tg_op='UPDATE' and old.transaction_date<>new.transaction_date and exists(select 1 from public.monthly_card_reports r where r.settlement_month=date_trunc('month',old.transaction_date)::date and r.status in ('CLOSED','SENT'))
 then raise exception 'Settlement month is closed' using errcode='40001'; end if;
 return new;
end;
$$;

create table public.monthly_card_reports(
 id uuid primary key default gen_random_uuid(),
 settlement_month date not null unique check(extract(day from settlement_month)=1),
 status text not null default 'DRAFT' check(status in ('DRAFT','REVIEW','CLOSED','SENT')),
 total_count integer not null default 0 check(total_count>=0),
 total_supply_amount numeric(16,2) not null default 0,
 total_vat_amount numeric(16,2) not null default 0,
 total_amount numeric(16,2) not null default 0,
 entries_snapshot jsonb not null default '[]'::jsonb check(jsonb_typeof(entries_snapshot)='array'),
 file_key text,checksum text,
 generated_at timestamptz not null default now(),generated_by uuid references public.employees(id) on delete restrict,
 sent_at timestamptz,send_generation integer not null default 0 check(send_generation>=0),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((file_key is null)=(checksum is null))
);
create index monthly_card_reports_status on public.monthly_card_reports(status,settlement_month desc);
create trigger touch_monthly_card_reports before update on public.monthly_card_reports for each row execute function private.touch_versioned_row();
create trigger audit_monthly_card_reports after insert or update on public.monthly_card_reports for each row execute function private.capture_audit();
create trigger validate_expense before insert or update of transaction_date,project_id,corporate_card_id,supply_amount,vat_amount,deleted_at,merchant,purpose,category,memo,receipt_key on public.expenses for each row execute function private.validate_expense();

alter table public.notification_outbox alter column notification_id drop not null;
alter table public.notification_outbox alter column recipient_user_id drop not null;
alter table public.notification_outbox add column monthly_card_report_id uuid references public.monthly_card_reports(id) on delete restrict;
alter table public.notification_outbox add constraint notification_outbox_source check ((notification_id is not null and monthly_card_report_id is null) or (notification_id is null and monthly_card_report_id is not null));
create index notification_outbox_card_report on public.notification_outbox(monthly_card_report_id,status) where monthly_card_report_id is not null;
insert into public.company_settings(key,value) values('corporate_card.settlement','{"enabled":false,"recipients":[],"cc":[],"send_day":1,"send_time":"09:00","timezone":"Asia/Seoul","subject_template":"Digital Square 법인카드 {month} 정산"}'::jsonb) on conflict(key) do nothing;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('expense-receipts','expense-receipts',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']),
 ('card-settlements','card-settlements',false,20971520,array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do nothing;

create function private.can_read_expense(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(select 1 from public.expenses e join public.projects p on p.id=e.project_id where e.id=p_id and e.deleted_at is null and
   ((e.user_id=auth.uid() and private.has_permission('EXPENSE_READ_SELF')) or private.has_permission('EXPENSE_READ_ALL') or
   (private.has_permission('EXPENSE_READ_PROJECT') and p.project_manager_id=auth.uid())));
$$;
create function private.can_write_expense(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(select 1 from public.expenses e where e.id=p_id and e.deleted_at is null and
  ((e.user_id=auth.uid() and private.has_permission('EXPENSE_WRITE_SELF')) or private.has_permission('EXPENSE_MANAGE')) and
  not exists(select 1 from public.monthly_card_reports r where r.settlement_month=date_trunc('month',e.transaction_date)::date and r.status in ('CLOSED','SENT')));
$$;
alter table public.corporate_cards enable row level security;
alter table public.project_card_assignments enable row level security;
alter table public.expenses enable row level security;
alter table public.monthly_card_reports enable row level security;
revoke all on public.corporate_cards,public.project_card_assignments,public.expenses,public.monthly_card_reports from anon,authenticated;
grant select on public.corporate_cards,public.project_card_assignments,public.expenses,public.monthly_card_reports to authenticated;
create policy corporate_cards_read on public.corporate_cards for select to authenticated using(private.is_active() and private.has_permission('CORPORATE_CARD_READ'));
create policy project_card_assignments_read on public.project_card_assignments for select to authenticated using(private.is_active() and
 (private.has_permission('CORPORATE_CARD_MANAGE') or (private.has_permission('EXPENSE_READ_PROJECT') and exists(select 1 from public.projects p where p.id=project_id and p.project_manager_id=auth.uid())) or private.can_read_project(project_id)));
create policy expenses_read on public.expenses for select to authenticated using(private.can_read_expense(id));
create policy monthly_card_reports_read on public.monthly_card_reports for select to authenticated using(private.is_active() and private.has_permission('CARD_SETTLEMENT_READ'));
create policy expense_receipts_read on storage.objects for select to authenticated using(bucket_id='expense-receipts' and private.can_read_expense(split_part(name,'/',1)::uuid));
create policy expense_receipts_insert on storage.objects for insert to authenticated with check(bucket_id='expense-receipts' and private.can_write_expense(split_part(name,'/',1)::uuid));
grant execute on function private.can_read_expense(uuid),private.can_write_expense(uuid) to authenticated;
revoke execute on function private.can_read_expense(uuid),private.can_write_expense(uuid),private.validate_card_assignment(),private.validate_expense() from public,anon;

create function private.corporate_card_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare card_row public.corporate_cards; assignment_row public.project_card_assignments; expense_row public.expenses;
 report_row public.monthly_card_reports; setting_row public.company_settings; target uuid; month_date date;
 rows_json jsonb; calc_count integer; calc_supply numeric; calc_vat numeric; calc_amount numeric;
 recipient text; send_no integer; key text; report_exists boolean;
begin
 if auth.role()<>'service_role' and not private.is_active() then raise exception 'Forbidden' using errcode='42501'; end if;
 perform set_config('app.request_id',left(coalesce(p_request_id,''),100),true);
 if p_action='card.save' then
   perform private.require_permission('CORPORATE_CARD_MANAGE');
   target:=nullif(p_payload->>'id','')::uuid;
   if target is null then
     insert into public.corporate_cards(card_name,card_company,identifier,last_four,status,memo)
     values(trim(p_payload->>'card_name'),trim(p_payload->>'card_company'),trim(p_payload->>'identifier'),p_payload->>'last_four',p_payload->>'status',coalesce(p_payload->>'memo','')) returning id into target;
   else
     select * into card_row from public.corporate_cards where id=target for update;
     if not found then raise exception 'NotFound' using errcode='P0002'; end if;
     if card_row.version is distinct from(p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
     update public.corporate_cards set card_name=trim(p_payload->>'card_name'),card_company=trim(p_payload->>'card_company'),
       identifier=trim(p_payload->>'identifier'),last_four=p_payload->>'last_four',status=p_payload->>'status',memo=coalesce(p_payload->>'memo','') where id=target;
   end if;
   return jsonb_build_object('id',target,'message','법인카드를 저장했습니다.');
 elsif p_action='card_assignment.save' then
   perform private.require_permission('CORPORATE_CARD_MANAGE');
   target:=nullif(p_payload->>'id','')::uuid;
   if target is null then
     if not exists(select 1 from public.corporate_cards where id=(p_payload->>'corporate_card_id')::uuid and status='ACTIVE') then raise exception 'Inactive card' using errcode='22023'; end if;
     insert into public.project_card_assignments(corporate_card_id,project_id,responsible_user_id,assigned_from,assigned_to,status,memo)
     values((p_payload->>'corporate_card_id')::uuid,(p_payload->>'project_id')::uuid,(p_payload->>'responsible_user_id')::uuid,
       (p_payload->>'assigned_from')::date,nullif(p_payload->>'assigned_to','')::date,p_payload->>'status',coalesce(p_payload->>'memo','')) returning id into target;
   else
     select * into assignment_row from public.project_card_assignments where id=target for update;
     if not found then raise exception 'NotFound' using errcode='P0002'; end if;
     if assignment_row.version is distinct from(p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
     if assignment_row.status='ENDED' then raise exception 'Assignment history is immutable' using errcode='40001'; end if;
     if assignment_row.corporate_card_id<>(p_payload->>'corporate_card_id')::uuid or assignment_row.project_id<>(p_payload->>'project_id')::uuid then raise exception 'Assignment identity cannot change' using errcode='22023'; end if;
     update public.project_card_assignments set responsible_user_id=(p_payload->>'responsible_user_id')::uuid,
       assigned_from=(p_payload->>'assigned_from')::date,assigned_to=nullif(p_payload->>'assigned_to','')::date,
       status=p_payload->>'status',memo=coalesce(p_payload->>'memo','') where id=target;
   end if;
   return jsonb_build_object('id',target,'message','카드 할당 이력을 저장했습니다.');
 elsif p_action in ('expense.save','expense.delete','expense.receipt') then
   if not (private.has_permission('EXPENSE_WRITE_SELF') or private.has_permission('EXPENSE_MANAGE')) then raise exception 'Forbidden' using errcode='42501'; end if;
   target:=nullif(p_payload->>'id','')::uuid;
   if p_action='expense.save' and target is null then
     if not private.can_read_project((p_payload->>'project_id')::uuid) then raise exception 'Forbidden' using errcode='42501'; end if;
     insert into public.expenses(transaction_date,project_id,corporate_card_id,user_id,merchant,purpose,category,supply_amount,vat_amount,memo)
     values((p_payload->>'transaction_date')::date,(p_payload->>'project_id')::uuid,(p_payload->>'corporate_card_id')::uuid,
       auth.uid(),trim(p_payload->>'merchant'),trim(p_payload->>'purpose'),p_payload->>'category',
       (p_payload->>'supply_amount')::numeric,(p_payload->>'vat_amount')::numeric,coalesce(p_payload->>'memo','')) returning id into target;
   else
     select * into expense_row from public.expenses where id=target for update;
     if not found then raise exception 'NotFound' using errcode='P0002'; end if;
     if expense_row.deleted_at is not null or expense_row.version is distinct from(p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
     if expense_row.user_id<>auth.uid() and not private.has_permission('EXPENSE_MANAGE') then raise exception 'Forbidden' using errcode='42501'; end if;
     if exists(select 1 from public.monthly_card_reports where settlement_month=date_trunc('month',expense_row.transaction_date)::date and status in ('CLOSED','SENT')) then raise exception 'Settlement month is closed' using errcode='40001'; end if;
     if p_action='expense.delete' then
       update public.expenses set deleted_at=now() where id=target;
     elsif p_action='expense.receipt' then
       if p_payload->>'receipt_key' not like target::text||'/%' then raise exception 'Invalid receipt key' using errcode='22023'; end if;
       update public.expenses set receipt_key=p_payload->>'receipt_key' where id=target;
     else
       if not private.can_read_project((p_payload->>'project_id')::uuid) then raise exception 'Forbidden' using errcode='42501'; end if;
       update public.expenses set transaction_date=(p_payload->>'transaction_date')::date,project_id=(p_payload->>'project_id')::uuid,
         corporate_card_id=(p_payload->>'corporate_card_id')::uuid,merchant=trim(p_payload->>'merchant'),purpose=trim(p_payload->>'purpose'),
         category=p_payload->>'category',supply_amount=(p_payload->>'supply_amount')::numeric,vat_amount=(p_payload->>'vat_amount')::numeric,
         memo=coalesce(p_payload->>'memo','') where id=target;
     end if;
   end if;
   return jsonb_build_object('id',target,'message','비용 내역을 저장했습니다.');
 elsif p_action='settlement.setting' then
   perform private.require_permission('CARD_SETTLEMENT_MANAGE');
   if jsonb_typeof(p_payload->'recipients')<>'array' or jsonb_typeof(p_payload->'cc')<>'array' or
      coalesce((p_payload->>'send_day')::integer,0) not between 1 and 28 or
      coalesce(p_payload->>'send_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or
      p_payload->>'timezone'<>'Asia/Seoul' then raise exception 'ValidationError' using errcode='22023'; end if;
   select * into setting_row from public.company_settings where key='corporate_card.settlement' for update;
   if setting_row.version is distinct from(p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   update public.company_settings set value=jsonb_build_object('enabled',(p_payload->>'enabled')::boolean,'recipients',p_payload->'recipients',
     'cc',p_payload->'cc','send_day',(p_payload->>'send_day')::integer,'send_time',p_payload->>'send_time',
     'timezone',p_payload->>'timezone','subject_template',p_payload->>'subject_template'),updated_by=auth.uid() where key='corporate_card.settlement';
   return jsonb_build_object('message','정산 설정을 저장했습니다.');
 elsif p_action in ('settlement.generate','settlement.file','settlement.transition','settlement.queue') then
   if auth.role()<>'service_role' then
     if p_action='settlement.queue' then perform private.require_permission('CARD_SETTLEMENT_SEND');
     else perform private.require_permission('CARD_SETTLEMENT_MANAGE'); end if;
   end if;
   month_date:=(p_payload->>'settlement_month')::date;
   if month_date is null or extract(day from month_date)<>1 then raise exception 'ValidationError' using errcode='22023'; end if;
   perform pg_advisory_xact_lock(hashtextextended('corporate-card-settlement:'||month_date::text,0));
   select * into report_row from public.monthly_card_reports where settlement_month=month_date for update;
   report_exists:=found;
   if p_action='settlement.generate' then
     if report_exists and report_row.status in ('CLOSED','SENT') then return jsonb_build_object('id',report_row.id,'message','기존 마감 보고서입니다.'); end if;
     if report_exists and auth.role()<>'service_role' and report_row.version is distinct from(p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
     select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'transaction_date',e.transaction_date,'project_code',p.project_code,
       'project_name',p.project_name,'card',c.card_name||' •••• '||c.last_four,'user_name',u.name,'merchant',e.merchant,
       'purpose',e.purpose,'category',e.category,'supply_amount',e.supply_amount,'vat_amount',e.vat_amount,'total_amount',e.total_amount,'memo',e.memo)
       order by e.transaction_date,e.created_at,e.id),'[]'::jsonb),count(e.id)::integer,coalesce(sum(e.supply_amount),0),
       coalesce(sum(e.vat_amount),0),coalesce(sum(e.total_amount),0) into rows_json,calc_count,calc_supply,calc_vat,calc_amount
       from public.expenses e join public.projects p on p.id=e.project_id join public.corporate_cards c on c.id=e.corporate_card_id
       join public.employees u on u.id=e.user_id where e.transaction_date>=month_date and e.transaction_date<(month_date+interval '1 month')::date and e.deleted_at is null;
     if report_exists then
       update public.monthly_card_reports set entries_snapshot=rows_json,total_count=calc_count,total_supply_amount=calc_supply,
         total_vat_amount=calc_vat,total_amount=calc_amount,file_key=null,checksum=null,generated_at=now(),generated_by=auth.uid(),status='DRAFT'
         where id=report_row.id returning id into target;
     else
       insert into public.monthly_card_reports(settlement_month,entries_snapshot,total_count,total_supply_amount,total_vat_amount,total_amount,generated_by)
       values(month_date,rows_json,calc_count,calc_supply,calc_vat,calc_amount,auth.uid()) returning id into target;
     end if;
     return jsonb_build_object('id',target,'message','월 정산 초안을 생성했습니다.');
   end if;
   if not report_exists then raise exception 'NotFound' using errcode='P0002'; end if;
   if auth.role()<>'service_role' and report_row.version is distinct from(p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   if p_action='settlement.file' then
     if report_row.status not in ('DRAFT','REVIEW') or p_payload->>'file_key' not like report_row.id::text||'/%' or coalesce(p_payload->>'checksum','') !~ '^[0-9a-f]{64}$' then raise exception 'ValidationError' using errcode='22023'; end if;
     update public.monthly_card_reports set file_key=p_payload->>'file_key',checksum=p_payload->>'checksum' where id=report_row.id;
   elsif p_action='settlement.transition' then
     if p_payload->>'status'='REVIEW' and report_row.status='DRAFT' then
       update public.monthly_card_reports set status='REVIEW' where id=report_row.id;
     elsif p_payload->>'status'='CLOSED' and report_row.status='REVIEW' and report_row.file_key is not null then
       update public.monthly_card_reports set status='CLOSED' where id=report_row.id;
     elsif p_payload->>'status'='DRAFT' and report_row.status in ('CLOSED','SENT') then
       if auth.role()<>'service_role' then perform private.require_permission('CARD_SETTLEMENT_REOPEN'); end if;
       update public.monthly_card_reports set status='DRAFT',sent_at=null,file_key=null,checksum=null where id=report_row.id;
     else raise exception 'Invalid settlement transition' using errcode='40001'; end if;
   else
     if report_row.status not in ('CLOSED','SENT') or report_row.file_key is null then raise exception 'Settlement is not closed' using errcode='40001'; end if;
     select * into setting_row from public.company_settings where key='corporate_card.settlement';
     if coalesce((setting_row.value->>'enabled')::boolean,false)=false and coalesce((p_payload->>'force')::boolean,false)=false then raise exception 'Automatic email disabled' using errcode='40001'; end if;
     if jsonb_array_length(setting_row.value->'recipients')=0 then raise exception 'No recipients configured' using errcode='22023'; end if;
     send_no:=report_row.send_generation;
     if report_row.status='SENT' then
       if coalesce((p_payload->>'resend')::boolean,false)=false then return jsonb_build_object('id',report_row.id,'message','이미 발송했습니다.'); end if;
       send_no:=send_no+1;
       update public.monthly_card_reports set status='CLOSED',sent_at=null,send_generation=send_no where id=report_row.id;
     end if;
     for recipient in select jsonb_array_elements_text(setting_row.value->'recipients') union select jsonb_array_elements_text(setting_row.value->'cc') loop
       if recipient !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Invalid recipient' using errcode='22023'; end if;
       key:='corporate-card-settlement:'||to_char(month_date,'YYYY-MM')||':g'||send_no||':'||md5(lower(recipient));
       insert into public.notification_outbox(notification_id,event_key,recipient_user_id,recipient_email,template,payload,monthly_card_report_id)
       values(null,key,null,recipient,'CORPORATE_CARD_SETTLEMENT',jsonb_build_object('title',replace(coalesce(setting_row.value->>'subject_template','Digital Square 법인카드 {month} 정산'),'{month}',to_char(month_date,'YYYY-MM')),
         'message','월 정산 내역을 첨부합니다.','report_id',report_row.id,'file_key',report_row.file_key),report_row.id)
       on conflict(event_key) do update set status=case when public.notification_outbox.status='FAILED' then 'PENDING' else public.notification_outbox.status end,
         next_attempt_at=case when public.notification_outbox.status='FAILED' then now() else public.notification_outbox.next_attempt_at end,
         max_attempts=case when public.notification_outbox.status='FAILED' then public.notification_outbox.attempt_count+5 else public.notification_outbox.max_attempts end;
     end loop;
   end if;
   return jsonb_build_object('id',report_row.id,'message','월 정산을 처리했습니다.');
 end if;
 raise exception 'Unsupported card command' using errcode='22023';
end;
$$;
create function public.corporate_card_command(p_action text,p_payload jsonb,p_request_id text default null)
returns jsonb language sql security definer set search_path='' as $$ select private.corporate_card_command(p_action,p_payload,p_request_id); $$;
grant execute on function public.corporate_card_command(text,jsonb,text) to authenticated,service_role;
revoke execute on function public.corporate_card_command(text,jsonb,text),private.corporate_card_command(text,jsonb,text) from public,anon;
revoke execute on function private.corporate_card_command(text,jsonb,text) from authenticated;

create function private.mark_card_report_sent() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.monthly_card_report_id is not null and new.status='SENT' and old.status<>'SENT' and
   not exists(select 1 from public.notification_outbox where monthly_card_report_id=new.monthly_card_report_id and id<>new.id and status<>'SENT')
 then update public.monthly_card_reports set status='SENT',sent_at=now() where id=new.monthly_card_report_id and status='CLOSED'; end if;
 return new;
end;
$$;
create trigger mark_card_report_sent after update of status on public.notification_outbox for each row execute function private.mark_card_report_sent();
revoke execute on function private.mark_card_report_sent() from public,anon,authenticated;

create function public.project_expense_summary(p_project_id uuid,p_month date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_active() or not (private.has_permission('EXPENSE_READ_ALL') or
   (private.has_permission('EXPENSE_READ_PROJECT') and exists(select 1 from public.projects where id=p_project_id and project_manager_id=auth.uid())))
 then raise exception 'Forbidden' using errcode='42501'; end if;
 select jsonb_build_object('month_amount',coalesce(sum(e.total_amount) filter(where date_trunc('month',e.transaction_date)::date=p_month),0),
   'project_amount',coalesce(sum(e.total_amount),0),
   'by_category',(select coalesce(jsonb_object_agg(category,amount),'{}'::jsonb) from(select category,sum(total_amount) amount from public.expenses where project_id=p_project_id and deleted_at is null group by category)x),
   'by_user',(select coalesce(jsonb_object_agg(u.name,x.amount),'{}'::jsonb) from(select user_id,sum(total_amount) amount from public.expenses where project_id=p_project_id and deleted_at is null group by user_id)x join public.employees u on u.id=x.user_id),
   'by_card',(select coalesce(jsonb_object_agg(c.card_name,x.amount),'{}'::jsonb) from(select corporate_card_id,sum(total_amount) amount from public.expenses where project_id=p_project_id and deleted_at is null group by corporate_card_id)x join public.corporate_cards c on c.id=x.corporate_card_id)) into result
 from public.expenses e where e.project_id=p_project_id and e.deleted_at is null;
 return result;
end;
$$;
grant execute on function public.project_expense_summary(uuid,date) to authenticated;
revoke execute on function public.project_expense_summary(uuid,date) from public,anon;
commit;
