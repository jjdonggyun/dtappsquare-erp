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

const quotationRevisionApprovalSchema = z.object({
  id: z.uuid(),
  quotation_id: z.uuid(),
  revision_no: z.number().int(),
  project_name: z.string(),
  total_amount: z.number(),
  status: z.string(),
});

const quotationApprovalSchema = z.object({
  id: z.uuid(),
  quotation_number: z.string(),
  customer: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});

const contractApprovalSchema = z.object({
  id: z.uuid(),
  contract_number: z.string(),
  contract_name: z.string(),
  total_amount: z.number(),
  status: z.string(),
  customer: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});

export async function approvalInbox() {
  const client = await serverClient();
  const [requests, steps, leaves, directory, quotationRevisions, quotations, contracts] = await Promise.all([
    client.from("approval_requests").select("*").order("created_at", { ascending: false }).limit(500),
    client.from("approval_request_steps").select("*").order("step_order").limit(1000),
    client.from("leave_requests").select("*").limit(500),
    client.rpc("employee_directory"),
    client.from("quotation_revisions").select("id,quotation_id,revision_no,project_name,total_amount,status").limit(500),
    client.from("quotations").select("id,quotation_number,customer:customers(id,name)").limit(500),
    client.from("contracts").select("id,contract_number,contract_name,total_amount,status,customer:customers(id,name)").limit(500),
  ]);
  for (const result of [requests, steps, leaves, directory, quotationRevisions, quotations, contracts])
    if (result.error) throw databaseError(result.error);
  const stepRows = stepSchema.array().parse(steps.data);
  const leaveRows = leaveRequestSchema.array().parse(leaves.data);
  const people = z.array(z.object({ id: z.uuid(), name: z.string() })).parse(directory.data);
  const stepsByRequest = new Map<string, typeof stepRows>();
  for (const step of stepRows) stepsByRequest.set(step.approval_request_id, [...(stepsByRequest.get(step.approval_request_id) ?? []), step]);
  const leaveById = new Map(leaveRows.map((leave) => [leave.id, leave]));
  const names = new Map(people.map((person) => [person.id, person.name]));
  const revisionRows = quotationRevisionApprovalSchema.array().parse(quotationRevisions.data);
  const quotationRows = quotationApprovalSchema.array().parse(quotations.data);
  const quotesById = new Map(quotationRows.map((quote) => [quote.id, quote]));
  const revisionById = new Map(revisionRows.map((revision) => [revision.id, revision]));
  const contractRows = contractApprovalSchema.array().parse(contracts.data);
  const contractById = new Map(contractRows.map((contract) => [contract.id, contract]));
  return requestSchema.array().parse(requests.data).map((request) => ({
    ...request,
    steps: stepsByRequest.get(request.id) ?? [],
    leave: leaveById.get(request.reference_id) ?? null,
    quotation:
      request.request_type === "QUOTATION" && revisionById.has(request.reference_id)
        ? {
            revision: revisionById.get(request.reference_id)!,
            quote: quotesById.get(revisionById.get(request.reference_id)!.quotation_id) ?? null,
          }
        : null,
    contract: request.request_type === "CONTRACT" ? contractById.get(request.reference_id) ?? null : null,
    requesterName: names.get(request.requester_id) ?? "조회 제한",
  }));
}
