import "server-only";
import { z } from "zod";
import { databaseError } from "@/shared/domain/errors";
import { provisioningClient } from "@/shared/infrastructure/supabase/admin";

const resultSchema = z.object({
  runId: z.uuid(),
  runDate: z.string(),
  status: z.literal("COMPLETED"),
  scheduleDueCount: z.number().int(),
  overdueBillingCount: z.number().int(),
  notificationCount: z.number().int(),
});

export async function runOperationalAlerts(runDate?: string) {
  const client = provisioningClient();
  const rpc = client.rpc.bind(client) as unknown as (
    functionName: string,
    args: Record<string, string | undefined>,
  ) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
  const { data, error } = await rpc("run_operational_alerts", {
    ...(runDate ? { p_run_date: runDate } : {}),
  });
  if (error) {
    const failureDate = runDate ?? new Intl.DateTimeFormat("en-CA", {
      timeZone: process.env.COMPANY_TIMEZONE ?? "Asia/Seoul",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    try {
      await rpc("record_operational_alert_failure", {
        p_run_date: failureDate,
        p_error_code: error.code ?? "INTERNAL_ERROR",
      });
    } catch {
      // The original database error remains the actionable failure.
    }
    throw databaseError(error);
  }
  return resultSchema.parse(data);
}
