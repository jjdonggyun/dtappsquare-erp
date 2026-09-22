import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {loadEnvFile} from "node:process";
import postgres from "postgres";
import {createClient,type SupabaseClient} from "@supabase/supabase-js";
import {trustedClientIp} from "../src/modules/attendance/domain/trusted-client-ip";
loadEnvFile(".env.local");
const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,dbUrl=process.env.TEST_DATABASE_URL!;
if(!["localhost","127.0.0.1"].includes(new URL(url).hostname)||!["localhost","127.0.0.1"].includes(new URL(dbUrl).hostname))throw new Error("Local disposable database required");
const sql=postgres(dbUrl,{max:1});
const make=()=>createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
let admin:SupabaseClient,employee:SupabaseClient,manager:SupabaseClient,service:SupabaseClient;
let adminId:string,employeeId:string,managerId:string,assetId:string,assignmentId:string,deviceRowId:string,networkId:string,remoteId:string;
let originalSetting:Parameters<typeof sql.json>[0],workDate:string;
const deviceId=crypto.randomUUID(),token=`test-device-token-${crypto.randomUUID()}-${crypto.randomUUID()}`;
const evidenceIds:string[]=[],eventIds:string[]=[];
const prepare=async(userId:string,eventType="CHECK_IN",ip:string|null="203.0.113.10")=>{
 const result=await service.rpc("attendance_verification_prepare",{p_user_id:userId,p_event_type:eventType,p_client_ip:ip});
 expect(result.error).toBeNull();evidenceIds.push(result.data.id);return result.data;
};
const prove=async(id:string,options:{device?:string;credential?:string;ip?:string|null;timestamp?:string;nonce?:string}={})=>
 service.rpc("attendance_verification_prove_device",{p_verification_id:id,p_device_id:options.device??deviceId,
  p_device_token:options.credential??token,p_timestamp:options.timestamp??new Date().toISOString(),
  p_nonce:options.nonce??crypto.randomUUID(),p_client_ip:options.ip===undefined?"203.0.113.10":options.ip});
beforeAll(async()=>{
 admin=make();employee=make();manager=make();service=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 for(const [client,name] of [[admin,"admin"],[employee,"employee"],[manager,"manager"]] as const){const {error}=await client.auth.signInWithPassword({email:`${name}@digitalsquare.local`,password:process.env.SEED_PASSWORD!});if(error)throw error}
 adminId=(await admin.auth.getUser()).data.user!.id;employeeId=(await employee.auth.getUser()).data.user!.id;managerId=(await manager.auth.getUser()).data.user!.id;
 originalSetting=(await sql`select value from public.company_settings where key='attendance.verification'`)[0].value as Parameters<typeof sql.json>[0];
 await sql`update public.company_settings set value='{"mode":"DEVICE_AND_NETWORK"}'::jsonb where key='attendance.verification'`;
 workDate=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 expect(Number((await sql`select count(*) n from public.attendance_events where user_id=${employeeId} and work_date=${workDate}`)[0].n)).toBe(0);
 const [asset]=await sql`insert into public.assets(asset_code,asset_type,status,created_by) values(${`TDEVICE-${crypto.randomUUID().slice(0,8).toUpperCase()}`},'LAPTOP','ASSIGNED',${adminId}) returning id`;assetId=asset.id;
 const [assignment]=await sql`insert into public.asset_assignments(asset_id,user_id,assigned_by) values(${assetId},${employeeId},${adminId}) returning id`;assignmentId=assignment.id;
 const [device]=await sql`insert into public.registered_devices(device_id,asset_id,hostname,serial_number,mac_hash,os,device_token_hash,created_by)
 values(${deviceId},${assetId},'test-office-pc',${`SER-${crypto.randomUUID()}`},extensions.digest('00:11:22:33:44:55','sha256'),'Windows',extensions.digest(${token},'sha256'),${adminId}) returning id`;deviceRowId=device.id;
 const network=await admin.rpc("attendance_security_command",{p_action:"network.save",p_payload:{name:`Test Office ${crypto.randomUUID().slice(0,8)}`,cidr:"203.0.113.10/32",active:true},p_request_id:crypto.randomUUID()});expect(network.error).toBeNull();networkId=network.data.id;
});
afterAll(async()=>{
 if(originalSetting)await sql`update public.company_settings set value=${sql.json(originalSetting)} where key='attendance.verification'`;
 for(const id of eventIds)await sql`delete from public.attendance_events where id=${id}`;
 if(eventIds.length)await sql`delete from public.attendance_daily_summaries where user_id=${employeeId} and work_date=${workDate}`;
 for(const id of evidenceIds)await sql`delete from public.attendance_verifications where id=${id}`;
 if(deviceRowId)await sql`delete from public.attendance_device_nonces where device_id=${deviceRowId}`;
 if(remoteId){await sql`delete from public.audit_logs where entity_id=${remoteId}`;await sql`delete from public.attendance_remote_exceptions where id=${remoteId}`}
 if(networkId){await sql`delete from public.audit_logs where entity_id=${networkId}`;await sql`delete from public.attendance_network_policies where id=${networkId}`}
 if(deviceRowId){await sql`delete from public.audit_logs where entity_id=${deviceRowId}`;await sql`delete from public.registered_devices where id=${deviceRowId}`}
 if(assignmentId)await sql`delete from public.asset_assignments where id=${assignmentId}`;
 if(assetId){await sql`delete from public.audit_logs where entity_id=${assetId}`;await sql`delete from public.assets where id=${assetId}`}
 await sql.end();
});
describe("Phase 10 attendance trust",()=>{
 it("fails closed on untrusted proxy headers",()=>{
  const request=new Request("https://erp.example.test",{headers:{"x-forwarded-for":"203.0.113.10"}});
  expect(trustedClientIp(request,{})).toBeNull();
  expect(trustedClientIp(request,{VERCEL:"1",VERCEL_ENV:"production"})).toBe("203.0.113.10");
  expect(trustedClientIp(new Request("https://erp.example.test",{headers:{"x-forwarded-for":"203.0.113.10, 1.2.3.4"}}),{VERCEL:"1",VERCEL_ENV:"production"})).toBeNull();
 });
 it("denies direct bypass, wrong network and copied device ID",async()=>{
  expect((await employee.rpc("attendance_command",{p_action:"attendance.check_in",p_payload:{},p_request_id:crypto.randomUUID()})).error?.code).toBe("42501");
  expect((await employee.rpc("attendance_verification_prepare",{p_user_id:employeeId,p_event_type:"CHECK_IN",p_client_ip:"203.0.113.10"})).error?.code).toBe("42501");
  const wrong=await prepare(employeeId,"CHECK_IN","198.51.100.42");expect(wrong.status).toBe("FAILED");
  const unknown=await prepare(employeeId);expect((await prove(unknown.id,{device:crypto.randomUUID()})).data.accepted).toBe(false);
  const copied=await prepare(employeeId);expect((await prove(copied.id,{credential:"x".repeat(64)})).data.accepted).toBe(false);
 });
 it("rejects revoked, replayed, stale and another employee's device",async()=>{
  await sql`update public.registered_devices set active=false where id=${deviceRowId}`;
  const revoked=await prepare(employeeId);expect((await prove(revoked.id)).data.accepted).toBe(false);
  await sql`update public.registered_devices set active=true where id=${deviceRowId}`;
  const stale=await prepare(employeeId);expect((await prove(stale.id,{timestamp:new Date(Date.now()-120000).toISOString()})).data.accepted).toBe(false);
  const other=await prepare(managerId);expect((await prove(other.id)).data.accepted).toBe(false);
  const nonce=crypto.randomUUID();const first=await prepare(employeeId);expect((await prove(first.id,{nonce})).data.accepted).toBe(true);
  const replay=await prepare(employeeId);expect((await prove(replay.id,{nonce})).data.accepted).toBe(false);
 });
 it("rechecks an office network deactivated after proof",async()=>{
  const proof=await prepare(employeeId);expect((await prove(proof.id)).data.accepted).toBe(true);
  await sql`update public.attendance_network_policies set active=false where id=${networkId}`;
  expect((await employee.rpc("attendance_command",{p_action:"attendance.check_in",p_payload:{verification_id:proof.id},p_request_id:crypto.randomUUID()})).error?.code).toBe("42501");
  await sql`update public.attendance_network_policies set active=true where id=${networkId}`;
 });
 it("records only verified server-time attendance and permits audited remote exception",async()=>{
  const valid=await prepare(employeeId);expect(valid.network_status).toBe("VERIFIED");
  expect((await prove(valid.id)).data.accepted).toBe(true);
  const requestId=crypto.randomUUID();const start=Date.now();const checkIn=await employee.rpc("attendance_command",{p_action:"attendance.check_in",p_payload:{verification_id:valid.id},p_request_id:requestId});
  expect(checkIn.error).toBeNull();eventIds.push(checkIn.data.event_id);
  const retry=await employee.rpc("attendance_command",{p_action:"attendance.check_in",p_payload:{verification_id:valid.id},p_request_id:requestId});
  expect(retry.error).toBeNull();expect(retry.data.event_id).toBe(checkIn.data.event_id);
  expect((await employee.rpc("attendance_command",{p_action:"attendance.check_out",p_payload:{verification_id:valid.id},p_request_id:requestId})).error?.code).toBe("22023");
  const [event]=await sql`select occurred_at,verification_type,verification_status,device_id,network_policy_id from public.attendance_events where id=${checkIn.data.event_id}`;
  expect(event.verification_type).toBe("DEVICE_AND_NETWORK");expect(event.verification_status).toBe("VERIFIED");expect(event.device_id).toBe(deviceId);expect(event.network_policy_id).toBe(networkId);expect(Math.abs(new Date(event.occurred_at).getTime()-start)).toBeLessThan(10000);
  expect((await sql`select count(*)::int n from public.attendance_events where user_id=${employeeId} and work_date=${workDate}`)[0].n).toBe(1);
  const [setting]=await sql`select version from public.company_settings where key='attendance.verification'`;
  expect((await admin.rpc("attendance_security_command",{p_action:"policy.save",p_payload:{mode:"REMOTE_APPROVED",version:setting.version},p_request_id:crypto.randomUUID()})).error).toBeNull();
  const remote=await admin.rpc("attendance_security_command",{p_action:"remote.save",p_payload:{user_id:employeeId,kind:"REMOTE",starts_on:workDate,ends_on:workDate,reason:"Approved integration test",approval_reference:"TEST-REMOTE",active:true},p_request_id:crypto.randomUUID()});expect(remote.error).toBeNull();remoteId=remote.data.id;
  const remoteProof=await prepare(employeeId,"CHECK_OUT",null);expect(remoteProof.network_status).toBe("EXEMPT");expect((await prove(remoteProof.id,{ip:null})).data.accepted).toBe(true);
  const checkOut=await employee.rpc("attendance_command",{p_action:"attendance.check_out",p_payload:{verification_id:remoteProof.id},p_request_id:crypto.randomUUID()});expect(checkOut.error).toBeNull();eventIds.push(checkOut.data.event_id);
  expect((await sql`select remote_exception_id from public.attendance_events where id=${checkOut.data.event_id}`)[0].remote_exception_id).toBe(remoteId);
 });
});
