-- Public security-invoker RPCs delegate to these private, permission-checking functions.
grant execute on function private.management_command(text,jsonb,text) to authenticated;
grant execute on function private.user_permission_command(uuid,text,text,text,text) to authenticated;
