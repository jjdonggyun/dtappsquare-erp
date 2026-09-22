begin;

-- The Phase 11 command accepts sparse profile updates. Keep birth date on
-- ordinary self edits, and never allow a self-service RPC call to alter it.
create function private.protect_workforce_birthdate() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_permission('WORKFORCE_PROFILE_MANAGE') then
  if tg_op='INSERT' then new.birth_date:=null;
  else new.birth_date:=old.birth_date; end if;
 end if;
 return new;
end;
$$;
create trigger protect_birthdate before insert or update on public.workforce_profiles
for each row execute function private.protect_workforce_birthdate();

-- Profile pages must check scope even when the employee has no profile row yet.
create function public.workforce_profile_access(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.can_read_workforce_profile(p_user_id);
$$;
revoke execute on function public.workforce_profile_access(uuid) from public,anon;
grant execute on function public.workforce_profile_access(uuid) to authenticated;

commit;
