import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { accountSchema } from "@/modules/users/domain/contracts";
import { authorize, authorizeAny } from "@/modules/rbac/domain/policy";
import { databaseError } from "@/shared/domain/errors";
export const currentAccount = cache(async () => {
  const client = await serverClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) return null;
  const { data, error } = await client.rpc("account_context");
  if (error) throw databaseError(error);
  return data ? accountSchema.parse(data) : null;
});
export async function requirePage(permission?: string) {
  const account = await currentAccount();
  if (!account) redirect("/login");
  if (account.status !== "ACTIVE") redirect("/account-status");
  authorize(account, permission);
  return account;
}
export async function requireAnyPage(permissions: string[]) {
  const account = await requirePage();
  authorizeAny(account, permissions);
  return account;
}
