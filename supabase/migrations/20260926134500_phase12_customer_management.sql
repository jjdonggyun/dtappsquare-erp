begin;

insert into public.permissions(code,description) values
 ('CUSTOMER_READ','고객사와 담당자 조회'),
 ('CUSTOMER_MANAGE','고객사와 담당자 관리')
on conflict(code) do update set description=excluded.description;

insert into public.roles(code,name,system) values('SALES','영업 담당',true)
on conflict(code) do update set name=excluded.name,active=true;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (r.code in ('ADMIN','SALES') and p.code in ('CUSTOMER_READ','CUSTOMER_MANAGE'))
   or (r.code in ('PROJECT_MANAGER','FINANCE_MANAGER') and p.code='CUSTOMER_READ')
   or (r.code='SALES' and p.code='PROJECT_READ_ALL')
on conflict do nothing;

create table public.customers (
 id uuid primary key default gen_random_uuid(),
 customer_code text not null unique check(customer_code ~ '^[A-Z0-9_-]{2,40}$'),
 name text not null check(length(trim(name)) between 1 and 160),
 business_registration_number text,
 representative_name text,
 address text not null default '',
 business_type text not null default '',
 business_item text not null default '',
 billing_contact_name text not null default '',
 billing_email text,
 payment_terms text not null default '',
 default_payment_terms text not null default '',
 note text not null default '',
 status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE','ARCHIVED')),
 archived_at timestamptz,
 created_by uuid not null references public.employees(id) on delete restrict,
 updated_by uuid not null references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(business_registration_number is null or business_registration_number ~ '^[0-9]{10}$'),
 check((status='ARCHIVED')=(archived_at is not null))
);
create unique index customers_business_registration_unique
 on public.customers(business_registration_number) where business_registration_number is not null;
create index customers_name_search on public.customers(lower(name));
create index customers_status_updated on public.customers(status,updated_at desc);

create table public.customer_contacts (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.customers(id) on delete restrict,
 name text not null check(length(trim(name)) between 1 and 100),
 department text not null default '',
 position text not null default '',
 phone text not null default '',
 email text,
 contact_type text not null default 'GENERAL' check(contact_type in ('GENERAL','BILLING','CONTRACT','PROJECT')),
 is_primary boolean not null default false,
 active boolean not null default true,
 created_by uuid not null references public.employees(id) on delete restrict,
 updated_by uuid not null references public.employees(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index customer_contacts_primary_type
 on public.customer_contacts(customer_id,contact_type) where active and is_primary;
create index customer_contacts_customer_active on public.customer_contacts(customer_id,active,name);

create table public.customer_command_receipts (
 actor_user_id uuid not null references public.employees(id) on delete restrict,
 request_id text not null check(length(request_id) between 16 and 100),
 action text not null,
 payload_hash text not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(actor_user_id,request_id)
);

alter table public.projects add column customer_id uuid references public.customers(id) on delete restrict;
create index projects_customer_id on public.projects(customer_id) where customer_id is not null;

create trigger touch_customers before update on public.customers
 for each row execute function private.touch_versioned_row();
create trigger touch_customer_contacts before update on public.customer_contacts
 for each row execute function private.touch_versioned_row();
create trigger audit_customers after insert or update on public.customers
 for each row execute function private.capture_audit();
create trigger audit_customer_contacts after insert or update on public.customer_contacts
 for each row execute function private.capture_audit();

alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.customer_command_receipts enable row level security;

create policy customers_read on public.customers for select to authenticated using(
 private.is_active() and (private.has_permission('CUSTOMER_READ') or private.has_permission('CUSTOMER_MANAGE'))
);
create policy customer_contacts_read on public.customer_contacts for select to authenticated using(
 private.is_active() and (private.has_permission('CUSTOMER_READ') or private.has_permission('CUSTOMER_MANAGE'))
);

create function private.customer_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 target uuid:=nullif(p_payload->>'id','')::uuid;
 parent uuid:=nullif(p_payload->>'customer_id','')::uuid;
 row_version integer;
 output jsonb;
 content_hash text;
 existing_hash text;
 normalized_registration text;
 contact_kind text;
begin
 perform private.require_permission('CUSTOMER_MANAGE');
 if p_request_id is null or length(p_request_id) not between 16 and 100 then
  raise exception 'ValidationError' using errcode='22023';
 end if;
 perform set_config('app.request_id',p_request_id,true);
 content_hash:=encode(extensions.digest(convert_to(p_action||':'||p_payload::text,'UTF8'),'sha256'),'hex');
 select payload_hash,result into existing_hash,output from public.customer_command_receipts
  where actor_user_id=auth.uid() and request_id=p_request_id;
 if found then
  if existing_hash<>content_hash then raise exception 'Conflict' using errcode='40001'; end if;
  return output;
 end if;

 if p_action='customer.save' then
  normalized_registration:=nullif(regexp_replace(coalesce(p_payload->>'business_registration_number',''),'[^0-9]','','g'),'');
  if normalized_registration is not null and length(normalized_registration)<>10 then
   raise exception 'ValidationError' using errcode='22023';
  end if;
  if target is null then
   insert into public.customers(customer_code,name,business_registration_number,representative_name,address,
    business_type,business_item,billing_contact_name,billing_email,payment_terms,default_payment_terms,note,status,
    created_by,updated_by)
   values(upper(trim(p_payload->>'customer_code')),trim(p_payload->>'name'),normalized_registration,
    nullif(trim(p_payload->>'representative_name'),''),coalesce(trim(p_payload->>'address'),''),
    coalesce(trim(p_payload->>'business_type'),''),coalesce(trim(p_payload->>'business_item'),''),
    coalesce(trim(p_payload->>'billing_contact_name'),''),nullif(lower(trim(p_payload->>'billing_email')),''),
    coalesce(trim(p_payload->>'payment_terms'),''),coalesce(trim(p_payload->>'default_payment_terms'),''),
    coalesce(trim(p_payload->>'note'),''),coalesce(p_payload->>'status','ACTIVE'),auth.uid(),auth.uid())
   returning id into target;
  else
   select version into row_version from public.customers where id=target for update;
   if not found then raise exception 'NotFound' using errcode='P0002'; end if;
   if row_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   if exists(select 1 from public.customers where id=target and status='ARCHIVED') then
    raise exception 'Conflict' using errcode='40001';
   end if;
   update public.customers set customer_code=upper(trim(p_payload->>'customer_code')),name=trim(p_payload->>'name'),
    business_registration_number=normalized_registration,representative_name=nullif(trim(p_payload->>'representative_name'),''),
    address=coalesce(trim(p_payload->>'address'),''),business_type=coalesce(trim(p_payload->>'business_type'),''),
    business_item=coalesce(trim(p_payload->>'business_item'),''),billing_contact_name=coalesce(trim(p_payload->>'billing_contact_name'),''),
    billing_email=nullif(lower(trim(p_payload->>'billing_email')),''),payment_terms=coalesce(trim(p_payload->>'payment_terms'),''),
    default_payment_terms=coalesce(trim(p_payload->>'default_payment_terms'),''),note=coalesce(trim(p_payload->>'note'),''),
    status=coalesce(p_payload->>'status','ACTIVE'),updated_by=auth.uid() where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','고객사를 저장했습니다.','redirect','/customers/'||target::text);

 elsif p_action='customer.archive' then
  select version into row_version from public.customers where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if row_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
  update public.customers set status='ARCHIVED',archived_at=now(),updated_by=auth.uid() where id=target;
  update public.customer_contacts set active=false,is_primary=false,updated_by=auth.uid() where customer_id=target and active;
  output:=jsonb_build_object('id',target,'message','고객사를 보관했습니다.','redirect','/customers');

 elsif p_action='contact.save' then
  if parent is null or not exists(select 1 from public.customers where id=parent and status<>'ARCHIVED') then
   raise exception 'NotFound' using errcode='P0002';
  end if;
  contact_kind:=coalesce(p_payload->>'contact_type','GENERAL');
  if coalesce((p_payload->>'is_primary')::boolean,false) then
   update public.customer_contacts set is_primary=false,updated_by=auth.uid()
    where customer_id=parent and contact_type=contact_kind and active and is_primary and (target is null or id<>target);
  end if;
  if target is null then
   insert into public.customer_contacts(customer_id,name,department,position,phone,email,contact_type,is_primary,active,
    created_by,updated_by)
   values(parent,trim(p_payload->>'name'),coalesce(trim(p_payload->>'department'),''),
    coalesce(trim(p_payload->>'position'),''),coalesce(trim(p_payload->>'phone'),''),
    nullif(lower(trim(p_payload->>'email')),''),contact_kind,coalesce((p_payload->>'is_primary')::boolean,false),
    coalesce((p_payload->>'active')::boolean,true),auth.uid(),auth.uid()) returning id into target;
  else
   select version into row_version from public.customer_contacts where id=target and customer_id=parent for update;
   if not found then raise exception 'NotFound' using errcode='P0002'; end if;
   if row_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   update public.customer_contacts set name=trim(p_payload->>'name'),department=coalesce(trim(p_payload->>'department'),''),
    position=coalesce(trim(p_payload->>'position'),''),phone=coalesce(trim(p_payload->>'phone'),''),
    email=nullif(lower(trim(p_payload->>'email')),''),contact_type=contact_kind,
    is_primary=coalesce((p_payload->>'is_primary')::boolean,false),active=coalesce((p_payload->>'active')::boolean,true),
    updated_by=auth.uid() where id=target;
  end if;
  output:=jsonb_build_object('id',target,'message','고객 담당자를 저장했습니다.');

 elsif p_action='contact.archive' then
  select version into row_version from public.customer_contacts where id=target and customer_id=parent for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if row_version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
  update public.customer_contacts set active=false,is_primary=false,updated_by=auth.uid() where id=target;
  output:=jsonb_build_object('id',target,'message','고객 담당자를 보관했습니다.');
 else
  raise exception 'ValidationError' using errcode='22023';
 end if;

 insert into public.customer_command_receipts(actor_user_id,request_id,action,payload_hash,result)
 values(auth.uid(),p_request_id,p_action,content_hash,output);
 return output;
end;
$$;

create function public.customer_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language sql volatile security definer set search_path='' as $$
 select private.customer_command(p_action,p_payload,p_request_id);
$$;

revoke execute on function private.customer_command(text,jsonb,text) from public,anon,authenticated;
revoke execute on function public.customer_command(text,jsonb,text) from public,anon;
grant execute on function public.customer_command(text,jsonb,text) to authenticated;

commit;
