begin;

create function private.record_approval_rejection() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.status='REJECTED' then
  if length(trim(coalesce(new.comment,'')))<2 then
   raise exception using errcode='22023',message='Rejection reason is required';
  end if;
  new.rejected_at:=coalesce(new.rejected_at,new.approved_at,now());
 end if;
 return new;
end; $$;
create trigger approval_rejection_details before insert or update of status,comment
on public.approval_request_steps for each row execute function private.record_approval_rejection();
revoke all on function private.record_approval_rejection() from public,anon,authenticated;

-- Historical records did not have a separate rejection timestamp or mandatory comment.
update public.approval_request_steps set
 rejected_at=coalesce(rejected_at,approved_at,created_at),
 comment=case when length(trim(coalesce(comment,'')))<2 then '이전 반려 사유 미기록' else comment end
where status='REJECTED';
alter table public.approval_request_steps validate constraint approval_step_rejection_reason;

drop policy roles_read on public.roles;
create policy roles_read on public.roles for select to authenticated using((select private.has_permission('RBAC_MANAGE')));
drop policy permissions_read on public.permissions;
create policy permissions_read on public.permissions for select to authenticated using((select private.has_permission('RBAC_MANAGE')));
drop policy role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions for select to authenticated using((select private.has_permission('RBAC_MANAGE')));
drop policy role_inheritance_read on public.role_inheritance;
create policy role_inheritance_read on public.role_inheritance for select to authenticated using((select private.has_permission('RBAC_MANAGE')));
drop policy role_permission_scopes_read on public.role_permission_scopes;
create policy role_permission_scopes_read on public.role_permission_scopes for select to authenticated using((select private.has_permission('RBAC_MANAGE')));
drop policy positions_read on public.positions;
create policy positions_read on public.positions for select to authenticated using((select private.has_permission('ORGANIZATION_READ')));
drop policy titles_read on public.titles;
create policy titles_read on public.titles for select to authenticated using((select private.has_permission('ORGANIZATION_READ')));

alter function private.expense_finance_command(text,jsonb,text) rename to expense_finance_command_legacy;
create function private.expense_finance_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare output jsonb; target uuid; current_status text;
begin
 output:=private.expense_finance_command_legacy(p_action,p_payload,p_request_id);
 if p_action='expense.submit' and private.has_permission('APPROVAL_BYPASS')
  and exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id and r.active
   where ur.user_id=auth.uid() and r.code='HEAD') then
  target=(p_payload->>'id')::uuid;
  select approval_status into current_status from public.expenses where id=target for update;
  if current_status='SUBMITTED' then
   update public.expenses set approval_status='APPROVED',reviewed_at=now(),reviewed_by=auth.uid(),rejection_reason=''
   where id=target;
   insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id)
   values(auth.uid(),'HEAD_BYPASS','expenses',target::text,
    jsonb_build_object('approval_status','SUBMITTED'),
    jsonb_build_object('approval_status','APPROVED','reason','AUTO_APPROVED_BY_POLICY'),
    left(coalesce(p_request_id,''),100));
  end if;
  return jsonb_build_object('id',target,'message','회사 정책에 따라 비용을 자동 승인했습니다.');
 end if;
 return output;
end; $$;
revoke all on function private.expense_finance_command_legacy(text,jsonb,text),
 private.expense_finance_command(text,jsonb,text) from public,anon,authenticated;

commit;
