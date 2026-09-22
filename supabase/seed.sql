insert into public.organizations(id,name,organization_type,parent_id,sort_order) values
 ('10000000-0000-4000-8000-000000000001','Digital Square','COMPANY',null,0),
 ('10000000-0000-4000-8000-000000000002','개발본부','DIVISION','10000000-0000-4000-8000-000000000001',10),
 ('10000000-0000-4000-8000-000000000003','Mendix팀','TEAM','10000000-0000-4000-8000-000000000002',10),
 ('10000000-0000-4000-8000-000000000004','Web팀','TEAM','10000000-0000-4000-8000-000000000002',20),
 ('10000000-0000-4000-8000-000000000005','경영지원팀','DEPARTMENT','10000000-0000-4000-8000-000000000001',20)
on conflict(id) do nothing;

insert into public.assets(
 id,asset_code,asset_type,manufacturer,model,serial_number,purchase_date,warranty_end_date,status,memo
) values
 ('40000000-0000-4000-8000-000000000001','DS-LT-001','LAPTOP','Apple','MacBook Pro 14','DS-MBP-001','2026-01-10','2029-01-09','AVAILABLE','개발용 노트북'),
 ('40000000-0000-4000-8000-000000000002','DS-LT-002','LAPTOP','Samsung','Galaxy Book5 Pro','DS-GBP-002','2026-02-15','2029-02-14','AVAILABLE','업무용 노트북'),
 ('40000000-0000-4000-8000-000000000003','DS-LT-003','LAPTOP','LG','gram Pro 16','DS-LGP-003','2026-03-20','2029-03-19','AVAILABLE','업무용 노트북')
on conflict(id) do nothing;
insert into public.positions(code,name,sort_order) values ('STAFF','사원',10),('ASSISTANT','대리',20),('MANAGER','과장',30),('DEPUTY','차장',40),('GENERAL','부장',50),('DIRECTOR','이사',60) on conflict(code) do nothing;
insert into public.titles(code,name,sort_order) values ('TEAM_LEAD','팀장',10),('PART_LEAD','파트장',20),('DIVISION_LEAD','본부장',30),('PM','PM',40) on conflict(code) do nothing;

insert into public.work_policies(
 id,code,version,name,check_in_time,check_out_time,break_start,break_end,late_grace_minutes,timezone,working_days
) values
 ('30000000-0000-4000-8000-000000000001','STANDARD',1,'표준 근무제','09:00','18:00','12:00','13:00',5,'Asia/Seoul',array[1,2,3,4,5]::smallint[]),
 ('30000000-0000-4000-8000-000000000002','FLEX_10',1,'10시 출근제','10:00','19:00','12:00','13:00',5,'Asia/Seoul',array[1,2,3,4,5]::smallint[])
on conflict(id) do nothing;
