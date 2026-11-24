import type { Account } from "@/modules/users/domain/contracts";
import { authorize } from "@/modules/rbac/domain/policy";
import { contractCommandSchema, type ContractCommand } from "../domain/contracts";

export interface ContractCommandRepository {
  execute(command: ContractCommand, requestId: string): Promise<unknown>;
}

export async function executeContractCommand(
  account: Account | null,
  input: unknown,
  repository: ContractCommandRepository,
  requestId: string,
) {
  const command = contractCommandSchema.parse(input);
  authorize(
    account,
    command.action === "approval.decide" ? "CONTRACT_APPROVE" : "CONTRACT_MANAGE",
  );
  return repository.execute(command, requestId);
}

