begin;

create function private.derive_quotation_revision_financials()
returns trigger language plpgsql set search_path='' as $$
begin
 new.vat_amount:=round(new.supply_amount*new.vat_rate/100,2);
 new.total_amount:=new.supply_amount+new.vat_amount;
 new.expected_profit:=new.supply_amount-new.expected_cost;
 new.expected_profit_rate:=case when new.supply_amount=0 then 0
  else round(new.expected_profit*100/new.supply_amount,4) end;
 return new;
end;
$$;

create trigger derive_quotation_revision_financials
 before insert or update of supply_amount,vat_rate,expected_cost on public.quotation_revisions
 for each row execute function private.derive_quotation_revision_financials();

revoke execute on function private.derive_quotation_revision_financials() from public,anon,authenticated;

commit;
