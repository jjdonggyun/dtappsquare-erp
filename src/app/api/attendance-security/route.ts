import {NextResponse} from "next/server";
import {z} from "zod";
import {currentAccount} from "@/shared/auth/account";
import {authorize} from "@/modules/rbac/domain/policy";
import {serverClient} from "@/shared/infrastructure/supabase/server";
import {databaseError} from "@/shared/domain/errors";
import {failure,readMutation} from "@/shared/infrastructure/http";
const actions=z.discriminatedUnion("action",[
 z.object({action:z.literal("policy.save"),payload:z.object({mode:z.enum(["OFF","DEVICE_ONLY","NETWORK_ONLY","DEVICE_AND_NETWORK","REMOTE_APPROVED"]),version:z.number().int().positive()})}),
 z.object({action:z.literal("network.save"),payload:z.object({id:z.uuid().optional(),version:z.number().int().positive().optional(),name:z.string().trim().min(1).max(100),cidr:z.string().min(3).max(80),active:z.boolean()})}),
 z.object({action:z.literal("remote.save"),payload:z.object({id:z.uuid().optional(),version:z.number().int().positive().optional(),user_id:z.uuid(),kind:z.enum(["REMOTE","BUSINESS_TRIP","OFFSITE"]),starts_on:z.iso.date(),ends_on:z.iso.date(),reason:z.string().trim().min(2).max(500),approval_reference:z.string().max(150).default(""),active:z.boolean()})})
]);
export async function POST(request:Request){const requestId=crypto.randomUUID();try{
 authorize(await currentAccount(),"ATTENDANCE_VERIFICATION_MANAGE");
 const input=actions.parse(await readMutation(request));
 const {data,error}=await (await serverClient()).rpc("attendance_security_command",{p_action:input.action,p_payload:input.payload,p_request_id:requestId});
 if(error)throw databaseError(error);
 return NextResponse.json({data},{headers:{"Cache-Control":"no-store"}});
}catch(error){return failure(error,requestId)}}
