begin;
revoke execute on function private.bump_device_token_version() from public,anon,authenticated;
commit;
