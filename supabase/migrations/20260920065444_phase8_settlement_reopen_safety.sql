begin;
create function private.prepare_settlement_reopen() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status in ('CLOSED','SENT') and new.status='DRAFT' then
   if exists(select 1 from public.notification_outbox where monthly_card_report_id=old.id and template='CORPORATE_CARD_SETTLEMENT' and status in ('PENDING','PROCESSING'))
   then raise exception 'Pending settlement email must finish before reopening' using errcode='40001'; end if;
   new.send_generation:=old.send_generation+1;
 end if;
 return new;
end;
$$;
create trigger prepare_settlement_reopen before update of status on public.monthly_card_reports for each row execute function private.prepare_settlement_reopen();
revoke execute on function private.prepare_settlement_reopen() from public,anon,authenticated;
commit;
