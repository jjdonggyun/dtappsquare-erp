begin;
create function public.attendance_verification_setting()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_active() or not private.has_permission('ATTENDANCE_VERIFICATION_READ')
 then raise exception 'Forbidden' using errcode='42501'; end if;
 select jsonb_build_object('mode',value->>'mode','version',version,'updated_at',updated_at)
 into result from public.company_settings where key='attendance.verification';
 return result;
end;
$$;
revoke execute on function public.attendance_verification_setting() from public,anon;
grant execute on function public.attendance_verification_setting() to authenticated;
commit;
