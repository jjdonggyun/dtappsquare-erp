begin;
create function public.work_log_daily_status(p_date date)
returns table(user_id uuid,name text,organization_id uuid,entry_count integer,total_minutes integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not (private.has_permission('WORK_LOG_READ_SELF') or private.has_permission('WORK_LOG_READ_TEAM') or private.has_permission('WORK_LOG_READ_ALL')) then raise exception 'Forbidden' using errcode='42501'; end if;
 return query select e.id,e.name,e.organization_id,count(l.id)::integer,coalesce(sum(l.work_minutes),0)::integer
 from public.employees e left join public.daily_work_logs l on l.user_id=e.id and l.work_date=p_date and l.deleted_at is null
 where e.user_status='ACTIVE' and (private.has_permission('WORK_LOG_READ_ALL') or
   (private.has_permission('WORK_LOG_READ_TEAM') and private.manages_organization(e.organization_id)) or
   (private.has_permission('WORK_LOG_READ_SELF') and e.id=auth.uid()))
 group by e.id,e.name,e.organization_id order by e.name;
end;
$$;
create function public.card_month_amount(p_month date) returns numeric language plpgsql stable security definer set search_path='' as $$
declare result numeric;
begin
 perform private.require_permission('EXPENSE_READ_ALL');
 select coalesce(sum(total_amount),0) into result from public.expenses where transaction_date>=p_month and transaction_date<(p_month+interval '1 month')::date and deleted_at is null;
 return result;
end;
$$;
grant execute on function public.work_log_daily_status(date),public.card_month_amount(date) to authenticated;
revoke execute on function public.work_log_daily_status(date),public.card_month_amount(date) from public,anon;

create function private.notify_weekly_report_confirmed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status<>'CONFIRMED' and new.status='CONFIRMED' then
   insert into public.notifications(user_id,type,title,message,reference_type,reference_id,event_key)
   values(new.user_id,'WEEKLY_REPORT_CONFIRMED','주간보고 확정','주간보고가 확정되었습니다.','weekly_reports',new.id,'weekly-report-confirmed:'||new.id)
   on conflict(event_key) do nothing;
 end if;
 return new;
end;
$$;
create trigger notify_weekly_report_confirmed after update of status on public.weekly_reports for each row execute function private.notify_weekly_report_confirmed();

create function private.notify_card_settlement_state() returns trigger language plpgsql security definer set search_path='' as $$
declare person record;
begin
 if new.status='CLOSED' and old.status<>'CLOSED' then
   for person in select id from public.employees where user_status='ACTIVE' and private.user_has_permission(id,'CARD_SETTLEMENT_MANAGE') loop
     insert into public.notifications(user_id,type,title,message,reference_type,reference_id,event_key)
     values(person.id,'CARD_SETTLEMENT_READY','법인카드 정산 준비',to_char(new.settlement_month,'YYYY-MM')||' 정산이 마감되었습니다. 발송 상태를 확인해 주세요.',
       'monthly_card_reports',new.id,'card-settlement-ready:'||new.id||':'||person.id) on conflict(event_key) do nothing;
   end loop;
 end if;
 return new;
end;
$$;
create trigger notify_card_settlement_state after update of status on public.monthly_card_reports for each row execute function private.notify_card_settlement_state();

create function private.notify_card_email_failed() returns trigger language plpgsql security definer set search_path='' as $$
declare person record;
begin
 if new.monthly_card_report_id is not null and new.status='FAILED' and old.status<>'FAILED' and new.template='CORPORATE_CARD_SETTLEMENT' then
   for person in select id from public.employees where user_status='ACTIVE' and private.user_has_permission(id,'CARD_SETTLEMENT_MANAGE') loop
     insert into public.notifications(user_id,type,title,message,reference_type,reference_id,event_key)
     values(person.id,'CARD_SETTLEMENT_EMAIL_FAILED','법인카드 정산 메일 실패','정산 메일 발송이 실패했습니다. 월 정산 화면에서 재처리해 주세요.',
       'monthly_card_reports',new.monthly_card_report_id,'card-settlement-email-failed:'||new.id||':'||person.id) on conflict(event_key) do nothing;
   end loop;
 end if;
 return new;
end;
$$;
create trigger notify_card_email_failed after update of status on public.notification_outbox for each row execute function private.notify_card_email_failed();
revoke execute on function private.notify_weekly_report_confirmed(),private.notify_card_settlement_state(),private.notify_card_email_failed() from public,anon,authenticated;
commit;
