import type { Account } from "@/modules/users/domain/contracts";
import { authorize } from "@/modules/rbac/domain/policy";
import { financeCommandSchema, type FinanceCommand } from "../domain/finance";

export interface FinanceCommandRepository {
  execute(command: FinanceCommand, requestId: string): Promise<unknown>;
}

export async function executeFinanceCommand(account: Account | null, input: unknown, repository: FinanceCommandRepository, requestId: string) {
  const command = financeCommandSchema.parse(input);
  const permission = command.action.startsWith("company_tax_profile") || command.action.startsWith("bank_account")
    ? "FINANCE_SETTINGS_MANAGE"
    : command.action.startsWith("tax_invoice")
      ? "TAX_INVOICE_MANAGE"
      : command.action.startsWith("payment")
        ? "PAYMENT_MANAGE"
        : "BILLING_MANAGE";
  authorize(account, permission);
  return repository.execute(command, requestId);
}
