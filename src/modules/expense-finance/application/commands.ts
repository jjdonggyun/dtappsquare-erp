import type { Account } from "@/modules/users/domain/contracts";
import { authorizeAny } from "@/modules/rbac/domain/policy";
import { expenseFinanceCommandSchema, type ExpenseFinanceCommand } from "../domain/contracts";

export interface ExpenseFinanceCommandRepository {
  execute(command: ExpenseFinanceCommand, requestId: string): Promise<unknown>;
}

export async function executeExpenseFinanceCommand(
  account: Account | null,
  input: unknown,
  repository: ExpenseFinanceCommandRepository,
  requestId: string,
) {
  const command = expenseFinanceCommandSchema.parse(input);
  const permissions = command.action.startsWith("expense_type") || command.action.startsWith("vendor")
    ? ["EXPENSE_MASTER_MANAGE"]
    : command.action.startsWith("project.")
      ? [command.action === "project.reopen" ? "PROJECT_REOPEN" : "PROJECT_CLOSE"]
      : command.action === "expense.approve" || command.action === "expense.reject" || command.action === "expense.mark_paid"
        ? ["EXPENSE_MANAGE"]
        : ["EXPENSE_WRITE_SELF", "EXPENSE_MANAGE"];
  authorizeAny(account, permissions);
  return repository.execute(command, requestId);
}
