begin;

insert into public.permissions(code,description) values
 ('PROJECT_DOCUMENT_READ','프로젝트 문서 조회'),
 ('PROJECT_DOCUMENT_MANAGE','프로젝트 문서 등록 및 보관'),
 ('PROJECT_INSPECTION_READ','프로젝트 검수 조회'),
 ('PROJECT_INSPECTION_MANAGE','프로젝트 검수 등록 및 수정'),
 ('PROJECT_RATE_READ','프로젝트 투입 단가 조회'),
 ('PROJECT_RATE_MANAGE','프로젝트 투입 MM 및 단가 관리'),
 ('EMPLOYEE_COST_RATE_READ','직원 원가 기준 조회'),
 ('EMPLOYEE_COST_RATE_MANAGE','직원 원가 기준 관리')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (r.code='ADMIN' and p.code in (
  'PROJECT_DOCUMENT_READ','PROJECT_DOCUMENT_MANAGE','PROJECT_INSPECTION_READ','PROJECT_INSPECTION_MANAGE',
  'PROJECT_RATE_READ','PROJECT_RATE_MANAGE','EMPLOYEE_COST_RATE_READ','EMPLOYEE_COST_RATE_MANAGE'))
 or (r.code='PROJECT_MANAGER' and p.code in (
  'PROJECT_DOCUMENT_READ','PROJECT_DOCUMENT_MANAGE','PROJECT_INSPECTION_READ','PROJECT_INSPECTION_MANAGE',
  'PROJECT_RATE_READ','PROJECT_RATE_MANAGE'))
 or (r.code='FINANCE_MANAGER' and p.code in (
  'PROJECT_DOCUMENT_READ','PROJECT_INSPECTION_READ','PROJECT_RATE_READ','PROJECT_RATE_MANAGE',
  'EMPLOYEE_COST_RATE_READ','EMPLOYEE_COST_RATE_MANAGE'))
 or (r.code in ('SALES','EMPLOYEE') and p.code in ('PROJECT_DOCUMENT_READ','PROJECT_INSPECTION_READ'))
on conflict do nothing;

alter table public.project_assignments
 add column planned_mm numeric(10,2) check(planned_mm is null or planned_mm>=0);

create table public.employee_cost_rates (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.employees(id) on delete restrict,
 effective_from date not null,
 effective_to date,
 monthly_cost_rate numeric(18,2) not null check(monthly_cost_rate>=0),
 note text not null default '' check(length(note)<=1000),
 created_by uuid not null references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(effective_to is null or effective_to>=effective_from),
 unique(user_id,effective_from)
);
create index employee_cost_rates_user_period on public.employee_cost_rates(user_id,effective_from desc,effective_to);

create table public.project_assignment_rates (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.project_assignments(id) on delete restrict,
 snapshot_no integer not null check(snapshot_no>0),
 planned_mm numeric(10,2) not null check(planned_mm>=0),
 monthly_cost_rate numeric(18,2) not null check(monthly_cost_rate>=0),
 monthly_billing_rate numeric(18,2) not null check(monthly_billing_rate>=0),
 source_employee_cost_rate_id uuid references public.employee_cost_rates(id) on delete restrict,
 reason text not null default '' check(length(reason)<=1000),
 created_by uuid not null references public.employees(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(assignment_id,snapshot_no)
);
create index project_assignment_rates_assignment on public.project_assignment_rates(assignment_id,snapshot_no desc);

create table public.documents (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 1 and 200),
 category text not null check(category in ('CONTRACT','QUOTATION','DELIVERABLE','INSPECTION','REPORT','OTHER')),
 file_name text not null check(length(trim(file_name)) between 1 and 255),
 storage_key text not null unique check(length(storage_key) between 10 and 600),
 mime_type text not null check(length(mime_type) between 3 and 120),
 size_bytes bigint not null check(size_bytes>0 and size_bytes<=52428800),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 document_version integer not null default 1 check(document_version>0),
 previous_document_id uuid references public.documents(id) on delete restrict,
 uploaded_by uuid not null references public.employees(id) on delete restrict,
 archived_at timestamptz,
 created_at timestamptz not null default now()
);
create index documents_previous on public.documents(previous_document_id) where previous_document_id is not null;
create index documents_category_created on public.documents(category,created_at desc);

create table public.customer_document_links (
 customer_id uuid not null references public.customers(id) on delete restrict,
 document_id uuid not null references public.documents(id) on delete restrict,
 created_at timestamptz not null default now(),
 primary key(customer_id,document_id)
);
create table public.quotation_document_links (
 quotation_id uuid not null references public.quotations(id) on delete restrict,
 document_id uuid not null references public.documents(id) on delete restrict,
 created_at timestamptz not null default now(),
 primary key(quotation_id,document_id)
);
create table public.contract_document_links (
 contract_id uuid not null references public.contracts(id) on delete restrict,
 document_id uuid not null references public.documents(id) on delete restrict,
 created_at timestamptz not null default now(),
 primary key(contract_id,document_id)
);
create table public.project_document_links (
 project_id uuid not null references public.projects(id) on delete restrict,
 document_id uuid not null references public.documents(id) on delete restrict,
 created_at timestamptz not null default now(),
 primary key(project_id,document_id)
);
create index customer_document_links_document on public.customer_document_links(document_id);
create index quotation_document_links_document on public.quotation_document_links(document_id);
create index contract_document_links_document on public.contract_document_links(document_id);
create index project_document_links_document on public.project_document_links(document_id);

create table public.inspections (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete restrict,
 milestone_id uuid references public.project_milestones(id) on delete restrict,
 document_id uuid references public.documents(id) on delete restrict,
 inspection_type text not null default 'DELIVERY' check(inspection_type in ('DELIVERY','MILESTONE','QUALITY','ACCEPTANCE','OTHER')),
 title text not null check(length(trim(title)) between 1 and 200),
 requested_date date,
 scheduled_date date,
 completed_date date,
 customer_contact_name text not null default '' check(length(customer_contact_name)<=120),
 customer_contact_email text not null default '' check(length(customer_contact_email)<=254),
 status text not null default 'DRAFT' check(status in ('DRAFT','REQUESTED','SCHEDULED','COMPLETED','CANCELED')),
 result text not null default 'PENDING' check(result in ('PENDING','PASSED','CONDITIONAL','FAILED','WAIVED')),
 note text not null default '' check(length(note)<=4000),
 created_by uuid not null references public.employees(id) on delete restrict,
 updated_by uuid not null references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(scheduled_date is null or requested_date is null or scheduled_date>=requested_date),
 check(completed_date is null or scheduled_date is null or completed_date>=scheduled_date),
 check(status<>'COMPLETED' or completed_date is not null),
 check(status='COMPLETED' or result='PENDING')
);
create index inspections_project_status on public.inspections(project_id,status,scheduled_date);
create index inspections_milestone on public.inspections(milestone_id) where milestone_id is not null;

create table public.project_hub_command_receipts (
 actor_user_id uuid not null references public.employees(id) on delete restrict,
 request_id text not null check(length(request_id) between 16 and 100),
 action text not null,
 payload_hash text not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(actor_user_id,request_id)
);

create trigger touch_employee_cost_rates before update on public.employee_cost_rates
 for each row execute function private.touch_versioned_row();
create trigger touch_inspections before update on public.inspections
 for each row execute function private.touch_versioned_row();
create trigger audit_employee_cost_rates after insert or update on public.employee_cost_rates
 for each row execute function private.capture_audit();
create trigger audit_project_assignment_rates after insert on public.project_assignment_rates
 for each row execute function private.capture_audit();
create trigger audit_documents after insert or update on public.documents
 for each row execute function private.capture_audit();
create trigger audit_inspections after insert or update on public.inspections
 for each row execute function private.capture_audit();

alter table public.employee_cost_rates enable row level security;
alter table public.project_assignment_rates enable row level security;
alter table public.documents enable row level security;
alter table public.customer_document_links enable row level security;
alter table public.quotation_document_links enable row level security;
alter table public.contract_document_links enable row level security;
alter table public.project_document_links enable row level security;
alter table public.inspections enable row level security;
alter table public.project_hub_command_receipts enable row level security;

create function private.can_manage_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(
  select 1 from public.projects p where p.id=p_project_id and (
   private.has_permission('PROJECT_READ_ALL') or p.project_manager_id=auth.uid()
  )
 );
$$;

create function private.can_read_document(p_document_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and private.has_permission('PROJECT_DOCUMENT_READ') and (
  exists(select 1 from public.project_document_links l where l.document_id=p_document_id and private.can_read_project(l.project_id))
  or exists(select 1 from public.customer_document_links l where l.document_id=p_document_id and
   (private.has_permission('CUSTOMER_READ') or private.has_permission('CUSTOMER_MANAGE')))
  or exists(select 1 from public.quotation_document_links l where l.document_id=p_document_id and private.can_read_quotation(l.quotation_id))
  or exists(select 1 from public.contract_document_links l where l.document_id=p_document_id and private.can_read_contract(l.contract_id))
 );
$$;

create function private.can_manage_document(p_document_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and private.has_permission('PROJECT_DOCUMENT_MANAGE') and exists(
  select 1 from public.project_document_links l where l.document_id=p_document_id and private.can_manage_project(l.project_id)
 );
$$;

create policy employee_cost_rates_read on public.employee_cost_rates for select to authenticated using(
 private.is_active() and (private.has_permission('EMPLOYEE_COST_RATE_READ') or private.has_permission('EMPLOYEE_COST_RATE_MANAGE'))
);
create policy project_assignment_rates_read on public.project_assignment_rates for select to authenticated using(
 (private.has_permission('PROJECT_RATE_READ') or private.has_permission('PROJECT_RATE_MANAGE')) and exists(
  select 1 from public.project_assignments a where a.id=assignment_id and private.can_read_project(a.project_id)
 )
);
create policy documents_read on public.documents for select to authenticated using(private.can_read_document(id));
create policy customer_document_links_read on public.customer_document_links for select to authenticated using(private.can_read_document(document_id));
create policy quotation_document_links_read on public.quotation_document_links for select to authenticated using(private.can_read_document(document_id));
create policy contract_document_links_read on public.contract_document_links for select to authenticated using(private.can_read_document(document_id));
create policy project_document_links_read on public.project_document_links for select to authenticated using(private.can_read_document(document_id));
create policy inspections_read on public.inspections for select to authenticated using(
 private.has_permission('PROJECT_INSPECTION_READ') and private.can_read_project(project_id)
);

grant select on public.employee_cost_rates,public.project_assignment_rates,public.documents,
 public.customer_document_links,public.quotation_document_links,public.contract_document_links,
 public.project_document_links,public.inspections to authenticated;
revoke insert,update,delete on public.employee_cost_rates,public.project_assignment_rates,public.documents,
 public.customer_document_links,public.quotation_document_links,public.contract_document_links,
 public.project_document_links,public.inspections from public,anon,authenticated;
revoke all on public.project_hub_command_receipts from public,anon,authenticated;
revoke execute on function private.can_manage_project(uuid),private.can_read_document(uuid),private.can_manage_document(uuid) from public,anon;
grant execute on function private.can_manage_project(uuid),private.can_read_document(uuid),private.can_manage_document(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('project-documents','project-documents',false,52428800,array[
  'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png','image/webp'
 ]) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy project_documents_read on storage.objects for select to authenticated using(
 bucket_id='project-documents' and private.can_read_project(split_part(name,'/',1)::uuid)
);
create policy project_documents_insert on storage.objects for insert to authenticated with check(
 bucket_id='project-documents' and private.has_permission('PROJECT_DOCUMENT_MANAGE') and private.can_manage_project(split_part(name,'/',1)::uuid)
);
create policy project_documents_delete on storage.objects for delete to authenticated using(
 bucket_id='project-documents' and private.has_permission('PROJECT_DOCUMENT_MANAGE') and private.can_manage_project(split_part(name,'/',1)::uuid)
);

create function private.project_hub_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 target uuid:=nullif(p_payload->>'id','')::uuid;
 target_project_id uuid:=nullif(p_payload->>'project_id','')::uuid;
 assignment_row public.project_assignments;
 inspection_row public.inspections;
 previous_document public.documents;
 document_row public.documents;
 source_rate uuid:=nullif(p_payload->>'source_employee_cost_rate_id','')::uuid;
 snapshot_no integer;
 existing_hash text;
 content_hash text;
 output jsonb;
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='28000'; end if;
 if p_request_id is null or length(p_request_id) not between 16 and 100 then raise exception 'ValidationError' using errcode='22023'; end if;
 perform set_config('app.request_id',p_request_id,true);
 content_hash:=encode(extensions.digest(convert_to(p_action||':'||p_payload::text,'UTF8'),'sha256'),'hex');
 select payload_hash,result into existing_hash,output from public.project_hub_command_receipts
  where actor_user_id=auth.uid() and request_id=p_request_id;
 if found then
  if existing_hash<>content_hash then raise exception 'Conflict' using errcode='40001'; end if;
  return output;
 end if;

 if p_action='employee.cost_rate.save' then
  perform private.require_permission('EMPLOYEE_COST_RATE_MANAGE');
  if not exists(select 1 from public.employees where id=(p_payload->>'user_id')::uuid and user_status='ACTIVE') then
   raise exception 'NotFound' using errcode='P0002';
  end if;
  if exists(select 1 from public.employee_cost_rates r where r.user_id=(p_payload->>'user_id')::uuid
    and daterange(r.effective_from,coalesce(r.effective_to,'infinity'::date),'[]') &&
        daterange((p_payload->>'effective_from')::date,coalesce(nullif(p_payload->>'effective_to','')::date,'infinity'::date),'[]')) then
   raise exception 'Conflict' using errcode='40001';
  end if;
  insert into public.employee_cost_rates(user_id,effective_from,effective_to,monthly_cost_rate,note,created_by)
  values((p_payload->>'user_id')::uuid,(p_payload->>'effective_from')::date,nullif(p_payload->>'effective_to','')::date,
   (p_payload->>'monthly_cost_rate')::numeric,coalesce(trim(p_payload->>'note'),''),auth.uid()) returning id into target;
  output:=jsonb_build_object('id',target,'message','직원 원가 기준을 저장했습니다.');

 elsif p_action='assignment.rate.snapshot' then
  perform private.require_permission('PROJECT_RATE_MANAGE');
  select * into assignment_row from public.project_assignments where id=(p_payload->>'assignment_id')::uuid for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if not private.can_manage_project(assignment_row.project_id) then raise exception 'Forbidden' using errcode='42501'; end if;
  if source_rate is not null and not exists(select 1 from public.employee_cost_rates r where r.id=source_rate and r.user_id=assignment_row.user_id) then
   raise exception 'NotFound' using errcode='P0002';
  end if;
  select coalesce(max(r.snapshot_no),0)+1 into snapshot_no from public.project_assignment_rates r where r.assignment_id=assignment_row.id;
  insert into public.project_assignment_rates(assignment_id,snapshot_no,planned_mm,monthly_cost_rate,monthly_billing_rate,
   source_employee_cost_rate_id,reason,created_by)
  values(assignment_row.id,snapshot_no,(p_payload->>'planned_mm')::numeric,(p_payload->>'monthly_cost_rate')::numeric,
   (p_payload->>'monthly_billing_rate')::numeric,source_rate,coalesce(trim(p_payload->>'reason'),''),auth.uid()) returning id into target;
  update public.project_assignments set planned_mm=(p_payload->>'planned_mm')::numeric where id=assignment_row.id;
  output:=jsonb_build_object('id',target,'snapshot_no',snapshot_no,'message','투입 MM과 단가 Snapshot을 저장했습니다.');

 elsif p_action='document.register' then
  perform private.require_permission('PROJECT_DOCUMENT_MANAGE');
  if not private.can_manage_project(target_project_id) then raise exception 'Forbidden' using errcode='42501'; end if;
  if position(target_project_id::text||'/' in p_payload->>'storage_key')<>1 then raise exception 'ValidationError' using errcode='22023'; end if;
  if target is not null then
   select * into previous_document from public.documents where id=target for share;
   if not found or not private.can_manage_document(target) then raise exception 'NotFound' using errcode='P0002'; end if;
  end if;
  insert into public.documents(title,category,file_name,storage_key,mime_type,size_bytes,sha256,document_version,previous_document_id,uploaded_by)
  values(trim(p_payload->>'title'),p_payload->>'category',trim(p_payload->>'file_name'),p_payload->>'storage_key',p_payload->>'mime_type',
   (p_payload->>'size_bytes')::bigint,p_payload->>'sha256',coalesce(previous_document.document_version,0)+1,target,auth.uid()) returning * into document_row;
  insert into public.project_document_links(project_id,document_id) values(target_project_id,document_row.id);
  output:=jsonb_build_object('id',document_row.id,'message','프로젝트 문서를 등록했습니다.');

 elsif p_action='document.archive' then
  perform private.require_permission('PROJECT_DOCUMENT_MANAGE');
  if not private.can_manage_document(target) then raise exception 'Forbidden' using errcode='42501'; end if;
  update public.documents set archived_at=coalesce(archived_at,now()) where id=target;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  output:=jsonb_build_object('id',target,'message','문서를 보관 처리했습니다.');

 elsif p_action='inspection.save' then
  perform private.require_permission('PROJECT_INSPECTION_MANAGE');
  if not private.can_manage_project(target_project_id) then raise exception 'Forbidden' using errcode='42501'; end if;
  if nullif(p_payload->>'milestone_id','') is not null and not exists(
   select 1 from public.project_milestones m where m.id=(p_payload->>'milestone_id')::uuid and m.project_id=target_project_id) then
   raise exception 'NotFound' using errcode='P0002';
  end if;
  if nullif(p_payload->>'document_id','') is not null and not exists(
   select 1 from public.project_document_links l where l.document_id=(p_payload->>'document_id')::uuid and l.project_id=target_project_id) then
   raise exception 'NotFound' using errcode='P0002';
  end if;
  if target is null then
   insert into public.inspections(project_id,milestone_id,document_id,inspection_type,title,requested_date,scheduled_date,completed_date,
    customer_contact_name,customer_contact_email,status,result,note,created_by,updated_by)
   values(target_project_id,nullif(p_payload->>'milestone_id','')::uuid,nullif(p_payload->>'document_id','')::uuid,p_payload->>'inspection_type',
    trim(p_payload->>'title'),nullif(p_payload->>'requested_date','')::date,nullif(p_payload->>'scheduled_date','')::date,
    nullif(p_payload->>'completed_date','')::date,coalesce(trim(p_payload->>'customer_contact_name'),''),
    coalesce(trim(p_payload->>'customer_contact_email'),''),p_payload->>'status',p_payload->>'result',coalesce(trim(p_payload->>'note'),''),auth.uid(),auth.uid())
   returning id into target;
  else
   select * into inspection_row from public.inspections where id=target for update;
   if not found or inspection_row.project_id<>target_project_id then raise exception 'NotFound' using errcode='P0002'; end if;
   if inspection_row.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   update public.inspections set milestone_id=nullif(p_payload->>'milestone_id','')::uuid,
    document_id=nullif(p_payload->>'document_id','')::uuid,inspection_type=p_payload->>'inspection_type',title=trim(p_payload->>'title'),
    requested_date=nullif(p_payload->>'requested_date','')::date,scheduled_date=nullif(p_payload->>'scheduled_date','')::date,
    completed_date=nullif(p_payload->>'completed_date','')::date,customer_contact_name=coalesce(trim(p_payload->>'customer_contact_name'),''),
    customer_contact_email=coalesce(trim(p_payload->>'customer_contact_email'),''),status=p_payload->>'status',result=p_payload->>'result',
    note=coalesce(trim(p_payload->>'note'),''),updated_by=auth.uid() where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','검수 정보를 저장했습니다.');
 else
  raise exception 'ValidationError' using errcode='22023';
 end if;

 insert into public.project_hub_command_receipts(actor_user_id,request_id,action,payload_hash,result)
 values(auth.uid(),p_request_id,p_action,content_hash,output);
 return output;
end;
$$;

create function public.project_hub_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language sql volatile security definer set search_path='' as $$
 select private.project_hub_command(p_action,p_payload,p_request_id);
$$;
revoke execute on function private.project_hub_command(text,jsonb,text) from public,anon,authenticated;
revoke execute on function public.project_hub_command(text,jsonb,text) from public,anon;
grant execute on function public.project_hub_command(text,jsonb,text) to authenticated;

commit;
