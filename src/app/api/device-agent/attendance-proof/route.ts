import {NextResponse} from "next/server";
import {z} from "zod";
import {provisioningClient} from "@/shared/infrastructure/supabase/admin";
import {databaseError} from "@/shared/domain/errors";
import {failure,readExternalJson} from "@/shared/infrastructure/http";
import {trustedClientIp} from "@/modules/attendance/domain/trusted-client-ip";

const proofSchema=z.object({verification_id:z.uuid(),device_id:z.uuid(),device_token:z.string().min(32).max(256),
 timestamp:z.iso.datetime({offset:true}),nonce:z.string().min(16).max(100)}).strict();
export async function POST(request:Request){
 const requestId=crypto.randomUUID();
 try{
  const input=proofSchema.parse(await readExternalJson(request,8192));
  const {data,error}=await provisioningClient().rpc("attendance_verification_prove_device",{
   p_verification_id:input.verification_id,p_device_id:input.device_id,p_device_token:input.device_token,
   p_timestamp:input.timestamp,p_nonce:input.nonce,p_client_ip:trustedClientIp(request)
  });
  if(error)throw databaseError(error);
  const accepted=typeof data==="object"&&data!==null&&!Array.isArray(data)&&data.accepted===true;
  return NextResponse.json({data},{status:accepted?200:403,headers:{"Cache-Control":"no-store"}});
 }catch(error){return failure(error,requestId)}
}
