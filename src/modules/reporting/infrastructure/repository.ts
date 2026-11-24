import "server-only";
import { z } from "zod";
import { databaseError } from "@/shared/domain/errors";
import { serverClient } from "@/shared/infrastructure/supabase/server";

const operationalAlertRunSchema = z.object({
  id: z.uuid(),
  run_date: z.string(),
  status: z.enum(["RUNNING", "COMPLETED", "FAILED"]),
  schedule_due_count: z.number().int(),
  overdue_billing_count: z.number().int(),
  notification_count: z.number().int(),
  error_code: z.string().nullable(),
  started_at: z.string(),
  completed_at: z.string().nullable(),
});

export type OperationalAlertRun = z.infer<typeof operationalAlertRunSchema>;

export async function operationalAlertStatus() {
  const client = await serverClient();
  const rpc = client.rpc.bind(client) as unknown as (
    functionName: string,
  ) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
  const { data, error } = await rpc("operational_alert_status");
  if (error) throw databaseError(error);
  return operationalAlertRunSchema.array().parse(data);
}
