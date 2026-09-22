import "server-only";
import type { ProjectResourceRepository } from "@/server/project-resource";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
export function projectResourceRepository():ProjectResourceRepository{return {async execute(command,requestId){
  const client=await serverClient();
  const {data,error}=await client.rpc("project_resource_command",{p_action:command.action,p_payload:command.payload,p_request_id:requestId});
  if(error) throw databaseError(error); return data;
}}}
