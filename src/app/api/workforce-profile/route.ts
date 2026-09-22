import {NextResponse} from "next/server";
import {currentAccount} from "@/shared/auth/account";
import {failure,readMutation} from "@/shared/infrastructure/http";
import {executeWorkforceCommand} from "@/modules/workforce-profile/application/commands";
import {workforceRepository} from "@/modules/workforce-profile/infrastructure/repository";
export async function POST(request:Request){const requestId=request.headers.get("X-Idempotency-Key")??crypto.randomUUID();try{
 const [account,input]=await Promise.all([currentAccount(),readMutation(request)]);
 const data=await executeWorkforceCommand(account,input,workforceRepository(),requestId);
 return NextResponse.json({data},{headers:{"Cache-Control":"no-store"}});
}catch(error){return failure(error,requestId)}}
