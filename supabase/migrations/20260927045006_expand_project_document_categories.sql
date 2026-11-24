begin;

alter table public.documents drop constraint documents_category_check;
alter table public.documents add constraint documents_category_check check(category in (
  'RFP','PROPOSAL','QUOTATION','CONTRACT','PURCHASE_ORDER','BUSINESS_REGISTRATION',
  'KICKOFF','PROJECT_PLAN','WEEKLY_REPORT','MONTHLY_REPORT','CHANGE_REQUEST',
  'DELIVERABLE','INSPECTION','COMPLETION_REPORT','TRANSACTION_STATEMENT',
  'BILLING','TAX_INVOICE','REPORT','OTHER'
));

create unique index documents_single_successor
 on public.documents(previous_document_id) where previous_document_id is not null;

create function private.validate_project_document_version_link()
returns trigger language plpgsql security definer set search_path='' as $$
declare previous_id uuid;
begin
 select previous_document_id into previous_id from public.documents where id=new.document_id;
 if previous_id is not null and not exists(
  select 1 from public.project_document_links l
  where l.project_id=new.project_id and l.document_id=previous_id
 ) then
  raise exception 'ValidationError' using errcode='22023';
 end if;
 return new;
end;
$$;

create function private.archive_previous_project_document()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.documents
 set archived_at=coalesce(archived_at,now())
 where id=(select previous_document_id from public.documents where id=new.document_id);
 return new;
end;
$$;

create trigger validate_project_document_version_link
 before insert on public.project_document_links
 for each row execute function private.validate_project_document_version_link();
create trigger archive_previous_project_document
 after insert on public.project_document_links
 for each row execute function private.archive_previous_project_document();

revoke execute on function private.validate_project_document_version_link(),
 private.archive_previous_project_document() from public,anon,authenticated;

commit;
