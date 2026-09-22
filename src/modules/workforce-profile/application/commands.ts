import type {Account} from "@/modules/users/domain/contracts";
import {authorize} from "@/modules/rbac/domain/policy";
import {AppError} from "@/shared/domain/errors";
import {workforceCommands,type WorkforceCommand} from "../domain/contracts";

export type WorkforceRepository={execute(command:WorkforceCommand,requestId:string):Promise<unknown>};
export async function executeWorkforceCommand(account:Account|null,input:unknown,repository:WorkforceRepository,requestId:string){
  authorize(account);
  const command=workforceCommands.parse(input);
  const action=command.action;
  const target="user_id" in command.payload?command.payload.user_id:null;
  if(target){
    const self=target===account.id;
    if(!account.permissions.includes("WORKFORCE_PROFILE_MANAGE") &&
      !(self&&account.permissions.includes("WORKFORCE_PROFILE_WRITE_SELF"))) throw new AppError("Forbidden");
    if(action==="profile.save"&&!account.permissions.includes("WORKFORCE_PROFILE_MANAGE")&&
      ("birth_date" in command.payload&&command.payload.birth_date||"career_months_override" in command.payload||"career_override_reason" in command.payload))
      throw new AppError("Forbidden");
  }else if(action==="skill_catalog.save") authorize(account,"WORKFORCE_PROFILE_MANAGE");
  else authorize(account,"PROJECT_STAFFING_MANAGE");
  return repository.execute(command,requestId);
}
