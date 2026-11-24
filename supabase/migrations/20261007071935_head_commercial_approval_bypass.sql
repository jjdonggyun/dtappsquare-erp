begin;
create function private.head_approval_bypass() returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_permission('APPROVAL_BYPASS') and exists(
  select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id and r.active
  where ur.user_id=auth.uid() and r.code='HEAD'
 );
$$;
revoke all on function private.head_approval_bypass() from public,anon,authenticated;

create or replace function private.quotation_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 target uuid:=nullif(p_payload->>'id','')::uuid;
 target_revision_id uuid:=nullif(p_payload->>'revision_id','')::uuid;
 opportunity_id uuid:=nullif(p_payload->>'opportunity_id','')::uuid;
 q public.quotations;
 r public.quotation_revisions;
 item_row public.quotation_items;
 opp public.opportunities;
 approval_row public.approval_requests;
 step_row public.approval_request_steps;
 subject_id uuid;
 approval_id uuid;
 approver uuid;
 next_revision integer;
 output jsonb;
 content_hash text;
 existing_hash text;
 decision text;
 can_manage_all boolean:=private.has_permission('QUOTATION_READ_ALL');
begin
 if p_request_id is null or length(p_request_id) not between 16 and 100 then
  raise exception 'ValidationError' using errcode='22023';
 end if;
 perform set_config('app.request_id',p_request_id,true);
 content_hash:=encode(extensions.digest(convert_to(p_action||':'||p_payload::text,'UTF8'),'sha256'),'hex');
 select payload_hash,result into existing_hash,output from public.quotation_command_receipts
  where actor_user_id=auth.uid() and request_id=p_request_id;
 if found then
  if existing_hash<>content_hash then raise exception 'Conflict' using errcode='40001'; end if;
  return output;
 end if;

 if p_action='quotation.create' then
  perform private.require_permission('QUOTATION_MANAGE');
  select * into opp from public.opportunities where id=opportunity_id for share;
  if not found or opp.stage in ('LOST','ARCHIVED') then raise exception 'NotFound' using errcode='P0002'; end if;
  if opp.sales_owner_id<>auth.uid() and not can_manage_all then raise exception 'Forbidden' using errcode='42501'; end if;
  insert into public.quotations(customer_id,opportunity_id,created_by,updated_by)
   values(opp.customer_id,opp.id,auth.uid(),auth.uid()) returning * into q;
  insert into public.quotation_revisions(quotation_id,revision_no,project_name,quotation_date,valid_until,
   vat_rate,expected_cost,note,created_by,updated_by)
  values(q.id,1,trim(p_payload->>'project_name'),(p_payload->>'quotation_date')::date,
   (p_payload->>'valid_until')::date,coalesce((p_payload->>'vat_rate')::numeric,10),
   coalesce((p_payload->>'expected_cost')::numeric,0),coalesce(trim(p_payload->>'note'),''),auth.uid(),auth.uid())
  returning * into r;
  update public.quotations set current_revision_id=r.id,updated_by=auth.uid() where id=q.id;
  output:=jsonb_build_object('id',q.id,'revision_id',r.id,'message','견적 초안을 만들었습니다.','redirect','/quotations/'||q.id::text);

 elsif p_action='revision.save' then
  perform private.require_permission('QUOTATION_MANAGE');
  select * into r from public.quotation_revisions where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  select * into q from public.quotations where id=r.quotation_id for update;
  if not private.can_read_quotation(q.id) or (not can_manage_all and q.created_by<>auth.uid() and not exists(
   select 1 from public.opportunities o where o.id=q.opportunity_id and o.sales_owner_id=auth.uid()
  )) then raise exception 'Forbidden' using errcode='42501'; end if;
  if r.status<>'DRAFT' or r.version is distinct from (p_payload->>'version')::integer then
   raise exception 'Conflict' using errcode='40001';
  end if;
  update public.quotation_revisions set project_name=trim(p_payload->>'project_name'),
   quotation_date=(p_payload->>'quotation_date')::date,valid_until=(p_payload->>'valid_until')::date,
   vat_rate=coalesce((p_payload->>'vat_rate')::numeric,10),expected_cost=coalesce((p_payload->>'expected_cost')::numeric,0),
   note=coalesce(trim(p_payload->>'note'),''),updated_by=auth.uid() where id=r.id;
  perform private.refresh_quotation_revision(r.id);
  output:=jsonb_build_object('id',q.id,'revision_id',r.id,'message','견적 Revision을 저장했습니다.');

 elsif p_action='item.save' then
  perform private.require_permission('QUOTATION_MANAGE');
  select * into r from public.quotation_revisions where id=target_revision_id for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  select * into q from public.quotations where id=r.quotation_id for update;
  if r.status<>'DRAFT' then raise exception 'Conflict' using errcode='40001'; end if;
  if not can_manage_all and not exists(select 1 from public.opportunities o where o.id=q.opportunity_id and o.sales_owner_id=auth.uid()) then
   raise exception 'Forbidden' using errcode='42501';
  end if;
  if target is null then
   insert into public.quotation_items(revision_id,item_name,role_name,headcount,man_month,period_start,period_end,
    quantity,unit_price,note,sort_order,created_by,updated_by)
   values(r.id,trim(p_payload->>'item_name'),coalesce(trim(p_payload->>'role_name'),''),
    coalesce((p_payload->>'headcount')::integer,1),coalesce((p_payload->>'man_month')::numeric,0),
    nullif(p_payload->>'period_start','')::date,nullif(p_payload->>'period_end','')::date,
    (p_payload->>'quantity')::numeric,(p_payload->>'unit_price')::numeric,coalesce(trim(p_payload->>'note'),''),
    coalesce((p_payload->>'sort_order')::integer,0),auth.uid(),auth.uid()) returning * into item_row;
  else
   select * into item_row from public.quotation_items where id=target and revision_id=r.id for update;
   if not found then raise exception 'NotFound' using errcode='P0002'; end if;
   if item_row.version is distinct from (p_payload->>'version')::integer then raise exception 'Conflict' using errcode='40001'; end if;
   update public.quotation_items set item_name=trim(p_payload->>'item_name'),role_name=coalesce(trim(p_payload->>'role_name'),''),
    headcount=coalesce((p_payload->>'headcount')::integer,1),man_month=coalesce((p_payload->>'man_month')::numeric,0),
    period_start=nullif(p_payload->>'period_start','')::date,period_end=nullif(p_payload->>'period_end','')::date,
    quantity=(p_payload->>'quantity')::numeric,unit_price=(p_payload->>'unit_price')::numeric,
    note=coalesce(trim(p_payload->>'note'),''),sort_order=coalesce((p_payload->>'sort_order')::integer,0),
    active=true,updated_by=auth.uid() where id=item_row.id returning * into item_row;
  end if;
  perform private.refresh_quotation_revision(r.id);
  output:=jsonb_build_object('id',q.id,'item_id',item_row.id,'message','견적 항목을 저장했습니다.');

 elsif p_action='item.archive' then
  perform private.require_permission('QUOTATION_MANAGE');
  select * into item_row from public.quotation_items where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  select * into r from public.quotation_revisions where id=item_row.revision_id for update;
  select * into q from public.quotations where id=r.quotation_id for update;
  if r.status<>'DRAFT' or item_row.version is distinct from (p_payload->>'version')::integer then
   raise exception 'Conflict' using errcode='40001';
  end if;
  if not can_manage_all and not exists(select 1 from public.opportunities o where o.id=q.opportunity_id and o.sales_owner_id=auth.uid()) then
   raise exception 'Forbidden' using errcode='42501';
  end if;
  update public.quotation_items set active=false,updated_by=auth.uid() where id=item_row.id;
  perform private.refresh_quotation_revision(r.id);
  output:=jsonb_build_object('id',q.id,'message','견적 항목을 보관했습니다.');

 elsif p_action='revision.create' then
  perform private.require_permission('QUOTATION_MANAGE');
  select * into q from public.quotations where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if q.status not in ('DRAFT','REJECTED') then raise exception 'Conflict' using errcode='40001'; end if;
  if not can_manage_all and not exists(select 1 from public.opportunities o where o.id=q.opportunity_id and o.sales_owner_id=auth.uid()) then
   raise exception 'Forbidden' using errcode='42501';
  end if;
  select * into r from public.quotation_revisions where id=q.current_revision_id for update;
  next_revision:=r.revision_no+1;
  update public.quotation_revisions set status='SUPERSEDED',updated_by=auth.uid() where id=r.id;
  insert into public.quotation_revisions(quotation_id,revision_no,project_name,quotation_date,valid_until,vat_rate,
   supply_amount,vat_amount,total_amount,expected_cost,expected_profit,expected_profit_rate,note,created_by,updated_by)
  values(q.id,next_revision,r.project_name,current_date,greatest(current_date,r.valid_until),r.vat_rate,
   r.supply_amount,r.vat_amount,r.total_amount,r.expected_cost,r.expected_profit,r.expected_profit_rate,r.note,auth.uid(),auth.uid())
  returning * into r;
  insert into public.quotation_items(revision_id,item_name,role_name,headcount,man_month,period_start,period_end,
   quantity,unit_price,note,sort_order,created_by,updated_by)
  select r.id,item_name,role_name,headcount,man_month,period_start,period_end,quantity,unit_price,note,sort_order,auth.uid(),auth.uid()
   from public.quotation_items where revision_id=q.current_revision_id and active order by sort_order,id;
  update public.quotations set current_revision_id=r.id,status='DRAFT',updated_by=auth.uid() where id=q.id;
  output:=jsonb_build_object('id',q.id,'revision_id',r.id,'message','새 견적 Revision을 만들었습니다.');

 elsif p_action='quotation.submit' then
  perform private.require_permission('QUOTATION_MANAGE');
  select * into q from public.quotations where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if not can_manage_all and not exists(select 1 from public.opportunities o where o.id=q.opportunity_id and o.sales_owner_id=auth.uid()) then
   raise exception 'Forbidden' using errcode='42501';
  end if;
  select * into r from public.quotation_revisions where id=q.current_revision_id for update;
  if q.status<>'DRAFT' or r.status<>'DRAFT' or r.version is distinct from (p_payload->>'revision_version')::integer then
   raise exception 'Conflict' using errcode='40001';
  end if;
  if r.supply_amount<=0 or not exists(select 1 from public.quotation_items where revision_id=r.id and active) then
   raise exception 'ValidationError' using errcode='22023';
  end if;
  if private.head_approval_bypass() then
   approver:=auth.uid();
  else
  select e.id into approver from public.employees e
   where e.user_status='ACTIVE' and e.id<>auth.uid() and private.user_has_permission(e.id,'QUOTATION_APPROVE')
   order by case when private.user_has_permission(e.id,'FINANCE_MANAGER') then 0 else 1 end,e.created_at,e.id limit 1;
  end if;
  if approver is null then raise exception 'NotFound' using errcode='P0002'; end if;
  insert into public.approval_subjects(request_type,reference_id) values('QUOTATION',r.id) returning id into subject_id;
  insert into public.approval_requests(approval_subject_id,request_type,reference_id,requester_id,route_snapshot)
   values(subject_id,'QUOTATION',r.id,auth.uid(),jsonb_build_array(jsonb_build_object(
    'step_order',1,'approver_type','ROLE_FALLBACK','approver_id',approver))) returning id into approval_id;
  insert into public.approval_request_steps(approval_request_id,step_order,approver_type,approver_id)
   values(approval_id,1,'ROLE_FALLBACK',approver);
  update public.quotation_revisions set status='SUBMITTED',approval_subject_id=subject_id,updated_by=auth.uid() where id=r.id;
  update public.quotations set status='SUBMITTED',updated_by=auth.uid() where id=q.id;
  if approver=auth.uid() then
   update public.approval_request_steps set status='APPROVED',approved_at=now(),comment='AUTO_APPROVED_BY_POLICY'
   where approval_request_id=approval_id;
   update public.approval_requests set status='APPROVED',version=version+1,
    route_snapshot=jsonb_build_array(jsonb_build_object('policy','HEAD_BYPASS','reason','AUTO_APPROVED_BY_POLICY'))
   where id=approval_id;
   update public.quotation_revisions set status='APPROVED',updated_by=auth.uid() where id=r.id;
   update public.quotations set status='APPROVED',approved_revision_id=r.id,updated_by=auth.uid() where id=q.id;
   insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id)
   values(auth.uid(),'HEAD_BYPASS','quotation_revisions',r.id::text,
    jsonb_build_object('status','SUBMITTED'),
    jsonb_build_object('status','APPROVED','reason','AUTO_APPROVED_BY_POLICY','approval_request_id',approval_id),
    left(coalesce(p_request_id,''),100));
   output:=jsonb_build_object('id',q.id,'approval_request_id',approval_id,'message','회사 정책에 따라 견적을 자동 승인했습니다.');
  else
  perform private.enqueue_notification(approver,'QUOTATION_APPROVAL_REQUEST','견적 승인 요청',
   q.quotation_number||' 견적의 승인을 요청했습니다.','APPROVAL_REQUEST',approval_id,
   'quotation:'||r.id||':approval','quotation-approval-request');
  output:=jsonb_build_object('id',q.id,'approval_request_id',approval_id,'message','견적 승인을 요청했습니다.');
  end if;

 elsif p_action='approval.decide' then
  perform private.require_permission('QUOTATION_APPROVE');
  decision:=p_payload->>'decision';
  select * into approval_row from public.approval_requests where id=target for update;
  if not found or approval_row.request_type<>'QUOTATION' then raise exception 'NotFound' using errcode='P0002'; end if;
  if approval_row.status<>'PENDING' or approval_row.version is distinct from (p_payload->>'version')::integer then
   raise exception 'Conflict' using errcode='40001';
  end if;
  select * into step_row from public.approval_request_steps
   where approval_request_id=approval_row.id and step_order=approval_row.current_step_order for update;
  if step_row.approver_id<>auth.uid() or step_row.status<>'PENDING' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into r from public.quotation_revisions where id=approval_row.reference_id for update;
  select * into q from public.quotations where id=r.quotation_id for update;
  if not found or r.status<>'SUBMITTED' then raise exception 'Conflict' using errcode='40001'; end if;
  if decision='APPROVED' then
   update public.approval_request_steps set status='APPROVED',approved_at=now(),comment=nullif(trim(p_payload->>'comment'),'') where id=step_row.id;
   update public.approval_requests set status='APPROVED',version=version+1 where id=approval_row.id;
   update public.quotation_revisions set status='APPROVED',updated_by=auth.uid() where id=r.id;
   update public.quotations set status='APPROVED',approved_revision_id=r.id,updated_by=auth.uid() where id=q.id;
   perform private.enqueue_notification(approval_row.requester_id,'QUOTATION_APPROVED','견적 승인 완료',
    q.quotation_number||' 견적이 승인되었습니다.','QUOTATION',q.id,'quotation:'||r.id||':approved','quotation-approved');
   output:=jsonb_build_object('id',approval_row.id,'message','견적을 승인했습니다.');
  elsif decision='REJECTED' then
   update public.approval_request_steps set status='REJECTED',approved_at=now(),comment=nullif(trim(p_payload->>'comment'),'') where id=step_row.id;
   update public.approval_requests set status='REJECTED',version=version+1 where id=approval_row.id;
   update public.quotation_revisions set status='REJECTED',updated_by=auth.uid() where id=r.id;
   update public.quotations set status='REJECTED',updated_by=auth.uid() where id=q.id;
   perform private.enqueue_notification(approval_row.requester_id,'QUOTATION_REJECTED','견적 승인 반려',
    q.quotation_number||' 견적이 반려되었습니다.','QUOTATION',q.id,'quotation:'||r.id||':rejected','quotation-rejected');
   output:=jsonb_build_object('id',approval_row.id,'message','견적을 반려했습니다.');
  else
   raise exception 'ValidationError' using errcode='22023';
  end if;
 else
  raise exception 'ValidationError' using errcode='22023';
 end if;

 insert into public.quotation_command_receipts(actor_user_id,request_id,action,payload_hash,result)
 values(auth.uid(),p_request_id,p_action,content_hash,output);
 return output;
end;
$$;

create or replace function private.contract_command(p_action text,p_payload jsonb,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 target uuid:=nullif(p_payload->>'id','')::uuid;
 source_revision_id uuid:=nullif(p_payload->>'quotation_revision_id','')::uuid;
 c public.contracts;
 qr public.quotation_revisions;
 q public.quotations;
 opp public.opportunities;
 customer public.customers;
 approval_row public.approval_requests;
 step_row public.approval_request_steps;
 subject_id uuid;
 approval_id uuid;
 approver uuid;
 project_id uuid;
 manager_id uuid;
 output jsonb;
 content_hash text;
 existing_hash text;
 decision text;
 can_manage_all boolean:=private.has_permission('CONTRACT_READ_ALL');
begin
 if p_request_id is null or length(p_request_id) not between 16 and 100 then
  raise exception 'ValidationError' using errcode='22023';
 end if;
 perform set_config('app.request_id',p_request_id,true);
 content_hash:=encode(extensions.digest(convert_to(p_action||':'||p_payload::text,'UTF8'),'sha256'),'hex');
 select payload_hash,result into existing_hash,output from public.contract_command_receipts
  where actor_user_id=auth.uid() and request_id=p_request_id;
 if found then
  if existing_hash<>content_hash then raise exception 'Conflict' using errcode='40001'; end if;
  return output;
 end if;

 if p_action='contract.create' then
  perform private.require_permission('CONTRACT_MANAGE');
  select * into qr from public.quotation_revisions where id=source_revision_id and status='APPROVED' for share;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  select * into q from public.quotations where id=qr.quotation_id and approved_revision_id=qr.id and status='APPROVED' for share;
  if not found then raise exception 'Conflict' using errcode='40001'; end if;
  select * into opp from public.opportunities where id=q.opportunity_id for share;
  if opp.sales_owner_id<>auth.uid() and not can_manage_all then raise exception 'Forbidden' using errcode='42501'; end if;
  insert into public.contracts(customer_id,opportunity_id,quotation_revision_id,contract_name,purchase_order_number,
   contract_date,start_date,end_date,supply_amount,vat_rate,payment_terms,warranty_terms,note,created_by,updated_by)
  values(q.customer_id,q.opportunity_id,qr.id,trim(p_payload->>'contract_name'),
   coalesce(trim(p_payload->>'purchase_order_number'),''),(p_payload->>'contract_date')::date,
   (p_payload->>'start_date')::date,(p_payload->>'end_date')::date,
   coalesce((p_payload->>'supply_amount')::numeric,qr.supply_amount),
   coalesce((p_payload->>'vat_rate')::numeric,qr.vat_rate),coalesce(trim(p_payload->>'payment_terms'),''),
   coalesce(trim(p_payload->>'warranty_terms'),''),coalesce(trim(p_payload->>'note'),''),auth.uid(),auth.uid())
  returning * into c;
  insert into public.contract_amendments(contract_id,amendment_no,reason,snapshot,created_by)
   values(c.id,0,'최초 계약',to_jsonb(c)-'approval_subject_id',auth.uid());
  output:=jsonb_build_object('id',c.id,'message','승인 견적에서 계약 초안을 만들었습니다.','redirect','/contracts/'||c.id::text);

 elsif p_action='contract.save' then
  perform private.require_permission('CONTRACT_MANAGE');
  select * into c from public.contracts where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if not can_manage_all and not exists(select 1 from public.opportunities o where o.id=c.opportunity_id and o.sales_owner_id=auth.uid()) then
   raise exception 'Forbidden' using errcode='42501';
  end if;
  if c.status not in ('DRAFT','REJECTED') or c.version is distinct from (p_payload->>'version')::integer then
   raise exception 'Conflict' using errcode='40001';
  end if;
  insert into public.contract_amendments(contract_id,amendment_no,reason,snapshot,created_by)
   values(c.id,c.current_amendment_no+1,coalesce(nullif(trim(p_payload->>'change_reason'),''),'계약 초안 수정'),
    to_jsonb(c)-'approval_subject_id',auth.uid());
  update public.contracts set contract_name=trim(p_payload->>'contract_name'),
   purchase_order_number=coalesce(trim(p_payload->>'purchase_order_number'),''),
   contract_date=(p_payload->>'contract_date')::date,start_date=(p_payload->>'start_date')::date,
   end_date=(p_payload->>'end_date')::date,supply_amount=(p_payload->>'supply_amount')::numeric,
   vat_rate=(p_payload->>'vat_rate')::numeric,payment_terms=coalesce(trim(p_payload->>'payment_terms'),''),
   warranty_terms=coalesce(trim(p_payload->>'warranty_terms'),''),note=coalesce(trim(p_payload->>'note'),''),
   status='DRAFT',current_amendment_no=current_amendment_no+1,updated_by=auth.uid() where id=c.id;
  output:=jsonb_build_object('id',c.id,'message','계약 초안을 저장했습니다.');

 elsif p_action='contract.submit' then
  perform private.require_permission('CONTRACT_MANAGE');
  select * into c from public.contracts where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if not can_manage_all and not exists(select 1 from public.opportunities o where o.id=c.opportunity_id and o.sales_owner_id=auth.uid()) then
   raise exception 'Forbidden' using errcode='42501';
  end if;
  if c.status not in ('DRAFT','REJECTED') or c.version is distinct from (p_payload->>'version')::integer then
   raise exception 'Conflict' using errcode='40001';
  end if;
  if private.head_approval_bypass() then
   approver:=auth.uid();
  else
  select e.id into approver from public.employees e
   where e.user_status='ACTIVE' and e.id<>auth.uid() and private.user_has_permission(e.id,'CONTRACT_APPROVE')
   order by e.created_at,e.id limit 1;
  end if;
  if approver is null then raise exception 'NotFound' using errcode='P0002'; end if;
  insert into public.approval_subjects(request_type,reference_id) values('CONTRACT',c.id) returning id into subject_id;
  insert into public.approval_requests(approval_subject_id,request_type,reference_id,requester_id,route_snapshot)
   values(subject_id,'CONTRACT',c.id,auth.uid(),jsonb_build_array(jsonb_build_object(
    'step_order',1,'approver_type','ROLE_FALLBACK','approver_id',approver))) returning id into approval_id;
  insert into public.approval_request_steps(approval_request_id,step_order,approver_type,approver_id)
   values(approval_id,1,'ROLE_FALLBACK',approver);
  update public.contracts set status='SUBMITTED',approval_subject_id=subject_id,updated_by=auth.uid() where id=c.id;
  if approver=auth.uid() then
   update public.approval_request_steps set status='APPROVED',approved_at=now(),comment='AUTO_APPROVED_BY_POLICY'
   where approval_request_id=approval_id;
   update public.approval_requests set status='APPROVED',version=version+1,
    route_snapshot=jsonb_build_array(jsonb_build_object('policy','HEAD_BYPASS','reason','AUTO_APPROVED_BY_POLICY'))
   where id=approval_id;
   update public.contracts set status='APPROVED',updated_by=auth.uid() where id=c.id;
   insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id)
   values(auth.uid(),'HEAD_BYPASS','contracts',c.id::text,
    jsonb_build_object('status','SUBMITTED'),
    jsonb_build_object('status','APPROVED','reason','AUTO_APPROVED_BY_POLICY','approval_request_id',approval_id),
    left(coalesce(p_request_id,''),100));
   output:=jsonb_build_object('id',c.id,'approval_request_id',approval_id,'message','회사 정책에 따라 계약을 자동 승인했습니다.');
  else
  perform private.enqueue_notification(approver,'CONTRACT_APPROVAL_REQUEST','계약 승인 요청',
   c.contract_number||' 계약의 승인을 요청했습니다.','APPROVAL_REQUEST',approval_id,
   'contract:'||c.id||':approval','contract-approval-request');
  output:=jsonb_build_object('id',c.id,'approval_request_id',approval_id,'message','계약 승인을 요청했습니다.');
  end if;

 elsif p_action='approval.decide' then
  perform private.require_permission('CONTRACT_APPROVE');
  decision:=p_payload->>'decision';
  select * into approval_row from public.approval_requests where id=target for update;
  if not found or approval_row.request_type<>'CONTRACT' then raise exception 'NotFound' using errcode='P0002'; end if;
  if approval_row.status<>'PENDING' or approval_row.version is distinct from (p_payload->>'version')::integer then
   raise exception 'Conflict' using errcode='40001';
  end if;
  select * into step_row from public.approval_request_steps
   where approval_request_id=approval_row.id and step_order=approval_row.current_step_order for update;
  if step_row.approver_id<>auth.uid() or step_row.status<>'PENDING' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into c from public.contracts where id=approval_row.reference_id for update;
  if not found or c.status<>'SUBMITTED' then raise exception 'Conflict' using errcode='40001'; end if;
  if decision='APPROVED' then
   update public.approval_request_steps set status='APPROVED',approved_at=now(),comment=nullif(trim(p_payload->>'comment'),'') where id=step_row.id;
   update public.approval_requests set status='APPROVED',version=version+1 where id=approval_row.id;
   update public.contracts set status='APPROVED',updated_by=auth.uid() where id=c.id;
   perform private.enqueue_notification(approval_row.requester_id,'CONTRACT_APPROVED','계약 승인 완료',
    c.contract_number||' 계약이 승인되었습니다.','CONTRACT',c.id,'contract:'||c.id||':approved','contract-approved');
   output:=jsonb_build_object('id',approval_row.id,'message','계약을 승인했습니다.');
  elsif decision='REJECTED' then
   update public.approval_request_steps set status='REJECTED',approved_at=now(),comment=nullif(trim(p_payload->>'comment'),'') where id=step_row.id;
   update public.approval_requests set status='REJECTED',version=version+1 where id=approval_row.id;
   update public.contracts set status='REJECTED',updated_by=auth.uid() where id=c.id;
   perform private.enqueue_notification(approval_row.requester_id,'CONTRACT_REJECTED','계약 승인 반려',
    c.contract_number||' 계약이 반려되었습니다.','CONTRACT',c.id,'contract:'||c.id||':rejected','contract-rejected');
   output:=jsonb_build_object('id',approval_row.id,'message','계약을 반려했습니다.');
  else
   raise exception 'ValidationError' using errcode='22023';
  end if;

 elsif p_action='contract.sign' then
  perform private.require_permission('CONTRACT_MANAGE');
  select * into c from public.contracts where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if not can_manage_all and not exists(select 1 from public.opportunities o where o.id=c.opportunity_id and o.sales_owner_id=auth.uid()) then
   raise exception 'Forbidden' using errcode='42501';
  end if;
  if c.status<>'APPROVED' or c.version is distinct from (p_payload->>'version')::integer then
   raise exception 'Conflict' using errcode='40001';
  end if;
  update public.contracts set status='SIGNED',signed_date=(p_payload->>'signed_date')::date,updated_by=auth.uid() where id=c.id;
  output:=jsonb_build_object('id',c.id,'message','계약 서명을 확정했습니다.');

 elsif p_action='contract.create_project' then
  perform private.require_permission('CONTRACT_MANAGE');
  select * into c from public.contracts where id=target for update;
  if not found then raise exception 'NotFound' using errcode='P0002'; end if;
  if not can_manage_all and not exists(select 1 from public.opportunities o where o.id=c.opportunity_id and o.sales_owner_id=auth.uid()) then
   raise exception 'Forbidden' using errcode='42501';
  end if;
  if c.status not in ('SIGNED','ACTIVE') then raise exception 'Conflict' using errcode='40001'; end if;
  select id into project_id from public.projects where contract_id=c.id;
  if project_id is null then
   manager_id:=(p_payload->>'project_manager_id')::uuid;
   if not exists(select 1 from public.employees where id=manager_id and user_status='ACTIVE') then
    raise exception 'NotFound' using errcode='P0002';
   end if;
   select * into customer from public.customers where id=c.customer_id;
   select * into opp from public.opportunities where id=c.opportunity_id;
   insert into public.projects(project_code,project_name,customer_name,customer_id,description,planned_start_date,
    planned_end_date,status,project_manager_id,created_by,contract_id,opportunity_id,quotation_revision_id,sales_owner_id)
   values(upper(trim(p_payload->>'project_code')),c.contract_name,customer.name,c.customer_id,
    nullif(trim(p_payload->>'description'),''),c.start_date,c.end_date,'PLANNING',manager_id,auth.uid(),
    c.id,c.opportunity_id,c.quotation_revision_id,opp.sales_owner_id) returning id into project_id;
   update public.contracts set status='ACTIVE',updated_by=auth.uid() where id=c.id;
  end if;
  output:=jsonb_build_object('id',c.id,'project_id',project_id,'message','계약에서 프로젝트를 생성했습니다.',
   'redirect','/admin/projects/'||project_id::text);
 else
  raise exception 'ValidationError' using errcode='22023';
 end if;

 insert into public.contract_command_receipts(actor_user_id,request_id,action,payload_hash,result)
 values(auth.uid(),p_request_id,p_action,content_hash,output);
 return output;
end;
$$;

commit;
