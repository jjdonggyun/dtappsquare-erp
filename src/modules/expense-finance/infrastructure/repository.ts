import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
import type { ExpenseFinanceCommandRepository } from "../application/commands";
import { closingCheckSchema, projectFinancialSummarySchema } from "../domain/contracts";

export const expenseTypeSchema = z.object({
  id: z.uuid(), code: z.string(), name: z.string(), account_code: z.string(), vat_deductible: z.boolean(), active: z.boolean(),
  sort_order: z.number().int(), note: z.string(), version: z.number().int(), created_at: z.string(), updated_at: z.string(),
});
export const vendorSchema = z.object({
  id: z.uuid(), vendor_code: z.string(), name: z.string(), business_registration_number: z.string().nullable(),
  representative_name: z.string(), address: z.string(), business_type: z.string(), business_item: z.string(), contact_name: z.string(),
  contact_email: z.string().nullable(), contact_phone: z.string(), status: z.string(), note: z.string(), version: z.number().int(),
  created_at: z.string(), updated_at: z.string(),
});
const projectOptionSchema = z.object({
  id: z.uuid(), project_code: z.string(), project_name: z.string(), project_manager_id: z.uuid(), status: z.string(),
  version: z.number().int(), closed_at: z.string().nullable(),
});
const cardOptionSchema = z.object({ id: z.uuid(), card_name: z.string(), last_four: z.string(), status: z.string() });

export const unifiedExpenseSchema = z.object({
  id: z.uuid(), transaction_date: z.string(), project_id: z.uuid(), corporate_card_id: z.uuid().nullable(), user_id: z.uuid(),
  merchant: z.string(), purpose: z.string(), category: z.string(), expense_type_id: z.uuid().nullable(), vendor_id: z.uuid().nullable(),
  source_type: z.string(), supply_amount: z.number(), vat_amount: z.number(), total_amount: z.number(), memo: z.string(),
  receipt_key: z.string().nullable(), settlement_status: z.string(), approval_status: z.string(), submitted_at: z.string().nullable(),
  reviewed_at: z.string().nullable(), reviewed_by: z.uuid().nullable(), rejection_reason: z.string(), paid_at: z.string().nullable(),
  payment_reference: z.string(), deleted_at: z.string().nullable(), version: z.number().int(), created_at: z.string(), updated_at: z.string(),
  project: z.object({ id: z.uuid(), project_code: z.string(), project_name: z.string() }).nullable(),
  expense_type: z.object({ id: z.uuid(), code: z.string(), name: z.string(), vat_deductible: z.boolean() }).nullable(),
  vendor: z.object({ id: z.uuid(), vendor_code: z.string(), name: z.string() }).nullable(),
  card: z.object({ id: z.uuid(), card_name: z.string(), last_four: z.string() }).nullable(),
  user: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});

export const projectClosingSchema = z.object({
  id: z.uuid(), project_id: z.uuid(), closing_no: z.number().int(), as_of_date: z.string(), status: z.string(),
  checklist_snapshot: z.unknown(), financial_snapshot: projectFinancialSummarySchema, note: z.string(), closed_by: z.uuid(),
  closed_at: z.string(), reopened_by: z.uuid().nullable(), reopened_at: z.string().nullable(), reopen_reason: z.string(),
  version: z.number().int(), created_at: z.string(), updated_at: z.string(),
});

export function expenseFinanceCommandRepository(): ExpenseFinanceCommandRepository {
  return {
    async execute(command, requestId) {
      const client = await serverClient();
      const { data, error } = await client.rpc("expense_finance_command", {
        p_action: command.action,
        p_payload: command.payload,
        p_request_id: requestId,
      });
      if (error) throw databaseError(error);
      return data;
    },
  };
}

export async function expenseFinanceCatalogs() {
  const client = await serverClient();
  const [types, vendors, projects, cards, assignments] = await Promise.all([
    client.from("expense_types").select("*").order("sort_order").order("name"),
    client.from("vendors").select("*").order("name").limit(1000),
    client.from("projects").select("id,project_code,project_name,project_manager_id,status,version,closed_at").is("archived_at", null).order("project_code").limit(1000),
    client.from("corporate_cards").select("id,card_name,last_four,status").eq("status", "ACTIVE").order("card_name").limit(500),
    client.from("project_card_assignments").select("project_id,corporate_card_id,assigned_from,assigned_to,status").eq("status", "ACTIVE").limit(1000),
  ]);
  for (const result of [types, vendors, projects, cards, assignments]) if (result.error) throw databaseError(result.error);
  return {
    types: expenseTypeSchema.array().parse(types.data),
    vendors: vendorSchema.array().parse(vendors.data),
    projects: projectOptionSchema.array().parse(projects.data),
    cards: cardOptionSchema.array().parse(cards.data),
    assignments: z.array(z.object({ project_id: z.uuid(), corporate_card_id: z.uuid(), assigned_from: z.string(), assigned_to: z.string().nullable(), status: z.string() })).parse(assignments.data),
  };
}

export async function expenseLedger(projectId?: string) {
  const client = await serverClient();
  let query = client.from("expenses").select(
    "*,project:projects(id,project_code,project_name),expense_type:expense_types(id,code,name,vat_deductible),vendor:vendors(id,vendor_code,name),card:corporate_cards(id,card_name,last_four),user:employees!expenses_user_id_fkey(id,name)",
  ).is("deleted_at", null).order("transaction_date", { ascending: false }).order("created_at", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query.limit(1000);
  if (error) throw databaseError(error);
  return unifiedExpenseSchema.array().parse(data);
}

export async function projectFinancialSummary(projectId: string, asOf: string) {
  const client = await serverClient();
  const { data, error } = await client.rpc("project_financial_summary", { p_project_id: projectId, p_as_of: asOf });
  if (error) throw databaseError(error);
  return projectFinancialSummarySchema.parse(data);
}

export async function projectFinancialPortfolio(asOf: string) {
  const client = await serverClient();
  const { data, error } = await client.rpc("project_financial_portfolio", { p_as_of: asOf });
  if (error) throw databaseError(error);
  return projectFinancialSummarySchema.array().parse(data);
}

export async function projectClosing(projectId: string, asOf: string) {
  const client = await serverClient();
  const [check, history] = await Promise.all([
    client.rpc("project_closing_check", { p_project_id: projectId, p_as_of: asOf }),
    client.from("project_closings").select("*").eq("project_id", projectId).order("closing_no", { ascending: false }).limit(50),
  ]);
  if (check.error) throw databaseError(check.error);
  if (history.error) throw databaseError(history.error);
  return { check: closingCheckSchema.parse(check.data), history: projectClosingSchema.array().parse(history.data) };
}
