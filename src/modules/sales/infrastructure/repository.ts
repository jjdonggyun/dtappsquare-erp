import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
import type { SalesCommandRepository } from "../application/commands";

const customerOptionSchema = z.object({ id: z.uuid(), customer_code: z.string(), name: z.string() });
const ownerOptionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  employee_number: z.string().nullable(),
});
const customerLabelSchema = customerOptionSchema;
const ownerLabelSchema = z.object({ id: z.uuid(), name: z.string() });

export const opportunitySchema = z.object({
  id: z.uuid(),
  opportunity_code: z.string(),
  customer_id: z.uuid(),
  sales_owner_id: z.uuid(),
  title: z.string(),
  expected_project_name: z.string(),
  expected_amount: z.number(),
  probability: z.number(),
  expected_revenue: z.number(),
  expected_start_date: z.string().nullable(),
  expected_end_date: z.string().nullable(),
  proposal_due_date: z.string().nullable(),
  competitor: z.string(),
  note: z.string(),
  stage: z.string(),
  lost_reason: z.string(),
  closed_at: z.string().nullable(),
  archived_at: z.string().nullable(),
  created_by: z.uuid(),
  updated_by: z.uuid(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  customer: customerLabelSchema.nullable(),
  sales_owner: ownerLabelSchema.nullable(),
});

const opportunitySelect =
  "*,customer:customers(id,customer_code,name),sales_owner:employees!opportunities_sales_owner_id_fkey(id,name)";

export function salesCommandRepository(): SalesCommandRepository {
  return {
    async execute(command, requestId) {
      const client = await serverClient();
      const { data, error } = await client.rpc("sales_command", {
        p_action: command.action,
        p_payload: command.payload,
        p_request_id: requestId,
      });
      if (error) throw databaseError(error);
      return data;
    },
  };
}

export async function opportunityOptions() {
  const client = await serverClient();
  const [customers, owners] = await Promise.all([
    client
      .from("customers")
      .select("id,customer_code,name")
      .eq("status", "ACTIVE")
      .order("name")
      .limit(500),
    client.rpc("sales_owner_options"),
  ]);
  if (customers.error) throw databaseError(customers.error);
  if (owners.error) throw databaseError(owners.error);
  return {
    customers: customerOptionSchema.array().parse(customers.data),
    owners: ownerOptionSchema.array().parse(owners.data),
  };
}

export async function opportunityList(options: {
  page?: number;
  search?: string;
  stage?: string;
} = {}) {
  const client = await serverClient();
  const page = Math.max(1, options.page ?? 1);
  const size = 30;
  let query = client
    .from("opportunities")
    .select(opportunitySelect, { count: "exact" })
    .order("updated_at", { ascending: false })
    .order("id");
  if (options.stage) query = query.eq("stage", options.stage);
  if (options.search) {
    const search = options.search.replace(/[%_,().]/g, " ").trim().slice(0, 80);
    if (search)
      query = query.or(
        `title.ilike.%${search}%,opportunity_code.ilike.%${search}%,expected_project_name.ilike.%${search}%`,
      );
  }
  const { data, error, count } = await query.range((page - 1) * size, page * size - 1);
  if (error) throw databaseError(error);
  return { rows: opportunitySchema.array().parse(data), count: count ?? 0, page, size };
}

export async function opportunityReportList() {
  const client = await serverClient();
  const { data, error } = await client
    .from("opportunities")
    .select(opportunitySelect)
    .order("updated_at", { ascending: false })
    .order("id")
    .limit(1000);
  if (error) throw databaseError(error);
  return opportunitySchema.array().parse(data);
}

export async function opportunityDetail(id: string) {
  const client = await serverClient();
  const { data, error } = await client
    .from("opportunities")
    .select(opportunitySelect)
    .eq("id", id)
    .maybeSingle();
  if (error) throw databaseError(error);
  return data ? opportunitySchema.parse(data) : null;
}
