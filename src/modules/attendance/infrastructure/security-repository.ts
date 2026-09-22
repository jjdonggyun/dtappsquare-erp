import "server-only";
import {z} from "zod";
import {serverClient} from "@/shared/infrastructure/supabase/server";
import {databaseError} from "@/shared/domain/errors";

const settingSchema=z.object({mode:z.string(),version:z.number(),updated_at:z.string()});
const networkSchema=z.object({id:z.uuid(),name:z.string(),cidr:z.string(),active:z.boolean(),version:z.number()});
const exceptionSchema=z.object({id:z.uuid(),user_id:z.uuid(),kind:z.string(),starts_on:z.string(),ends_on:z.string(),reason:z.string(),approval_reference:z.string().nullable(),active:z.boolean(),version:z.number()});
const verificationSchema=z.object({id:z.uuid(),user_id:z.uuid(),event_type:z.string(),mode:z.string(),network_status:z.string(),device_status:z.string(),device_id:z.uuid().nullable(),status:z.string(),reason_code:z.string().nullable(),created_at:z.string(),network_policy_id:z.uuid().nullable(),remote_exception_id:z.uuid().nullable()});
export async function attendanceSecurityOverview(workDate:string){
 const client=await serverClient();
 const [setting,networks,exceptions,verifications,events]=await Promise.all([
  client.rpc("attendance_verification_setting"),
  client.from("attendance_network_policies").select("id,name,cidr,active,version").order("name"),
  client.from("attendance_remote_exceptions").select("id,user_id,kind,starts_on,ends_on,reason,approval_reference,active,version").order("starts_on",{ascending:false}).limit(100),
  client.from("attendance_verifications").select("id,user_id,event_type,mode,network_status,device_status,device_id,status,reason_code,created_at,network_policy_id,remote_exception_id").gte("created_at",`${workDate}T00:00:00+09:00`).order("created_at",{ascending:false}).limit(300),
  client.from("attendance_events").select("id,user_id,occurred_at,device_id,verification_type,verification_status,network_policy_id,remote_exception_id").eq("work_date",workDate).eq("event_type","CHECK_IN").order("occurred_at",{ascending:false}).limit(300)
 ]);
 for(const result of [setting,networks,exceptions,verifications,events])if(result.error)throw databaseError(result.error);
 return {setting:settingSchema.parse(setting.data),networks:networkSchema.array().parse(networks.data),
  exceptions:exceptionSchema.array().parse(exceptions.data),verifications:verificationSchema.array().parse(verifications.data),
  events:z.array(z.object({id:z.uuid(),user_id:z.uuid(),occurred_at:z.string(),device_id:z.uuid().nullable(),verification_type:z.string(),verification_status:z.string(),network_policy_id:z.uuid().nullable(),remote_exception_id:z.uuid().nullable()})).parse(events.data)};
}
