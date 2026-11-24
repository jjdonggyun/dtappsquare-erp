import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";

const summarySchema = z.object({
  contractTotal: z.number().optional(), monthContract: z.number().optional(),
  billingTotal: z.number().optional(), monthBilling: z.number().optional(),
  monthRevenue: z.number().optional(), outstanding: z.number().optional(),
  overdueAmount: z.number().optional(), overdueCount: z.number().optional(),
  paymentTotal: z.number().optional(), monthPayment: z.number().optional(),
  activeProjects: z.number().optional(), delayedProjects: z.number().optional(),
  pipelineCount: z.number().optional(), pipelineAmount: z.number().optional(),
  activeStaff: z.number().optional(), utilizationPercent: z.number().optional(),
  checkedIn: z.number().optional(), onLeave: z.number().optional(),
  pendingSignup: z.number().optional(), delayedApprovals: z.number().optional(),
  unissuedTaxInvoices: z.number().optional(),
});

export async function dashboardSummary() {
  const client = await serverClient();
  const { data, error } = await client.rpc("dashboard_summary");
  if (error) throw databaseError(error);
  return summarySchema.parse(data);
}
