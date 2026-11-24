begin;

insert into public.permissions(code,description) values ('ORGANIZATION_READ','조직도 조회') on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='MEMBER' and p.code='ORGANIZATION_READ' on conflict do nothing;
insert into public.role_permission_scopes(role_id,permission_id,data_scope)
select r.id,p.id,'TEAM' from public.roles r cross join public.permissions p
where r.code='TEAM_LEADER' and p.code='EXPENSE_READ_PROJECT' on conflict do nothing;

drop policy organization_read on public.organizations;
create policy organization_read on public.organizations for select to authenticated using(
 (select private.is_active()) and (
  (select private.has_permission('ORGANIZATION_READ'))
  or (select private.has_permission('ORGANIZATION_MANAGE'))
 )
);
create or replace function private.employee_directory()
returns table(id uuid,name text,organization_id uuid,position_id uuid,title_id uuid)
language sql stable security definer set search_path='' as $$
 select e.id,e.name,e.organization_id,e.position_id,e.title_id from public.employees e
 where private.is_active() and (
  private.has_permission('ORGANIZATION_READ') or private.has_permission('USER_READ')
  or private.has_permission('USER_READ_TEAM')
 ) and e.user_status='ACTIVE' order by e.name,e.id limit 1000;
$$;

-- A role grant with an ALL suffix must actually have ALL scope; never silently widen it.
alter function private.user_permission_command(uuid,text,text,text,text) rename to user_permission_command_legacy;
create function private.user_permission_command(p_user_id uuid,p_permission_code text,p_action text,p_data_scope text,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_action='grant' and (
  p_permission_code like '%\_ALL' escape '\' or p_permission_code in ('USER_READ','EMPLOYEE_COST_READ')
 ) and p_data_scope<>'ALL' then
  raise exception using errcode='22023',message='ALL scope is required for this permission';
 end if;
 return private.user_permission_command_legacy(p_user_id,p_permission_code,p_action,p_data_scope,p_request_id);
end; $$;
revoke all on function private.user_permission_command_legacy(uuid,text,text,text,text),
 private.user_permission_command(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function private.user_permission_command(uuid,text,text,text,text) to authenticated;

-- Check the target scope before the legacy management command changes employee status.
alter function private.management_command(text,jsonb,text) rename to management_command_scope_legacy;
create function private.management_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target_org uuid;
begin
 if p_action='employee.status' and p_payload->>'status'='ACTIVE' then
  select coalesce(nullif(p_payload->>'organization_id','')::uuid,e.organization_id)
   into target_org from public.employees e where e.id=(p_payload->>'id')::uuid;
  if not (
   private.has_scope('USER_APPROVE','ALL')
   or (private.has_scope('USER_APPROVE','TEAM') and private.manages_organization(target_org))
   or exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id and r.active
    where ur.user_id=auth.uid() and r.code in ('ADMIN','HR_MANAGER'))
  ) then raise exception using errcode='42501',message='Forbidden'; end if;
 end if;
 return private.management_command_scope_legacy(p_action,p_payload,p_request_id);
end; $$;
revoke all on function private.management_command_scope_legacy(text,jsonb,text),
 private.management_command(text,jsonb,text) from public,anon,authenticated;
grant execute on function private.management_command(text,jsonb,text) to authenticated;

create or replace function private.can_read_expense(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.is_active() and exists(
  select 1 from public.expenses e where e.id=p_id and e.deleted_at is null and (
   (e.user_id=auth.uid() and private.has_permission('EXPENSE_READ_SELF'))
   or private.has_permission('EXPENSE_READ_ALL')
   or (private.has_permission('EXPENSE_READ_PROJECT') and private.can_read_project(e.project_id))
  )
 );
$$;
drop policy project_card_assignments_read on public.project_card_assignments;
create policy project_card_assignments_read on public.project_card_assignments for select to authenticated using(
 private.is_active() and (
  private.has_permission('CORPORATE_CARD_MANAGE')
  or (private.has_permission('EXPENSE_READ_PROJECT') and private.can_read_project(project_id))
 )
);

create or replace function public.project_expense_summary(p_project_id uuid,p_month date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_active() or not (
  private.has_permission('EXPENSE_READ_ALL')
  or (private.has_permission('EXPENSE_READ_PROJECT') and private.can_read_project(p_project_id))
 ) then raise exception 'Forbidden' using errcode='42501'; end if;
 select jsonb_build_object(
  'month_amount',coalesce(sum(e.total_amount) filter(where date_trunc('month',e.transaction_date)::date=p_month),0),
  'project_amount',coalesce(sum(e.total_amount),0),
  'by_category',(select coalesce(jsonb_object_agg(category,amount),'{}'::jsonb) from
   (select category,sum(total_amount) amount from public.expenses where project_id=p_project_id and deleted_at is null group by category)x),
  'by_user',(select coalesce(jsonb_object_agg(u.name,x.amount),'{}'::jsonb) from
   (select user_id,sum(total_amount) amount from public.expenses where project_id=p_project_id and deleted_at is null group by user_id)x
   join public.employees u on u.id=x.user_id),
  'by_card',(select coalesce(jsonb_object_agg(c.card_name,x.amount),'{}'::jsonb) from
   (select corporate_card_id,sum(total_amount) amount from public.expenses where project_id=p_project_id and deleted_at is null group by corporate_card_id)x
   join public.corporate_cards c on c.id=x.corporate_card_id)
 ) into result from public.expenses e where e.project_id=p_project_id and e.deleted_at is null;
 return result;
end; $$;

commit;
