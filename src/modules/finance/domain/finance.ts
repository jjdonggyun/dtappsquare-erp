import { z } from "zod";

export const taxInvoiceItemSchema = z.object({
  date: z.iso.date(),
  name: z.string().trim().min(1).max(200),
  specification: z.string().trim().max(120).default(""),
  quantity: z.number().positive().max(999999),
  unitPrice: z.number().min(0).max(999_999_999_999),
  supplyAmount: z.number().min(0).max(999_999_999_999),
  vatAmount: z.number().min(0).max(999_999_999_999),
  note: z.string().trim().max(200).default(""),
});

const id = z.uuid();
const optionalId = z.preprocess((value) => value === "" ? undefined : value, z.uuid().optional());
const version = z.number().int().positive();

export const financeCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("company_tax_profile.save"), payload: z.object({
    version: version.optional(), business_registration_number: z.string().min(10).max(20),
    company_name: z.string().trim().min(1).max(160), representative_name: z.string().trim().min(1).max(100),
    address: z.string().trim().min(1).max(500), business_type: z.string().trim().min(1).max(120),
    business_item: z.string().trim().min(1).max(120), email: z.union([z.email(), z.literal("")]).optional(),
    phone: z.string().max(50).optional(),
  }) }),
  z.object({ action: z.literal("bank_account.save"), payload: z.object({
    id: id.optional(), version: version.optional(), bank_name: z.string().trim().min(1).max(80),
    account_number: z.string().trim().min(8).max(40), account_holder: z.string().trim().min(1).max(100),
    purpose: z.string().trim().max(100).optional(), is_default: z.boolean().optional(), active: z.boolean().optional(), note: z.string().max(1000).optional(),
  }) }),
  z.object({ action: z.literal("schedule.save"), payload: z.object({
    id: id.optional(), version: version.optional(), contract_id: id, project_id: id, sequence_no: z.number().int().positive(),
    title: z.string().trim().min(1).max(200), billing_condition: z.string().max(1000).optional(), scheduled_date: z.iso.date(),
    supply_amount: z.number().min(0), vat_rate: z.number().min(0).max(100), status: z.enum(["SCHEDULED", "READY"]).optional(), note: z.string().max(2000).optional(),
  }) }),
  z.object({ action: z.literal("schedule.cancel"), payload: z.object({ id, version }) }),
  z.object({ action: z.literal("billing.create"), payload: z.object({
    schedule_id: id, bank_account_id: optionalId, billing_date: z.iso.date(), due_date: z.iso.date(), note: z.string().max(2000).optional(),
  }) }),
  z.object({ action: z.literal("billing.issue"), payload: z.object({ id, version }) }),
  z.object({ action: z.literal("billing.cancel"), payload: z.object({ id, version }) }),
  z.object({ action: z.literal("tax_invoice.create"), payload: z.object({ billing_id: id, issue_date: z.iso.date(), supply_date: z.iso.date(), purpose: z.enum(["CHARGE", "RECEIPT"]), note: z.string().max(2000).optional() }) }),
  z.object({ action: z.literal("tax_invoice.save"), payload: z.object({ id, version, issue_date: z.iso.date(), supply_date: z.iso.date(), purpose: z.enum(["CHARGE", "RECEIPT"]), recipient_name: z.string().max(100), recipient_email: z.email(), items: z.array(taxInvoiceItemSchema).min(1).max(99), note: z.string().max(2000).optional() }) }),
  z.object({ action: z.literal("tax_invoice.ready"), payload: z.object({ id, version }) }),
  z.object({ action: z.literal("tax_invoice.cancel"), payload: z.object({ id, version }) }),
  z.object({ action: z.literal("tax_invoice.record_issue"), payload: z.object({ id, version, issue_channel: z.enum(["HOMETAX", "ASP", "CERTIFIED_ERP"]), nts_approval_number: z.string().regex(/^[0-9]{24}$/), transmitted_at: z.string().optional() }) }),
  z.object({ action: z.literal("payment.save"), payload: z.object({ id: optionalId, version: version.optional(), customer_id: id, project_id: optionalId, bank_account_id: optionalId, received_date: z.iso.date(), amount: z.number().positive(), payer_name: z.string().trim().min(1).max(160), bank_reference: z.string().max(200).optional(), note: z.string().max(2000).optional() }) }),
  z.object({ action: z.literal("payment.allocate"), payload: z.object({ payment_id: id, billing_id: id, amount: z.number().positive() }) }),
  z.object({ action: z.literal("payment.cancel"), payload: z.object({ id, version }) }),
]);

export type FinanceCommand = z.infer<typeof financeCommandSchema>;
export type TaxInvoiceItem = z.infer<typeof taxInvoiceItemSchema>;

export type TaxInvoiceBuyer = {
  business_registration_number: string | null;
  representative_name: string | null;
  address: string;
  business_type: string;
  business_item: string;
  billing_contact_name: string;
  billing_email: string | null;
};

const taxInvoiceBuyerRequirements: Array<[keyof TaxInvoiceBuyer, string]> = [
  ["business_registration_number", "사업자등록번호"],
  ["representative_name", "대표자명"],
  ["address", "사업장 주소"],
  ["business_type", "업태"],
  ["business_item", "종목"],
  ["billing_contact_name", "세금계산서 담당자"],
  ["billing_email", "세금계산서 수신 이메일"],
];

export function missingTaxInvoiceBuyerFields(customer: TaxInvoiceBuyer | null) {
  if (!customer)
    return [{ field: "customer_id", label: "고객사", message: "청구에 연결된 고객사를 확인해 주세요." }];
  return taxInvoiceBuyerRequirements.flatMap(([field, label]) =>
    String(customer[field] ?? "").trim()
      ? []
      : [{ field: `customer.${field}`, label, message: `고객사의 ${label}을(를) 입력해 주세요.` }],
  );
}

export const billingStatusLabels: Record<string, string> = {
  DRAFT: "초안", BILLED: "청구", PARTIALLY_PAID: "부분입금", PAID: "입금완료", OVERDUE: "연체", CANCELED: "취소",
};
export const taxInvoiceStatusLabels: Record<string, string> = {
  DRAFT: "작성 중", READY: "발행자료 확정", ISSUED: "전자발급 완료", CANCELED: "취소",
};
export const scheduleStatusLabels: Record<string, string> = {
  SCHEDULED: "예정", READY: "청구 준비", BILLED: "청구 생성", CANCELED: "취소",
};
