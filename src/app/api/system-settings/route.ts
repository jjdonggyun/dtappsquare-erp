import { NextResponse } from "next/server";
import { currentAccount } from "@/shared/auth/account";
import { authorize } from "@/modules/rbac/domain/policy";
import { settingCommandSchema } from "@/modules/settings/domain/contracts";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
import { failure,readMutation } from "@/shared/infrastructure/http";
export async function POST(request:Request){const requestId=crypto.randomUUID();try{const [account,input]=await Promise.all([currentAccount(),readMutation(request)]);authorize(account,"RBAC_MANAGE");const command=settingCommandSchema.parse(input);const client=await serverClient();const {data,error}=await client.rpc("system_setting_command",{p_key:command.payload.key,p_value:{mode:command.payload.mode},p_version:command.payload.version,p_request_id:requestId});if(error)throw databaseError(error);return NextResponse.json({data},{headers:{"Cache-Control":"no-store"}})}catch(error){return failure(error,requestId)}}
