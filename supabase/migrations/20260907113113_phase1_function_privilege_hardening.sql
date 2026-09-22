begin;
-- Supabase may explicitly grant anon through global default privileges.
-- Schema-scoped default REVOKE does not override global function EXECUTE.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('private','public') and p.proname in
 ('is_active','has_permission','manages_organization','account_context','employee_directory','capture_audit','touch_row','on_auth_user_created','sync_auth_email','require_permission','management_command') loop
  execute format('revoke execute on function %s from public,anon',f.signature);
 end loop;
end $$;
commit;
