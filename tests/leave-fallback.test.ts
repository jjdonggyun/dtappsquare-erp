import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {loadEnvFile} from "node:process";
import postgres from "postgres";
import {createClient,type SupabaseClient} from "@supabase/supabase-js";

loadEnvFile(".env.local");
const apiUrl=process.env.NEXT_PUBLIC_SUPABASE_URL!,dbUrl=process.env.TEST_DATABASE_URL!;
if(!["127.0.0.1","localhost"].includes(new URL(apiUrl).hostname)||!["127.0.0.1","localhost"].includes(new URL(dbUrl).hostname))throw new Error("Local disposable database required");
const sql=postgres(dbUrl,{max:1});
let admin:SupabaseClient,adminId:string,leaveId:string,approvalId:string,subjectId:string;

beforeAll(async()=>{
 admin=createClient(apiUrl,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await admin.auth.signInWithPassword({email:"admin@digitalsquare.local",password:process.env.SEED_PASSWORD!});
 if(error)throw error;
 adminId=(await admin.auth.getUser()).data.user!.id;
});

afterAll(async()=>{
 if(approvalId){
  await sql`delete from public.email_delivery_attempts where outbox_id in (select o.id from public.notification_outbox o join public.notifications n on n.id=o.notification_id where n.reference_id=${approvalId})`;
  await sql`delete from public.notification_outbox where notification_id in (select id from public.notifications where reference_id=${approvalId})`;
  await sql`delete from public.notifications where reference_id=${approvalId}`;
  await sql`delete from public.approval_request_steps where approval_request_id=${approvalId}`;
  await sql`delete from public.approval_requests where id=${approvalId}`;
 }
 if(leaveId)await sql`delete from public.leave_requests where id=${leaveId}`;
 if(subjectId)await sql`delete from public.approval_subjects where id=${subjectId}`;
 for(const id of [leaveId,approvalId,subjectId].filter(Boolean))await sql`delete from public.audit_logs where entity_id=${id}`;
 await sql.end();
});

describe("leave approval fallback",()=>{
 it("routes the only leave manager's request to another active leave approver",async()=>{
  const created=await admin.rpc("leave_approval_command",{p_action:"leave.create",p_payload:{leave_type:"SPECIAL",start_date:"2030-01-03",end_date:"2030-01-03",reason:"Admin fallback regression"},p_request_id:crypto.randomUUID()});
  expect(created.error).toBeNull();leaveId=created.data.id;
  const submitted=await admin.rpc("leave_approval_command",{p_action:"leave.submit",p_payload:{id:leaveId,version:1},p_request_id:crypto.randomUUID()});
  expect(submitted.error).toBeNull();approvalId=submitted.data.approval_request_id;
  const [route]=await sql`select ar.approval_subject_id,s.approver_id,s.approver_type from public.approval_requests ar join public.approval_request_steps s on s.approval_request_id=ar.id where ar.id=${approvalId} and s.step_order=1`;
  subjectId=route.approval_subject_id;
  expect(route.approver_type).toBe("ROLE_FALLBACK");
  expect(route.approver_id).not.toBe(adminId);
  const [approver]=await sql`
    select e.user_status,
      exists(
        select 1 from public.user_roles ur
        join public.role_permissions rp on rp.role_id=ur.role_id
        join public.permissions p on p.id=rp.permission_id
        where ur.user_id=e.id and p.code='LEAVE_APPROVE'
      ) can_approve
    from public.employees e where e.id=${route.approver_id}`;
  expect(approver).toMatchObject({user_status:"ACTIVE",can_approve:true});
 });
});
