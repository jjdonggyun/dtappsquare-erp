begin;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where r.code='FINANCE_MANAGER' and p.code in ('PROJECT_READ_ALL','USER_READ','PROFILE_READ_SELF')
on conflict do nothing;
drop policy corporate_cards_read on public.corporate_cards;
create policy corporate_cards_read on public.corporate_cards for select to authenticated using(private.is_active() and
 (private.has_permission('CORPORATE_CARD_READ') or exists(select 1 from public.project_card_assignments a where a.corporate_card_id=id and private.can_read_project(a.project_id))));
create or replace function private.mark_card_report_sent() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.monthly_card_report_id is not null and new.template='CORPORATE_CARD_SETTLEMENT' and new.status='SENT' and old.status<>'SENT' and
   not exists(select 1 from public.notification_outbox where monthly_card_report_id=new.monthly_card_report_id and template='CORPORATE_CARD_SETTLEMENT' and id<>new.id and status<>'SENT')
 then update public.monthly_card_reports set status='SENT',sent_at=now() where id=new.monthly_card_report_id and status='CLOSED'; end if;
 return new;
end;
$$;
create function public.card_settlement_test_email(p_report_id uuid,p_email text,p_request_id text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare report_row public.monthly_card_reports; target uuid;
begin
 perform private.require_permission('CARD_SETTLEMENT_SEND');
 if p_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Invalid email' using errcode='22023'; end if;
 select * into report_row from public.monthly_card_reports where id=p_report_id;
 if not found or report_row.file_key is null then raise exception 'Excel is required' using errcode='40001'; end if;
 perform set_config('app.request_id',left(coalesce(p_request_id,''),100),true);
 insert into public.notification_outbox(notification_id,event_key,recipient_user_id,recipient_email,template,payload,monthly_card_report_id)
 values(null,'corporate-card-settlement-test:'||gen_random_uuid(),null,p_email,'CORPORATE_CARD_SETTLEMENT_TEST',
   jsonb_build_object('title','[테스트] Digital Square 법인카드 '||to_char(report_row.settlement_month,'YYYY-MM')||' 정산',
    'message','정산 테스트 메일입니다. 실제 정산 발송 상태에는 반영되지 않습니다.','report_id',report_row.id,'file_key',report_row.file_key),report_row.id)
 returning id into target;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id)
 values(auth.uid(),'TEST_EMAIL','monthly_card_reports',report_row.id,null,jsonb_build_object('recipient',p_email,'outbox_id',target),nullif(current_setting('app.request_id',true),''));
 return jsonb_build_object('id',target,'message','테스트 메일을 Outbox에 등록했습니다.');
end;
$$;
grant execute on function public.card_settlement_test_email(uuid,text,text) to authenticated;
revoke execute on function public.card_settlement_test_email(uuid,text,text) from public,anon;
commit;
