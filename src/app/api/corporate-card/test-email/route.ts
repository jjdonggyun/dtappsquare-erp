import {NextResponse} from "next/server";
import {z} from "zod";
import {currentAccount} from "@/shared/auth/account";
import {authorize} from "@/modules/rbac/domain/policy";
import {serverClient} from "@/shared/infrastructure/supabase/server";
import {databaseError} from "@/shared/domain/errors";
import {failure,readMutation} from "@/shared/infrastructure/http";
import {scheduleEmailDispatch} from "@/modules/notification/infrastructure/schedule-email-dispatch";
export async function POST(request:Request){const requestId=crypto.randomUUID();try{authorize(await currentAccount(),"CARD_SETTLEMENT_SEND");const input=z.object({report_id:z.uuid(),email:z.email()}).parse(await readMutation(request));const client=await serverClient();const {data,error}=await client.rpc("card_settlement_test_email",{p_report_id:input.report_id,p_email:input.email,p_request_id:requestId});if(error)throw databaseError(error);scheduleEmailDispatch(requestId);return NextResponse.json({data},{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error,requestId)}}
