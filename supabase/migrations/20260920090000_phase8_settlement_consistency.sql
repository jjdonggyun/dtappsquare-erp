begin;

-- Use the same per-month lock as settlement.generate for every expense change.
-- This also closes the gap where a concurrent insert could commit after the
-- settlement snapshot was checked but before CLOSED became visible.
create or replace function private.validate_expense() returns trigger language plpgsql security definer set search_path='' as $$
declare new_month date:=date_trunc('month',new.transaction_date)::date;
declare old_month date;
begin
 if tg_op='UPDATE' then old_month:=date_trunc('month',old.transaction_date)::date; end if;
 if old_month is not null and old_month<new_month then
   perform pg_advisory_xact_lock(hashtextextended('corporate-card-settlement:'||old_month::text,0));
   perform pg_advisory_xact_lock(hashtextextended('corporate-card-settlement:'||new_month::text,0));
 else
   perform pg_advisory_xact_lock(hashtextextended('corporate-card-settlement:'||new_month::text,0));
   if old_month is not null and old_month<>new_month then
     perform pg_advisory_xact_lock(hashtextextended('corporate-card-settlement:'||old_month::text,0));
   end if;
 end if;
 if not exists(select 1 from public.project_card_assignments a where a.project_id=new.project_id and a.corporate_card_id=new.corporate_card_id
   and new.transaction_date>=a.assigned_from and (a.assigned_to is null or new.transaction_date<=a.assigned_to))
 then raise exception 'Card is not assigned to this project on transaction date' using errcode='22023'; end if;
 if exists(select 1 from public.monthly_card_reports r where r.settlement_month=new_month and r.status in ('CLOSED','SENT'))
 then raise exception 'Settlement month is closed' using errcode='40001'; end if;
 if old_month is not null and old_month<>new_month and exists(select 1 from public.monthly_card_reports r where r.settlement_month=old_month and r.status in ('CLOSED','SENT'))
 then raise exception 'Settlement month is closed' using errcode='40001'; end if;
 return new;
end;
$$;

create function private.assert_settlement_snapshot_current() returns trigger language plpgsql security definer set search_path='' as $$
declare current_entries jsonb;
begin
 if new.status='CLOSED' and old.status='REVIEW' then
   select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'transaction_date',e.transaction_date,'project_code',p.project_code,
       'project_name',p.project_name,'card',c.card_name||' •••• '||c.last_four,'user_name',u.name,'merchant',e.merchant,
       'purpose',e.purpose,'category',e.category,'supply_amount',e.supply_amount,'vat_amount',e.vat_amount,'total_amount',e.total_amount,'memo',e.memo)
       order by e.transaction_date,e.created_at,e.id),'[]'::jsonb) into current_entries
     from public.expenses e join public.projects p on p.id=e.project_id join public.corporate_cards c on c.id=e.corporate_card_id
     join public.employees u on u.id=e.user_id
     where e.transaction_date>=new.settlement_month and e.transaction_date<(new.settlement_month+interval '1 month')::date and e.deleted_at is null;
   if current_entries is distinct from new.entries_snapshot then
     raise exception 'Settlement snapshot is stale; regenerate Excel before closing' using errcode='40001';
   end if;
 end if;
 return new;
end;
$$;
create trigger assert_settlement_snapshot_current before update of status on public.monthly_card_reports
 for each row execute function private.assert_settlement_snapshot_current();
revoke execute on function private.assert_settlement_snapshot_current() from public,anon,authenticated;

-- An internal identifier is not a payment card number.
alter table public.corporate_cards add constraint corporate_cards_identifier_not_pan
 check(identifier !~ '^[[:digit:]]{12,19}$');

commit;
