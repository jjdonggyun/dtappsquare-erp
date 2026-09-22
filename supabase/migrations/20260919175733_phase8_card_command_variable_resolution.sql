begin;
create or replace function private.corporate_card_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare card_row public.corporate_cards; assignment_row public.project_card_assignments; expense_row public.expenses;
 report_row public.monthly_card_reports; setting_row public.company_settings; target uuid; month_date date;
 rows_json jsonb; calc_count integer; calc_supply numeric; calc_vat numeric; calc_amount numeric;
 recipient text; send_no integer; event_key_value text; report_exists boolean;
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
       event_key_value:='corporate-card-settlement:'||to_char(month_date,'YYYY-MM')||':g'||send_no||':'||md5(lower(recipient));
       insert into public.notification_outbox(notification_id,event_key,recipient_user_id,recipient_email,template,payload,monthly_card_report_id)
       values(null,event_key_value,null,recipient,'CORPORATE_CARD_SETTLEMENT',jsonb_build_object('title',replace(coalesce(setting_row.value->>'subject_template','Digital Square 법인카드 {month} 정산'),'{month}',to_char(month_date,'YYYY-MM')),
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

commit;
