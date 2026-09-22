import { z } from "zod";
import { authorize } from "@/modules/rbac/domain/policy";
import type { Account } from "@/modules/users/domain/contracts";
import { employeeCommands } from "@/modules/users/application/commands";
import { organizationCommands } from "@/modules/organization/application/commands";
import { roleCommands } from "@/modules/rbac/application/commands";
export const commandSchema = z.discriminatedUnion("action", [
  ...employeeCommands,
  ...organizationCommands,
  ...roleCommands,
]);
export type Command = z.infer<typeof commandSchema>;
export const commandPermissions: Record<Command["action"], string> = {
  "employee.update": "USER_WRITE",
  "employee.status": "USER_APPROVE",
  "profile.update": "PROFILE_WRITE_SELF",
  "organization.save": "ORGANIZATION_MANAGE",
  "catalog.save": "ORGANIZATION_MANAGE",
  "role.save": "RBAC_MANAGE",
  "role.assign": "RBAC_MANAGE",
};
export interface ManagementRepository {
  execute(command: Command, requestId: string): Promise<unknown>;
}
export async function executeCommand(
  account: Account | null,
  input: unknown,
  repository: ManagementRepository,
  requestId: string,
) {
  authorize(account);
  const command = commandSchema.parse(input);
  authorize(account, commandPermissions[command.action]);
  return repository.execute(command, requestId);
}
