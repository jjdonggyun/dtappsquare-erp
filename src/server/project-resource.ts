import { z } from "zod";
import type { Account } from "@/modules/users/domain/contracts";
import { authorize } from "@/modules/rbac/domain/policy";
import { projectCommands } from "@/modules/project/domain/contracts";

export const projectResourceCommandSchema=z.discriminatedUnion("action",[...projectCommands]);
export type ProjectResourceCommand=z.infer<typeof projectResourceCommandSchema>;
const permissions:Record<ProjectResourceCommand["action"],string>={
  "project.save":"PROJECT_WRITE","project_assignment.save":"PROJECT_RESOURCE_MANAGE",
  "project_assignment.batch":"PROJECT_RESOURCE_MANAGE","project.progress":"PROJECT_WRITE",
  "project_task.save":"PROJECT_RESOURCE_MANAGE","project_milestone.save":"PROJECT_RESOURCE_MANAGE","project_issue.save":"PROJECT_RESOURCE_MANAGE",
};
export interface ProjectResourceRepository { execute(command:ProjectResourceCommand,requestId:string):Promise<unknown> }
export async function executeProjectResourceCommand(account:Account|null,input:unknown,repository:ProjectResourceRepository,requestId:string){
  authorize(account);
  const command=projectResourceCommandSchema.parse(input);
  authorize(account,permissions[command.action]);
  return repository.execute(command,requestId);
}
