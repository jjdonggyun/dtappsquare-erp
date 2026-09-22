import {authorize} from "@/modules/rbac/domain/policy";
import type {Account} from "@/modules/users/domain/contracts";
import {workManagementCommands,type WorkManagementCommand} from "../domain/contracts";
export interface WorkManagementRepository{execute(command:WorkManagementCommand,requestId:string):Promise<unknown>}
export async function executeWorkManagement(account:Account|null,input:unknown,repository:WorkManagementRepository,requestId:string){
 authorize(account);const command=workManagementCommands.parse(input);
 authorize(account,command.action.startsWith("work_log.")?"WORK_LOG_WRITE_SELF":"WEEKLY_REPORT_WRITE_SELF");
 return repository.execute(command,requestId);
}
