import { z } from "zod";

const id = z.uuid();
const optionalId = z.preprocess((value) => (value === "" ? undefined : value), id.optional());
const version = z.number().int().positive();

export const expenseSourceTypes = ["CARD", "CASH", "TRANSFER", "INVOICE", "OTHER"] as const;
export const expenseSourceLabels: Record<(typeof expenseSourceTypes)[number], string> = {
  CARD: "법인카드",
  CASH: "현금",
  TRANSFER: "계좌이체",
  INVOICE: "세금계산서·청구서",
  OTHER: "기타",
};

export const expenseApprovalLabels: Record<string, string> = {
  DRAFT: "작성 중",
  SUBMITTED: "승인 대기",
  APPROVED: "승인",
  REJECTED: "반려",
  CANCELED: "취소",
};

export const expenseFinanceCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("expense_type.save"), payload: z.object({
    id: optionalId, version: version.optional(), code: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,39}$/),
    name: z.string().trim().min(1).max(100), account_code: z.string().trim().max(30).optional(),
    vat_deductible: z.boolean().optional(), active: z.boolean().optional(), sort_order: z.number().int().min(0).optional(),
    note: z.string().max(1000).optional(),
  }) }),
  z.object({ action: z.literal("vendor.save"), payload: z.object({
    id: optionalId, version: version.optional(), name: z.string().trim().min(1).max(160),
    business_registration_number: z.string().max(20).refine((value) => value === "" || value.replace(/\D/g, "").length === 10, "사업자등록번호 10자리를 입력해 주세요.").optional(), representative_name: z.string().max(100).optional(),
    address: z.string().max(500).optional(), business_type: z.string().max(120).optional(), business_item: z.string().max(120).optional(),
    contact_name: z.string().max(100).optional(), contact_email: z.union([z.email(), z.literal("")]).optional(),
    contact_phone: z.string().max(50).optional(), status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
    note: z.string().max(2000).optional(),
  }) }),
  z.object({ action: z.literal("expense.save"), payload: z.object({
    id: optionalId, version: version.optional(), transaction_date: z.iso.date(), project_id: id,
    corporate_card_id: optionalId, expense_type_id: id, vendor_id: optionalId,
    source_type: z.enum(expenseSourceTypes), merchant: z.string().trim().min(1).max(200),
    purpose: z.string().trim().min(1).max(500), supply_amount: z.number().min(0).max(999_999_999_999),
    vat_amount: z.number().min(0).max(999_999_999_999), memo: z.string().max(2000).optional(),
  }).superRefine((value, context) => {
    if ((value.source_type === "CARD") !== Boolean(value.corporate_card_id))
      context.addIssue({ code: "custom", path: ["corporate_card_id"], message: "법인카드 비용은 카드를 선택해야 합니다." });
  }) }),
  z.object({ action: z.literal("expense.submit"), payload: z.object({ id, version }) }),
  z.object({ action: z.literal("expense.approve"), payload: z.object({ id, version, mark_paid: z.boolean().optional(), payment_reference: z.string().max(200).optional() }) }),
  z.object({ action: z.literal("expense.reject"), payload: z.object({ id, version, reason: z.string().trim().min(2).max(1000) }) }),
  z.object({ action: z.literal("expense.mark_paid"), payload: z.object({ id, version, paid_at: z.string().optional(), payment_reference: z.string().max(200).optional() }) }),
  z.object({ action: z.literal("expense.cancel"), payload: z.object({ id, version }) }),
  z.object({ action: z.literal("project.close"), payload: z.object({ project_id: id, version, as_of_date: z.iso.date(), note: z.string().max(2000).optional() }) }),
  z.object({ action: z.literal("project.reopen"), payload: z.object({ project_id: id, version, reason: z.string().trim().min(5).max(1000) }) }),
]);

export type ExpenseFinanceCommand = z.infer<typeof expenseFinanceCommandSchema>;

export const projectFinancialSummarySchema = z.object({
  project_id: id, project_code: z.string(), project_name: z.string(), customer_name: z.string(), status: z.string(), as_of_date: z.string(),
  closed_at: z.string().nullable(), contract_supply_amount: z.number(), contract_vat_amount: z.number(), contract_total_amount: z.number(),
  billed_supply_amount: z.number(), billed_total_amount: z.number(), tax_issued_total_amount: z.number(), received_amount: z.number(),
  outstanding_amount: z.number(), planned_labor_cost: z.number(), actual_work_minutes: z.number(), labor_cost: z.number(),
  expense_recorded_total: z.number(), expense_cost: z.number(), total_cost: z.number(), gross_profit: z.number(),
  profit_margin: z.number().nullable(), forecast_total_cost: z.number(), forecast_gross_profit: z.number(),
  expense_by_type: z.record(z.string(), z.number()),
});

export const closingCheckSchema = z.object({
  project_id: id, as_of_date: z.string(), can_close: z.boolean(),
  checks: z.array(z.object({ code: z.string(), label: z.string(), passed: z.boolean(), detail: z.string() })),
  financial_summary: projectFinancialSummarySchema,
});
