import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";

export const leaveRequestSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  leave_type: z.string(),
  start_date: z.iso.date(),
  end_date: z.iso.date(),
  duration: z.number(),
  reason: z.string(),
  status: z.string(),
  approval_subject_id: z.uuid().nullable(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

const balanceEntrySchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  leave_type: z.string(),
  amount: z.number(),
  entry_type: z.string(),
  leave_request_id: z.uuid().nullable(),
  memo: z.string().nullable(),
  created_at: z.string(),
});

export async function leaveOverview(userId?: string) {
  const client = await serverClient();
  let leaveQuery = client.from("leave_requests").select("*").order("created_at", { ascending: false }).limit(500);
  let balanceQuery = client.from("leave_balance_entries").select("*").order("created_at", { ascending: false }).limit(1000);
  if (userId) {
    leaveQuery = leaveQuery.eq("user_id", userId);
    balanceQuery = balanceQuery.eq("user_id", userId);
  }
  const [leaves, balances] = await Promise.all([leaveQuery, balanceQuery]);
  if (leaves.error) throw databaseError(leaves.error);
  if (balances.error) throw databaseError(balances.error);
  const rows = leaveRequestSchema.array().parse(leaves.data);
  const entries = balanceEntrySchema.array().parse(balances.data);
  const totals = new Map<string, number>();
  for (const entry of entries) totals.set(entry.leave_type, (totals.get(entry.leave_type) ?? 0) + entry.amount);
  return { rows, entries, totals };
}
