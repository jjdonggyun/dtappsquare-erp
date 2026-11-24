import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
import type { ContractCommandRepository } from "../application/commands";

const customerLabelSchema = z.object({ id: z.uuid(), customer_code: z.string(), name: z.string() });
const opportunityLabelSchema = z.object({ id: z.uuid(), opportunity_code: z.string(), title: z.string() });
const revisionLabelSchema = z.object({
  id: z.uuid(),
  quotation_id: z.uuid(),
  revision_no: z.number().int(),
  project_name: z.string(),
  supply_amount: z.number(),
  vat_rate: z.number(),
  total_amount: z.number(),
  status: z.string(),
});

export const contractSchema = z.object({
  id: z.uuid(),
  contract_number: z.string(),
  customer_id: z.uuid(),
  opportunity_id: z.uuid(),
  quotation_revision_id: z.uuid(),
  contract_name: z.string(),
  purchase_order_number: z.string(),
  contract_date: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  signed_date: z.string().nullable(),
  supply_amount: z.number(),
  vat_rate: z.number(),
  vat_amount: z.number(),
  total_amount: z.number(),
  payment_terms: z.string(),
  warranty_terms: z.string(),
  note: z.string(),
  status: z.string(),
  approval_subject_id: z.uuid().nullable(),
  current_amendment_no: z.number().int(),
  created_by: z.uuid(),
  updated_by: z.uuid(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  customer: customerLabelSchema.nullable(),
  opportunity: opportunityLabelSchema.nullable(),
  quotation_revision: revisionLabelSchema.nullable(),
});

const amendmentSchema = z.object({
  id: z.uuid(),
  contract_id: z.uuid(),
  amendment_no: z.number().int(),
  reason: z.string(),
  snapshot: z.unknown(),
  created_by: z.uuid(),
  created_at: z.string(),
});

const projectLinkSchema = z.object({
  id: z.uuid(),
  project_code: z.string(),
  project_name: z.string(),
  status: z.string(),
});

const contractSelect =
  "*,customer:customers(id,customer_code,name),opportunity:opportunities(id,opportunity_code,title),quotation_revision:quotation_revisions!contracts_quotation_revision_id_fkey(id,quotation_id,revision_no,project_name,supply_amount,vat_rate,total_amount,status)";

export function contractCommandRepository(): ContractCommandRepository {
  return {
    async execute(command, requestId) {
      const client = await serverClient();
      const { data, error } = await client.rpc("contract_command", {
        p_action: command.action,
        p_payload: command.payload,
        p_request_id: requestId,
      });
      if (error) throw databaseError(error);
      return data;
    },
  };
}

export async function contractOptions() {
  const client = await serverClient();
  const [revisions, quotations, existing, directory] = await Promise.all([
    client.from("quotation_revisions").select("id,quotation_id,revision_no,project_name,supply_amount,vat_rate,total_amount,status").eq("status", "APPROVED").limit(500),
    client.from("quotations").select("id,quotation_number,approved_revision_id,status,customer:customers(id,customer_code,name),opportunity:opportunities(id,opportunity_code,title)").eq("status", "APPROVED").limit(500),
    client.from("contracts").select("quotation_revision_id").limit(500),
    client.rpc("employee_directory"),
  ]);
  for (const result of [revisions, quotations, existing, directory])
    if (result.error) throw databaseError(result.error);
  const revisionRows = revisionLabelSchema.array().parse(revisions.data);
  const quoteRows = z.array(z.object({
    id: z.uuid(),
    quotation_number: z.string(),
    approved_revision_id: z.uuid().nullable(),
    status: z.string(),
    customer: customerLabelSchema.nullable(),
    opportunity: opportunityLabelSchema.nullable(),
  })).parse(quotations.data);
  const used = new Set(z.array(z.object({ quotation_revision_id: z.uuid() })).parse(existing.data).map((row) => row.quotation_revision_id));
  const quoteByRevision = new Map(quoteRows.filter((quote) => quote.approved_revision_id).map((quote) => [quote.approved_revision_id!, quote]));
  return {
    sources: revisionRows.flatMap((revision) => {
      const quote = quoteByRevision.get(revision.id);
      return quote && !used.has(revision.id) ? [{ revision, quote }] : [];
    }),
    managers: z.array(z.object({ id: z.uuid(), name: z.string() })).parse(directory.data),
  };
}

export async function contractList(options: { page?: number; search?: string; status?: string } = {}) {
  const client = await serverClient();
  const page = Math.max(1, options.page ?? 1);
  const size = 30;
  let query = client.from("contracts").select(contractSelect, { count: "exact" }).order("updated_at", { ascending: false }).order("id");
  if (options.status) query = query.eq("status", options.status);
  if (options.search) {
    const search = options.search.replace(/[%_,().]/g, " ").trim().slice(0, 80);
    if (search) query = query.or(`contract_number.ilike.%${search}%,contract_name.ilike.%${search}%,purchase_order_number.ilike.%${search}%`);
  }
  const { data, error, count } = await query.range((page - 1) * size, page * size - 1);
  if (error) throw databaseError(error);
  return { rows: contractSchema.array().parse(data), count: count ?? 0, page, size };
}

export async function contractDetail(id: string) {
  const client = await serverClient();
  const contractResult = await client.from("contracts").select(contractSelect).eq("id", id).maybeSingle();
  if (contractResult.error) throw databaseError(contractResult.error);
  if (!contractResult.data) return null;
  const [amendments, project] = await Promise.all([
    client.from("contract_amendments").select("*").eq("contract_id", id).order("amendment_no", { ascending: false }),
    client.from("projects").select("id,project_code,project_name,status").eq("contract_id", id).maybeSingle(),
  ]);
  if (amendments.error) throw databaseError(amendments.error);
  if (project.error) throw databaseError(project.error);
  return {
    contract: contractSchema.parse(contractResult.data),
    amendments: amendmentSchema.array().parse(amendments.data),
    project: project.data ? projectLinkSchema.parse(project.data) : null,
  };
}
