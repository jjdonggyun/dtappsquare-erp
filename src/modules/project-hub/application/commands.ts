import type { Account } from "@/modules/users/domain/contracts";
import { authorize } from "@/modules/rbac/domain/policy";
import { projectHubCommandSchema, type ProjectHubCommand } from "../domain/contracts";

export interface ProjectHubCommandRepository {
  execute(command: ProjectHubCommand, requestId: string): Promise<unknown>;
}

const permissions: Record<ProjectHubCommand["action"], string> = {
  "employee.cost_rate.save": "EMPLOYEE_COST_RATE_MANAGE",
  "assignment.rate.snapshot": "PROJECT_RATE_MANAGE",
  "document.register": "PROJECT_DOCUMENT_MANAGE",
  "document.archive": "PROJECT_DOCUMENT_MANAGE",
  "inspection.save": "PROJECT_INSPECTION_MANAGE",
};

export async function executeProjectHubCommand(
  account: Account | null,
  input: unknown,
  repository: ProjectHubCommandRepository,
  requestId: string,
) {
  const command = projectHubCommandSchema.parse(input);
  authorize(account, permissions[command.action]);
  return repository.execute(command, requestId);
}
