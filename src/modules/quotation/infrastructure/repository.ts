import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
import type { QuotationCommandRepository } from "../application/commands";

const customerLabelSchema = z.object({ id: z.uuid(), customer_code: z.string(), name: z.string() });
const opportunityLabelSchema = z.object({
  id: z.uuid(),
  opportunity_code: z.string(),
  title: z.string(),
  expected_project_name: z.string(),
  stage: z.string(),
});

export const quotationRevisionSchema = z.object({
  id: z.uuid(),
  quotation_id: z.uuid(),
  revision_no: z.number().int(),
  project_name: z.string(),
  quotation_date: z.string(),
  valid_until: z.string(),
  vat_rate: z.number(),
  supply_amount: z.number(),
  vat_amount: z.number(),
  total_amount: z.number(),
  expected_cost: z.number(),
  expected_profit: z.number(),
  expected_profit_rate: z.number(),
  note: z.string(),
  status: z.string(),
  approval_subject_id: z.uuid().nullable(),
  created_by: z.uuid(),
  updated_by: z.uuid(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const quotationItemSchema = z.object({
  id: z.uuid(),
  revision_id: z.uuid(),
  item_name: z.string(),
  role_name: z.string(),
  headcount: z.number().int(),
  man_month: z.number(),
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  quantity: z.number(),
  unit_price: z.number(),
  amount: z.number(),
  note: z.string(),
  sort_order: z.number().int(),
  active: z.boolean(),
  created_by: z.uuid(),
  updated_by: z.uuid(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const quotationSchema = z.object({
  id: z.uuid(),
  quotation_number: z.string(),
  customer_id: z.uuid(),
  opportunity_id: z.uuid(),
  current_revision_id: z.uuid().nullable(),
  approved_revision_id: z.uuid().nullable(),
  status: z.string(),
  created_by: z.uuid(),
  updated_by: z.uuid(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  customer: customerLabelSchema.nullable(),
  opportunity: opportunityLabelSchema.nullable(),
  current_revision: quotationRevisionSchema.nullable(),
});

const quotationSelect =
  "*,customer:customers(id,customer_code,name),opportunity:opportunities(id,opportunity_code,title,expected_project_name,stage),current_revision:quotation_revisions!quotations_current_revision_fkey(*)";

export function quotationCommandRepository(): QuotationCommandRepository {
  return {
    async execute(command, requestId) {
      const client = await serverClient();
      const { data, error } = await client.rpc("quotation_command", {
        p_action: command.action,
        p_payload: command.payload,
        p_request_id: requestId,
      });
      if (error) throw databaseError(error);
      return data;
    },
  };
}

export async function quotationOptions() {
  const client = await serverClient();
  const { data, error } = await client
    .from("opportunities")
    .select("id,opportunity_code,title,expected_project_name,stage,customer:customers(id,customer_code,name)")
    .not("stage", "in", '("LOST","ARCHIVED")')
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw databaseError(error);
  return z
    .array(
      opportunityLabelSchema.extend({
        customer: customerLabelSchema.nullable(),
      }),
    )
    .parse(data);
}

export async function quotationList(options: {
  page?: number;
  search?: string;
  status?: string;
} = {}) {
  const client = await serverClient();
  const page = Math.max(1, options.page ?? 1);
  const size = 30;
  let query = client
    .from("quotations")
    .select(quotationSelect, { count: "exact" })
    .order("updated_at", { ascending: false })
    .order("id");
  if (options.status) query = query.eq("status", options.status);
  if (options.search) {
    const search = options.search.replace(/[%_,().]/g, " ").trim().slice(0, 80);
    if (search) query = query.ilike("quotation_number", `%${search}%`);
  }
  const { data, error, count } = await query.range((page - 1) * size, page * size - 1);
  if (error) throw databaseError(error);
  return { rows: quotationSchema.array().parse(data), count: count ?? 0, page, size };
}

export async function quotationReportList() {
  const client = await serverClient();
  const { data, error } = await client
    .from("quotations")
    .select(quotationSelect)
    .order("updated_at", { ascending: false })
    .order("id")
    .limit(1000);
  if (error) throw databaseError(error);
  return quotationSchema.array().parse(data);
}

export async function quotationDetail(id: string) {
  const client = await serverClient();
  const quoteResult = await client.from("quotations").select(quotationSelect).eq("id", id).maybeSingle();
  if (quoteResult.error) throw databaseError(quoteResult.error);
  if (!quoteResult.data) return null;
  const quote = quotationSchema.parse(quoteResult.data);
  const [revisions, items] = await Promise.all([
    client
      .from("quotation_revisions")
      .select("*")
      .eq("quotation_id", id)
      .order("revision_no", { ascending: false }),
    quote.current_revision_id
      ? client
          .from("quotation_items")
          .select("*")
          .eq("revision_id", quote.current_revision_id)
          .eq("active", true)
          .order("sort_order")
          .order("id")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (revisions.error) throw databaseError(revisions.error);
  if (items.error) throw databaseError(items.error);
  return {
    quote,
    revisions: quotationRevisionSchema.array().parse(revisions.data),
    items: quotationItemSchema.array().parse(items.data),
  };
}
