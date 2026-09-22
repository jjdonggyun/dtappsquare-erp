begin;
revoke execute on function private.protect_workforce_birthdate() from public,anon,authenticated;
commit;
