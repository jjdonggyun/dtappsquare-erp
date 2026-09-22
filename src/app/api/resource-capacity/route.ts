import {NextResponse} from "next/server";
import {z} from "zod";
import {currentAccount} from "@/shared/auth/account";
import {authorizeAny} from "@/modules/rbac/domain/policy";
import {serverClient} from "@/shared/infrastructure/supabase/server";
import {databaseError} from "@/shared/domain/errors";
import {failure} from "@/shared/infrastructure/http";
const params=z.object({start:z.iso.date(),end:z.iso.date(),granularity:z.enum(["week","month","range"]).default("range")});
export async function GET(request:Request){const requestId=crypto.randomUUID();try{
  authorizeAny(await currentAccount(),["RESOURCE_READ","PROJECT_RESOURCE_MANAGE"]);
  const url=new URL(request.url);const {start,end,granularity}=params.parse(Object.fromEntries(url.searchParams));
  const client=await serverClient();const {data,error}=await client.rpc("resource_capacity",{p_start:start,p_end:end,p_granularity:granularity});
  if(error)throw databaseError(error);
  return NextResponse.json({data},{headers:{"Cache-Control":"no-store"}});
}catch(error){return failure(error,requestId)}}
