begin;

-- RLS expressions run as the querying role even when the helper itself is SECURITY DEFINER.
grant execute on function private.has_scope(text,text) to authenticated;

drop policy employee_read on public.employees;
create policy employee_read on public.employees for select to authenticated using (
 (select private.is_active()) and (
  id=(select auth.uid())
  or (select private.has_permission('USER_READ'))
  or (
   user_status='ACTIVE'
   and (select private.has_scope('USER_READ_TEAM','TEAM'))
   and private.manages_organization(organization_id)
  )
  or (
   user_status='REQUESTED'
   and (
    (select private.has_scope('USER_APPROVE','ALL'))
    or ((select private.has_scope('USER_APPROVE','TEAM'))
      and private.manages_organization(organization_id))
   )
  )
 )
);

commit;
