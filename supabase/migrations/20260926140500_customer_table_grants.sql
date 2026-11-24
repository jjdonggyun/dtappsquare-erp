begin;

grant select on table public.customers,public.customer_contacts to authenticated;
revoke insert,update,delete,truncate,references,trigger
 on table public.customers,public.customer_contacts from anon,authenticated;
revoke all on table public.customer_command_receipts from public,anon,authenticated;

commit;
