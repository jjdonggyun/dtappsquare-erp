import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
import { leaveRequestSchema } from "@/modules/leave/infrastructure/repository";

const requestSchema = z.object({
  id: z.uuid(),
  approval_subject_id: z.uuid(),
  request_type: z.string(),
  reference_id: z.uuid(),
  requester_id: z.uuid(),
  status: z.string(),
  current_step_order: z.number().int(),
  route_snapshot: z.unknown(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

const stepSchema = z.object({
  id: z.uuid(),
  approval_request_id: z.uuid(),
  step_order: z.number().int(),
  approver_type: z.string(),
  approver_id: z.uuid(),
  status: z.string(),
  approved_at: z.string().nullable(),
  comment: z.string().nullable(),
  created_at: z.string(),
});

export async function approvalInbox() {
  const client = await serverClient();
  const [requests, steps, leaves, directory] = await Promise.all([
    client.from("approval_requests").select("*").order("created_at", { ascending: false }).limit(500),
    client.from("approval_request_steps").select("*").order("step_order").limit(1000),
    client.from("leave_requests").select("*").limit(500),
    client.rpc("employee_directory"),
  ]);
  for (const result of [requests, steps, leaves, directory]) if (result.error) throw databaseError(result.error);
  const stepRows = stepSchema.array().parse(steps.data);
  const leaveRows = leaveRequestSchema.array().parse(leaves.data);
  const people = z.array(z.object({ id: z.uuid(), name: z.string() })).parse(directory.data);
  const stepsByRequest = new Map<string, typeof stepRows>();
  for (const step of stepRows) stepsByRequest.set(step.approval_request_id, [...(stepsByRequest.get(step.approval_request_id) ?? []), step]);
  const leaveById = new Map(leaveRows.map((leave) => [leave.id, leave]));
  const names = new Map(people.map((person) => [person.id, person.name]));
  return requestSchema.array().parse(requests.data).map((request) => ({
    ...request,
    steps: stepsByRequest.get(request.id) ?? [],
    leave: leaveById.get(request.reference_id) ?? null,
    requesterName: names.get(request.requester_id) ?? "조회 제한",
  }));
}
