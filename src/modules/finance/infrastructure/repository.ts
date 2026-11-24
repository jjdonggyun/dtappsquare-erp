import "server-only";
import { z } from "zod";
import { AppError, databaseError } from "@/shared/domain/errors";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import type { FinanceCommandRepository } from "../application/commands";
import { missingTaxInvoiceBuyerFields, taxInvoiceItemSchema } from "../domain/finance";

const customerSchema = z.object({
  id: z.uuid(), customer_code: z.string(), name: z.string(), business_registration_number: z.string().nullable(), representative_name: z.string().nullable(),
  address: z.string(), business_type: z.string(), business_item: z.string(), billing_contact_name: z.string(), billing_email: z.string().nullable(),
});
const projectSchema = z.object({ id: z.uuid(), project_code: z.string(), project_name: z.string(), contract_id: z.uuid().nullable(), customer_id: z.uuid().nullable() });
const contractSchema = z.object({ id: z.uuid(), contract_number: z.string(), contract_name: z.string(), customer_id: z.uuid(), total_amount: z.number(), status: z.string() });
const bankSchema = z.object({ id: z.uuid(), bank_name: z.string(), account_number: z.string(), account_holder: z.string(), purpose: z.string(), is_default: z.boolean(), active: z.boolean(), note: z.string(), version: z.number().int(), created_at: z.string(), updated_at: z.string() });
const profileSchema = z.object({ id: z.string(), business_registration_number: z.string(), company_name: z.string(), representative_name: z.string(), address: z.string(), business_type: z.string(), business_item: z.string(), email: z.string().nullable(), phone: z.string(), version: z.number().int(), updated_at: z.string() });

export const scheduleSchema = z.object({
  id: z.uuid(), contract_id: z.uuid(), project_id: z.uuid(), sequence_no: z.number().int(), title: z.string(), billing_condition: z.string(), scheduled_date: z.string(),
  supply_amount: z.number(), vat_rate: z.number(), vat_amount: z.number(), total_amount: z.number(), status: z.string(), note: z.string(), version: z.number().int(), created_at: z.string(), updated_at: z.string(),
  project: projectSchema.nullable(), contract: contractSchema.nullable(),
});

export const billingSchema = z.object({
  id: z.uuid(), billing_number: z.string(), schedule_id: z.uuid().nullable(), customer_id: z.uuid(), project_id: z.uuid(), contract_id: z.uuid(), bank_account_id: z.uuid().nullable(), title: z.string(),
  billing_date: z.string(), due_date: z.string(), supply_amount: z.number(), vat_rate: z.number(), vat_amount: z.number(), total_amount: z.number(), status: z.string(), note: z.string(),
  issued_at: z.string().nullable(), canceled_at: z.string().nullable(), version: z.number().int(), created_at: z.string(), updated_at: z.string(),
  customer: customerSchema.nullable(), project: projectSchema.nullable(), contract: contractSchema.nullable(), bank_account: bankSchema.nullable(),
});

export const taxInvoiceSchema = z.object({
  id: z.uuid(), invoice_number: z.string(), billing_id: z.uuid(), original_tax_invoice_id: z.uuid().nullable(), correction_reason: z.string(), issue_date: z.string(), supply_date: z.string(), purpose: z.string(), status: z.string(), issue_channel: z.string().nullable(), nts_approval_number: z.string().nullable(),
  supplier_registration_number: z.string(), supplier_name: z.string(), supplier_representative_name: z.string(), supplier_address: z.string(), supplier_business_type: z.string(), supplier_business_item: z.string(), supplier_email: z.string().nullable(),
  buyer_registration_number: z.string(), buyer_name: z.string(), buyer_representative_name: z.string(), buyer_address: z.string(), buyer_business_type: z.string(), buyer_business_item: z.string(), recipient_name: z.string(), recipient_email: z.string(),
  supply_amount: z.number(), vat_amount: z.number(), total_amount: z.number(), items: z.array(taxInvoiceItemSchema), note: z.string(), issued_at: z.string().nullable(), transmitted_at: z.string().nullable(), canceled_at: z.string().nullable(), version: z.number().int(), created_at: z.string(), updated_at: z.string(),
  billing: billingSchema.omit({ customer: true, project: true, contract: true, bank_account: true }).extend({ customer: customerSchema.nullable(), project: projectSchema.nullable(), bank_account: bankSchema.nullable() }).nullable(),
});

const paymentSchema = z.object({
  id: z.uuid(), payment_number: z.string(), customer_id: z.uuid(), project_id: z.uuid().nullable(), bank_account_id: z.uuid().nullable(), received_date: z.string(), amount: z.number(), payer_name: z.string(), bank_reference: z.string(), note: z.string(), status: z.string(), canceled_at: z.string().nullable(), version: z.number().int(), created_at: z.string(), updated_at: z.string(),
  customer: customerSchema.nullable(), project: projectSchema.nullable(), bank_account: bankSchema.nullable(),
});
const allocationSchema = z.object({ id: z.uuid(), payment_id: z.uuid(), billing_id: z.uuid(), amount: z.number(), created_at: z.string(), billing: z.object({ id: z.uuid(), billing_number: z.string(), title: z.string(), total_amount: z.number() }).nullable() });

const customerSelect = "id,customer_code,name,business_registration_number,representative_name,address,business_type,business_item,billing_contact_name,billing_email";
const billingSelect = `*,customer:customers(${customerSelect}),project:projects(id,project_code,project_name,contract_id,customer_id),contract:contracts(id,contract_number,contract_name,customer_id,total_amount,status),bank_account:company_bank_accounts(*)`;

export type BillingRow = z.infer<typeof billingSchema> & { allocatedAmount: number; outstandingAmount: number; displayStatus: string };
export type TaxInvoiceRow = z.infer<typeof taxInvoiceSchema>;

export function financeCommandRepository(): FinanceCommandRepository {
  return {
    async execute(command, requestId) {
      const client = await serverClient();
      if (command.action === "tax_invoice.create") {
        const [billingResult, profileResult] = await Promise.all([
          client.from("billings").select(`id,status,customer:customers(${customerSelect})`).eq("id", command.payload.billing_id).maybeSingle(),
          client.from("company_tax_profiles").select("id").eq("id", "default").maybeSingle(),
        ]);
        if (billingResult.error) throw databaseError(billingResult.error);
        if (profileResult.error) throw databaseError(profileResult.error);
        if (!billingResult.data) throw new AppError("NotFound", "세금계산서를 만들 청구를 찾을 수 없습니다.");
        if (!["BILLED", "PARTIALLY_PAID", "PAID"].includes(billingResult.data.status))
          throw new AppError("Conflict", "청구를 먼저 확정해 주세요.", { hint: "청구 상세에서 청구서 확정을 완료한 뒤 다시 시도해 주세요." });
        if (!profileResult.data)
          throw new AppError("ValidationError", "공급자 세무정보가 등록되지 않았습니다.", { hint: "재무 설정에서 회사 사업자정보를 먼저 등록해 주세요." });
        const customer = billingResult.data.customer ? customerSchema.parse(billingResult.data.customer) : null;
        const fieldErrors = missingTaxInvoiceBuyerFields(customer);
        if (fieldErrors.length)
          throw new AppError("ValidationError", "고객사의 세금계산서 필수정보가 부족합니다.", {
            fieldErrors,
            hint: "고객사 상세에서 누락 항목을 저장한 뒤 다시 생성해 주세요.",
          });
      }
      const { data, error } = await client.rpc("finance_command", { p_action: command.action, p_payload: command.payload, p_request_id: requestId });
      if (error) throw databaseError(error);
      return data;
    },
  };
}

export async function financeSettings() {
  const client = await serverClient();
  const [profile, accounts] = await Promise.all([
    client.from("company_tax_profiles").select("*").eq("id", "default").maybeSingle(),
    client.from("company_bank_accounts").select("*").order("is_default", { ascending: false }).order("created_at"),
  ]);
  if (profile.error) throw databaseError(profile.error);
  if (accounts.error) throw databaseError(accounts.error);
  return { profile: profile.data ? profileSchema.parse(profile.data) : null, accounts: bankSchema.array().parse(accounts.data) };
}

export async function financeOptions() {
  const client = await serverClient();
  const [projects, contracts, customers, banks] = await Promise.all([
    client.from("projects").select("id,project_code,project_name,contract_id,customer_id").not("contract_id", "is", null).order("project_code").limit(500),
    client.from("contracts").select("id,contract_number,contract_name,customer_id,total_amount,status").in("status", ["SIGNED", "ACTIVE", "COMPLETED"]).order("contract_number").limit(500),
    client.from("customers").select(customerSelect).eq("status", "ACTIVE").order("name").limit(500),
    client.from("company_bank_accounts").select("*").eq("active", true).order("is_default", { ascending: false }).limit(100),
  ]);
  for (const result of [projects, contracts, customers, banks]) if (result.error) throw databaseError(result.error);
  return { projects: projectSchema.array().parse(projects.data), contracts: contractSchema.array().parse(contracts.data), customers: customerSchema.array().parse(customers.data), banks: bankSchema.array().parse(banks.data) };
}

export async function billingScheduleList(projectId?: string) {
  const client = await serverClient();
  let query = client.from("billing_schedules").select("*,project:projects(id,project_code,project_name,contract_id,customer_id),contract:contracts(id,contract_number,contract_name,customer_id,total_amount,status)").order("scheduled_date").order("sequence_no");
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query.limit(500);
  if (error) throw databaseError(error);
  return scheduleSchema.array().parse(data);
}

async function attachBalances(rows: z.infer<typeof billingSchema>[]) {
  if (!rows.length) return [];
  const client = await serverClient();
  const { data, error } = await client.from("payment_allocations").select("billing_id,amount,payment:payments(status)").in("billing_id", rows.map((row) => row.id));
  if (error) throw databaseError(error);
  const totals = new Map<string, number>();
  for (const raw of data ?? []) {
    const row = z.object({ billing_id: z.uuid(), amount: z.number(), payment: z.object({ status: z.string() }).nullable() }).parse(raw);
    if (row.payment?.status === "CONFIRMED") totals.set(row.billing_id, (totals.get(row.billing_id) ?? 0) + row.amount);
  }
  const today = new Date().toISOString().slice(0, 10);
  return rows.map((row) => {
    const allocatedAmount = totals.get(row.id) ?? 0;
    const outstandingAmount = Math.max(0, row.total_amount - allocatedAmount);
    const displayStatus = !["DRAFT", "CANCELED", "PAID"].includes(row.status) && outstandingAmount > 0 && row.due_date < today ? "OVERDUE" : row.status;
    return { ...row, allocatedAmount, outstandingAmount, displayStatus };
  });
}

export async function billingList(options: { projectId?: string; customerId?: string } = {}) {
  const client = await serverClient();
  let query = client.from("billings").select(billingSelect).order("billing_date", { ascending: false }).order("created_at", { ascending: false });
  if (options.projectId) query = query.eq("project_id", options.projectId);
  if (options.customerId) query = query.eq("customer_id", options.customerId);
  const { data, error } = await query.limit(500);
  if (error) throw databaseError(error);
  return attachBalances(billingSchema.array().parse(data));
}

export async function billingDetail(id: string) {
  const client = await serverClient();
  const { data, error } = await client.from("billings").select(billingSelect).eq("id", id).maybeSingle();
  if (error) throw databaseError(error);
  if (!data) return null;
  const [billing] = await attachBalances([billingSchema.parse(data)]);
  const [taxes, allocations, payments] = await Promise.all([
    client.from("tax_invoices").select("id,invoice_number,issue_date,total_amount,status,nts_approval_number,version").eq("billing_id", id).order("created_at", { ascending: false }),
    client.from("payment_allocations").select("id,payment_id,billing_id,amount,created_at,payment:payments(id,payment_number,received_date,payer_name,status)").eq("billing_id", id).order("created_at", { ascending: false }),
    client.from("payments").select("id,payment_number,customer_id,amount,received_date,payer_name,status").eq("customer_id", billing.customer_id).eq("status", "CONFIRMED").order("received_date", { ascending: false }).limit(100),
  ]);
  for (const result of [taxes, allocations, payments]) if (result.error) throw databaseError(result.error);
  return { billing, taxInvoices: taxes.data ?? [], allocations: allocations.data ?? [], payments: payments.data ?? [] };
}

export async function taxInvoiceList() {
  const client = await serverClient();
  const { data, error } = await client.from("tax_invoices").select("id,invoice_number,billing_id,issue_date,supply_date,buyer_name,total_amount,status,nts_approval_number,updated_at,billing:billings(project:projects(id,project_code,project_name,contract_id,customer_id))").order("issue_date", { ascending: false }).order("created_at", { ascending: false }).limit(500);
  if (error) throw databaseError(error);
  return z.array(z.object({ id: z.uuid(), invoice_number: z.string(), billing_id: z.uuid(), issue_date: z.string(), supply_date: z.string(), buyer_name: z.string(), total_amount: z.number(), status: z.string(), nts_approval_number: z.string().nullable(), updated_at: z.string(), billing: z.object({ project: projectSchema.nullable() }).nullable() })).parse(data);
}

export async function taxInvoiceDetail(id: string) {
  const client = await serverClient();
  const { data, error } = await client.from("tax_invoices").select(`*,billing:billings(*,customer:customers(${customerSelect}),project:projects(id,project_code,project_name,contract_id,customer_id),bank_account:company_bank_accounts(*))`).eq("id", id).maybeSingle();
  if (error) throw databaseError(error);
  return data ? taxInvoiceSchema.parse(data) : null;
}

export async function paymentList() {
  const client = await serverClient();
  const [payments, allocations] = await Promise.all([
    client.from("payments").select(`*,customer:customers(${customerSelect}),project:projects(id,project_code,project_name,contract_id,customer_id),bank_account:company_bank_accounts(*)`).order("received_date", { ascending: false }).order("created_at", { ascending: false }).limit(500),
    client.from("payment_allocations").select("id,payment_id,billing_id,amount,created_at,billing:billings(id,billing_number,title,total_amount)").order("created_at", { ascending: false }).limit(1000),
  ]);
  if (payments.error) throw databaseError(payments.error);
  if (allocations.error) throw databaseError(allocations.error);
  const parsedPayments = paymentSchema.array().parse(payments.data);
  const parsedAllocations = allocationSchema.array().parse(allocations.data);
  return parsedPayments.map((payment) => {
    const rows = parsedAllocations.filter((allocation) => allocation.payment_id === payment.id);
    const allocatedAmount = rows.reduce((sum, row) => sum + row.amount, 0);
    return { ...payment, allocations: rows, allocatedAmount, remainingAmount: Math.max(0, payment.amount - allocatedAmount) };
  });
}
