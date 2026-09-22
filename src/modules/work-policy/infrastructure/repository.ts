import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
import { policySchema } from "@/modules/attendance/infrastructure/repository";

const assignmentSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  work_policy_id: z.uuid(),
  effective_from: z.iso.date(),
  effective_to: z.iso.date().nullable(),
  assigned_by: z.uuid(),
  created_at: z.string(),
});

export async function workPolicyCatalog() {
  const client = await serverClient();
  const [policies, assignments] = await Promise.all([
    client.from("work_policies").select("*").order("code").order("version", { ascending: false }),
    client
      .from("user_work_policy_assignments")
      .select("*")
      .order("effective_from", { ascending: false })
      .limit(1000),
  ]);
  if (policies.error) throw databaseError(policies.error);
  if (assignments.error) throw databaseError(assignments.error);
  return {
    policies: policySchema.array().parse(policies.data),
    assignments: assignmentSchema.array().parse(assignments.data),
  };
}
