import type { Account } from "@/modules/users/domain/contracts";
import { authorize } from "@/modules/rbac/domain/policy";
import { customerCommandSchema, type CustomerCommand } from "../domain/contracts";

export interface CustomerCommandRepository {
  execute(command: CustomerCommand, requestId: string): Promise<unknown>;
}

export async function executeCustomerCommand(
  account: Account | null,
  input: unknown,
  repository: CustomerCommandRepository,
  requestId: string,
) {
  authorize(account, "CUSTOMER_MANAGE");
  const command = customerCommandSchema.parse(input);
  return repository.execute(command, requestId);
}
