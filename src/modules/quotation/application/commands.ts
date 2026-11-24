import type { Account } from "@/modules/users/domain/contracts";
import { authorize } from "@/modules/rbac/domain/policy";
import { quotationCommandSchema, type QuotationCommand } from "../domain/contracts";

export interface QuotationCommandRepository {
  execute(command: QuotationCommand, requestId: string): Promise<unknown>;
}

export async function executeQuotationCommand(
  account: Account | null,
  input: unknown,
  repository: QuotationCommandRepository,
  requestId: string,
) {
  const command = quotationCommandSchema.parse(input);
  authorize(
    account,
    command.action === "approval.decide" ? "QUOTATION_APPROVE" : "QUOTATION_MANAGE",
  );
  return repository.execute(command, requestId);
}

