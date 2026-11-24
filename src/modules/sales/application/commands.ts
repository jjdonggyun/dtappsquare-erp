import type { Account } from "@/modules/users/domain/contracts";
import { authorize } from "@/modules/rbac/domain/policy";
import { salesCommandSchema, type SalesCommand } from "../domain/contracts";

export interface SalesCommandRepository {
  execute(command: SalesCommand, requestId: string): Promise<unknown>;
}

export async function executeSalesCommand(
  account: Account | null,
  input: unknown,
  repository: SalesCommandRepository,
  requestId: string,
) {
  authorize(account, "OPPORTUNITY_MANAGE");
  const command = salesCommandSchema.parse(input);
  return repository.execute(command, requestId);
}

