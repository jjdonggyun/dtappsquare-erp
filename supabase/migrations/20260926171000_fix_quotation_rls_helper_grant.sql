begin;

revoke execute on function private.can_read_quotation(uuid) from public,anon;
grant execute on function private.can_read_quotation(uuid) to authenticated;

commit;
