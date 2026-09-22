begin;
create policy expense_receipts_delete on storage.objects for delete to authenticated using(bucket_id='expense-receipts' and private.can_write_expense(split_part(name,'/',1)::uuid));
create function public.card_settlement_setting() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_active() or not private.has_permission('CARD_SETTLEMENT_MANAGE') then raise exception 'Forbidden' using errcode='42501'; end if;
 select jsonb_build_object('value',value,'version',version,'updated_at',updated_at) into result from public.company_settings where key='corporate_card.settlement';
 return result;
end;
$$;
create function public.card_settlement_delivery(p_report_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_active() or not private.has_permission('CARD_SETTLEMENT_READ') then raise exception 'Forbidden' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'recipient_email',o.recipient_email,'status',o.status,
   'attempt_count',o.attempt_count,'last_error_code',o.last_error_code,'created_at',o.created_at,'updated_at',o.updated_at,
   'recent_attempt',(select jsonb_build_object('attempt',a.attempt,'status',a.status,'error_code',a.error_code,'attempted_at',a.attempted_at)
       from public.email_delivery_attempts a where a.outbox_id=o.id order by a.attempt desc limit 1)) order by o.created_at desc),'[]'::jsonb)
 into result from public.notification_outbox o where o.monthly_card_report_id=p_report_id;
 return result;
end;
$$;
grant execute on function public.card_settlement_setting(),public.card_settlement_delivery(uuid) to authenticated;
revoke execute on function public.card_settlement_setting(),public.card_settlement_delivery(uuid) from public,anon;
commit;
