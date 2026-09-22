import "server-only";
import type { Account } from "../domain/contracts";
import { authorize } from "@/modules/rbac/domain/policy";
import { dashboardCounts } from "@/shared/infrastructure/dashboard-repository";
export async function dashboardMetrics(account: Account) {
  authorize(account);
  return dashboardCounts();
}
