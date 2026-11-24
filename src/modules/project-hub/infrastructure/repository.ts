import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
import type { ProjectHubCommandRepository } from "../application/commands";

export const projectDocumentSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  category: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
  size_bytes: z.number(),
  sha256: z.string(),
  document_version: z.number().int(),
  previous_document_id: z.uuid().nullable(),
  uploaded_by: z.uuid(),
  archived_at: z.string().nullable(),
  created_at: z.string(),
});

export const inspectionSchema = z.object({
  id: z.uuid(),
  project_id: z.uuid(),
  milestone_id: z.uuid().nullable(),
  document_id: z.uuid().nullable(),
  inspection_type: z.string(),
  title: z.string(),
  requested_date: z.string().nullable(),
  scheduled_date: z.string().nullable(),
  completed_date: z.string().nullable(),
  customer_contact_name: z.string(),
  customer_contact_email: z.string(),
  status: z.string(),
  result: z.string(),
  note: z.string(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const assignmentRateSchema = z.object({
  id: z.uuid(),
  assignment_id: z.uuid(),
  snapshot_no: z.number().int(),
  planned_mm: z.number(),
  monthly_cost_rate: z.number(),
  monthly_billing_rate: z.number(),
  source_employee_cost_rate_id: z.uuid().nullable(),
  reason: z.string(),
  created_by: z.uuid(),
  created_at: z.string(),
});

export const employeeCostRateSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  effective_from: z.string(),
  effective_to: z.string().nullable(),
  monthly_cost_rate: z.number(),
  note: z.string(),
  created_by: z.uuid(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

export function projectHubCommandRepository(): ProjectHubCommandRepository {
  return {
    async execute(command, requestId) {
      const client = await serverClient();
      const { data, error } = await client.rpc("project_hub_command", {
        p_action: command.action,
        p_payload: command.payload,
        p_request_id: requestId,
      });
      if (error) throw databaseError(error);
      return data;
    },
  };
}

export async function projectHubDetail(projectId: string) {
  const client = await serverClient();
  const [links, inspections, assignments, rates, costRates, workLogs] = await Promise.all([
    client
      .from("project_document_links")
      .select(
        "project_id,document:documents(id,title,category,file_name,mime_type,size_bytes,sha256,document_version,previous_document_id,uploaded_by,archived_at,created_at)",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    client
      .from("inspections")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    client
      .from("project_assignments")
      .select("id,user_id,project_role,planned_mm,status")
      .eq("project_id", projectId)
      .order("created_at"),
    client.from("project_assignment_rates").select("*").order("snapshot_no", { ascending: false }),
    client.from("employee_cost_rates").select("*").order("effective_from", { ascending: false }),
    client
      .from("daily_work_logs")
      .select("user_id,work_minutes")
      .eq("project_id", projectId)
      .is("deleted_at", null),
  ]);
  for (const result of [links, inspections, assignments, rates, costRates, workLogs])
    if (result.error) throw databaseError(result.error);
  const documentLinks = z
    .array(z.object({ project_id: z.uuid(), document: projectDocumentSchema.nullable() }))
    .parse(links.data);
  const assignmentRows = z
    .array(
      z.object({
        id: z.uuid(),
        user_id: z.uuid(),
        project_role: z.string(),
        planned_mm: z.number().nullable(),
        status: z.string(),
      }),
    )
    .parse(assignments.data);
  const assignmentIds = new Set(assignmentRows.map((assignment) => assignment.id));
  const actualMinutesByUser: Record<string, number> = {};
  for (const log of z
    .array(z.object({ user_id: z.uuid(), work_minutes: z.number().int() }))
    .parse(workLogs.data))
    actualMinutesByUser[log.user_id] = (actualMinutesByUser[log.user_id] ?? 0) + log.work_minutes;
  return {
    documents: documentLinks.flatMap((link) => (link.document ? [link.document] : [])),
    inspections: inspectionSchema.array().parse(inspections.data),
    assignments: assignmentRows,
    rates: assignmentRateSchema
      .array()
      .parse(rates.data)
      .filter((rate) => assignmentIds.has(rate.assignment_id)),
    costRates: employeeCostRateSchema.array().parse(costRates.data),
    actualMinutesByUser,
  };
}
