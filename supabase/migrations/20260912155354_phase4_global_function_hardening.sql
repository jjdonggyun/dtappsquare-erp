begin;

revoke execute on function public.attendance_command(text,jsonb,text),
  public.workforce_command(text,jsonb,text),
  public.leave_approval_command(text,jsonb,text)
  from public,anon;

commit;
