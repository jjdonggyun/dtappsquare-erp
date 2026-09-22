import {NextResponse} from "next/server";
import {z} from "zod";
import {currentAccount} from "@/shared/auth/account";
import {authorize} from "@/modules/rbac/domain/policy";
import {provisioningClient} from "@/shared/infrastructure/supabase/admin";
import {databaseError} from "@/shared/domain/errors";
import {failure,readMutation} from "@/shared/infrastructure/http";
import {trustedClientIp} from "@/modules/attendance/domain/trusted-client-ip";

export async function POST(request:Request){
 const requestId=crypto.randomUUID();
 try{
  const account=await currentAccount();authorize(account,"ATTENDANCE_READ_SELF");
  const input=z.object({event_type:z.enum(["CHECK_IN","CHECK_OUT"])}).parse(await readMutation(request));
  const {data,error}=await provisioningClient().rpc("attendance_verification_prepare",{
   p_user_id:account.id,p_event_type:input.event_type,p_client_ip:trustedClientIp(request)
  });
  if(error)throw databaseError(error);
  return NextResponse.json({data},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return failure(error,requestId)}
}
