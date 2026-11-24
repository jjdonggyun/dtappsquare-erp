begin;

create function public.dashboard_summary()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb:='{}'::jsonb;
declare contract_total numeric; month_contract numeric;
declare billing_total numeric; month_billing numeric; month_revenue numeric;
declare outstanding numeric; overdue_amount numeric; overdue_count integer;
declare payment_total numeric; month_payment numeric;
declare active_projects integer; delayed_projects integer;
declare pipeline_count integer; pipeline_amount numeric;
declare active_staff integer; allocated_staff numeric; checked_in integer; on_leave integer;
declare pending_signup integer; pending_approval integer; unissued_tax integer;
begin
 if not private.is_active() then raise exception using errcode='42501',message='Forbidden'; end if;

 if private.has_permission('CONTRACT_READ_ALL') then
  select coalesce(sum(total_amount),0),
   coalesce(sum(total_amount) filter(where date_trunc('month',signed_date)=date_trunc('month',current_date)),0)
  into contract_total,month_contract from public.contracts
  where status in ('SIGNED','ACTIVE','COMPLETED');
  result:=result||jsonb_build_object('contractTotal',contract_total,'monthContract',month_contract);
 end if;

 if private.has_permission('BILLING_READ_ALL') then
  select coalesce(sum(b.total_amount),0),
   coalesce(sum(b.total_amount) filter(where date_trunc('month',b.billing_date)=date_trunc('month',current_date)),0),
   coalesce(sum(b.supply_amount) filter(where date_trunc('month',b.billing_date)=date_trunc('month',current_date)),0),
   coalesce(sum(greatest(b.total_amount-coalesce(pa.paid,0),0)),0),
   coalesce(sum(greatest(b.total_amount-coalesce(pa.paid,0),0)) filter(where b.due_date<current_date),0),
   count(*) filter(where b.due_date<current_date and b.total_amount>coalesce(pa.paid,0))
  into billing_total,month_billing,month_revenue,outstanding,overdue_amount,overdue_count
  from public.billings b
  left join lateral (
   select sum(a.amount) paid from public.payment_allocations a
   join public.payments p on p.id=a.payment_id and p.status='CONFIRMED'
   where a.billing_id=b.id
  ) pa on true
  where b.status not in ('DRAFT','CANCELED');
  result:=result||jsonb_build_object('billingTotal',billing_total,'monthBilling',month_billing,
   'monthRevenue',month_revenue,'outstanding',outstanding,'overdueAmount',overdue_amount,
   'overdueCount',overdue_count);
 end if;

 if private.has_permission('PAYMENT_READ_ALL') then
  select coalesce(sum(amount),0),
   coalesce(sum(amount) filter(where date_trunc('month',received_date)=date_trunc('month',current_date)),0)
  into payment_total,month_payment from public.payments where status='CONFIRMED';
  result:=result||jsonb_build_object('paymentTotal',payment_total,'monthPayment',month_payment);
 end if;

 if private.has_permission('PROJECT_READ_ALL') then
  select count(*) filter(where status='IN_PROGRESS'),
   count(*) filter(where planned_end_date<current_date and status in ('PLANNING','SCHEDULED','IN_PROGRESS','ON_HOLD'))
  into active_projects,delayed_projects from public.projects where archived_at is null;
  result:=result||jsonb_build_object('activeProjects',active_projects,'delayedProjects',delayed_projects);
 end if;

 if private.has_permission('OPPORTUNITY_READ_ALL') then
  select count(*),coalesce(sum(expected_revenue),0)
  into pipeline_count,pipeline_amount from public.opportunities
  where stage in ('LEAD','PROPOSAL','QUOTATION','NEGOTIATION') and archived_at is null;
  result:=result||jsonb_build_object('pipelineCount',pipeline_count,'pipelineAmount',pipeline_amount);
 end if;

 if private.has_permission('USER_READ') then
  select count(*) into active_staff from public.employees where user_status='ACTIVE';
  result:=result||jsonb_build_object('activeStaff',active_staff);
  if private.has_permission('RESOURCE_READ') then
   select coalesce(sum(least(allocation,100)),0) into allocated_staff from (
    select a.user_id,sum(a.allocation_rate) allocation from public.project_assignments a
    where current_date between a.planned_start_date and a.planned_end_date
     and a.status in ('PLANNED','CONFIRMED','IN_PROGRESS')
    group by a.user_id
   ) allocations;
   result:=result||jsonb_build_object('utilizationPercent',
    case when active_staff>0 then round(allocated_staff/active_staff,1) else 0 end);
  end if;
 end if;

 if private.has_permission('ATTENDANCE_MANAGE') then
  select count(*) filter(where check_in_at is not null),
   count(*) filter(where attendance_status in ('VACATION','HALF_DAY'))
  into checked_in,on_leave from public.attendance_daily_summaries where work_date=current_date;
  result:=result||jsonb_build_object('checkedIn',checked_in,'onLeave',on_leave);
 end if;

 if private.has_scope('USER_APPROVE','ALL') or exists(
  select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id and r.active
  where ur.user_id=auth.uid() and r.code in ('ADMIN','HR_MANAGER')
 ) then
  select count(*) into pending_signup from public.employees where user_status='REQUESTED';
  result:=result||jsonb_build_object('pendingSignup',pending_signup);
 end if;

 if private.has_permission('APPROVAL_MANAGE') then
  select count(*) into pending_approval from public.approval_requests
   where status='PENDING' and created_at<now()-interval '3 days';
  result:=result||jsonb_build_object('delayedApprovals',pending_approval);
 end if;

 if private.has_permission('TAX_INVOICE_READ_ALL') then
  select count(*) into unissued_tax from public.billings b
  where b.status in ('BILLED','PARTIALLY_PAID','PAID')
   and not exists(select 1 from public.tax_invoices t where t.billing_id=b.id and t.status='ISSUED');
  result:=result||jsonb_build_object('unissuedTaxInvoices',unissued_tax);
 end if;
 return result;
end;
$$;
revoke all on function public.dashboard_summary() from public,anon;
grant execute on function public.dashboard_summary() to authenticated;

commit;
