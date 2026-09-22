import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";

const summarySchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  work_date: z.iso.date(),
  work_policy_id: z.uuid(),
  check_in_at: z.string().nullable(),
  check_out_at: z.string().nullable(),
  worked_minutes: z.number().int(),
  attendance_status: z.string(),
  status_flags: z.array(z.string()),
  policy_snapshot: z.record(z.string(), z.unknown()),
  shift_start_at: z.string(),
  shift_end_at: z.string(),
  version: z.number().int(),
});

const policySchema = z.object({
  id: z.uuid(),
  code: z.string(),
  version: z.number().int(),
  name: z.string(),
  check_in_time: z.string(),
  check_out_time: z.string(),
  break_start: z.string().nullable(),
  break_end: z.string().nullable(),
  late_grace_minutes: z.number().int(),
  timezone: z.string(),
  working_days: z.array(z.number().int()),
  active: z.boolean(),
  archived_at: z.string().nullable(),
});

export async function myAttendance(
  userId: string,
  today: string,
  monthStart: string,
  monthEnd: string,
) {
  const client = await serverClient();
  const [todayResult, monthResult, assignmentResult] = await Promise.all([
    client
      .from("attendance_daily_summaries")
      .select("*")
      .eq("user_id", userId)
      .eq("work_date", today)
      .maybeSingle(),
    client
      .from("attendance_daily_summaries")
      .select("*")
      .eq("user_id", userId)
      .gte("work_date", monthStart)
      .lt("work_date", monthEnd)
      .order("work_date", { ascending: false }),
    client
      .from("user_work_policy_assignments")
      .select("*,work_policies(*)")
      .eq("user_id", userId)
      .lte("effective_from", today)
      .or(`effective_to.is.null,effective_to.gt.${today}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  for (const result of [todayResult, monthResult, assignmentResult])
    if (result.error) throw databaseError(result.error);
  const assignment = assignmentResult.data as unknown as {
    effective_from: string;
    effective_to: string | null;
    work_policies: unknown;
  } | null;
  return {
    today: todayResult.data ? summarySchema.parse(todayResult.data) : null,
    month: summarySchema.array().parse(monthResult.data),
    assignment: assignment
      ? {
          effectiveFrom: assignment.effective_from,
          effectiveTo: assignment.effective_to,
          policy: policySchema.parse(assignment.work_policies),
        }
      : null,
  };
}

export async function attendanceRoster(workDate: string) {
  const client = await serverClient();
  const [employees, summaries] = await Promise.all([
    client
      .from("employees")
      .select("id,name,employee_number,organization_id")
      .eq("user_status", "ACTIVE")
      .order("name")
      .limit(500),
    client.from("attendance_daily_summaries").select("*").eq("work_date", workDate),
  ]);
  if (employees.error) throw databaseError(employees.error);
  if (summaries.error) throw databaseError(summaries.error);
  const byUser = new Map(
    summarySchema
      .array()
      .parse(summaries.data)
      .map((row) => [row.user_id, row]),
  );
  return z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        employee_number: z.string().nullable(),
        organization_id: z.uuid().nullable(),
      }),
    )
    .parse(employees.data)
    .map((employee) => ({ ...employee, summary: byUser.get(employee.id) ?? null }));
}

export async function attendanceMonthly(monthStart: string, monthEnd: string) {
  const client = await serverClient();
  const { data, error } = await client
    .from("attendance_daily_summaries")
    .select("*")
    .gte("work_date", monthStart)
    .lt("work_date", monthEnd)
    .order("work_date", { ascending: false })
    .limit(10000);
  if (error) throw databaseError(error);
  return summarySchema.array().parse(data);
}

export { summarySchema, policySchema };
