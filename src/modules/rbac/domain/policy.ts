import type { Account } from "@/modules/users/domain/contracts";
import { AppError } from "@/shared/domain/errors";
export { navigation } from "@/modules/navigation/domain/navigation";
export function authorize(
  account: Account | null,
  permission?: string,
): asserts account is Account {
  if (!account) throw new AppError("Unauthorized");
  if (account.status !== "ACTIVE" || (permission && !account.permissions.includes(permission)))
    throw new AppError("Forbidden");
}
export function authorizeAny(account: Account | null, permissions: string[]): asserts account is Account {
  authorize(account);
  if (!permissions.some((permission) => account.permissions.includes(permission)))
    throw new AppError("Forbidden");
}
