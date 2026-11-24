import { mkdir, writeFile } from "node:fs/promises";
import { createTaxInvoicePdf } from "../src/modules/finance/application/tax-invoice-pdf";
import type { TaxInvoiceRow } from "../src/modules/finance/infrastructure/repository";

const now = new Date().toISOString();
const customerId = crypto.randomUUID(), projectId = crypto.randomUUID(), contractId = crypto.randomUUID(), billingId = crypto.randomUUID();
const invoice: TaxInvoiceRow = {
  id: crypto.randomUUID(), invoice_number: "TAX-202609-00001", billing_id: billingId, original_tax_invoice_id: null, correction_reason: "", issue_date: "2026-09-27", supply_date: "2026-09-27", purpose: "CHARGE", status: "ISSUED", issue_channel: "HOMETAX", nts_approval_number: "202609271234567890123456",
  supplier_registration_number: "1234567890", supplier_name: "주식회사 디지털스퀘어", supplier_representative_name: "최대표", supplier_address: "울산광역시 남구 산업로 100", supplier_business_type: "정보통신업", supplier_business_item: "소프트웨어 개발 및 공급", supplier_email: "finance@digitalsquare.local",
  buyer_registration_number: "0987654321", buyer_name: "현대테스트 주식회사", buyer_representative_name: "김대표", buyer_address: "울산광역시 동구 방어진순환도로 1000", buyer_business_type: "제조업", buyer_business_item: "선박 및 해양플랜트", recipient_name: "재무팀", recipient_email: "billing@example.com",
  supply_amount: 35_000_000, vat_amount: 3_500_000, total_amount: 38_500_000,
  items: [
    { date: "2026-09-01", name: "ERP 프로젝트 착수금", specification: "1식", quantity: 1, unitPrice: 20_000_000, supplyAmount: 20_000_000, vatAmount: 2_000_000, note: "계약금" },
    { date: "2026-09-27", name: "요구사항 분석 및 설계", specification: "1식", quantity: 1, unitPrice: 15_000_000, supplyAmount: 15_000_000, vatAmount: 1_500_000, note: "1차 검수" },
  ], note: "계약서 제3조에 따른 1차 청구", issued_at: now, transmitted_at: now, canceled_at: null, version: 1, created_at: now, updated_at: now,
  billing: {
    id: billingId, billing_number: "BIL-202609-00001", schedule_id: null, customer_id: customerId, project_id: projectId, contract_id: contractId, bank_account_id: crypto.randomUUID(), title: "ERP 구축 1차 청구", billing_date: "2026-09-27", due_date: "2026-10-31", supply_amount: 35_000_000, vat_rate: 10, vat_amount: 3_500_000, total_amount: 38_500_000, status: "BILLED", note: "", issued_at: now, canceled_at: null, version: 1, created_at: now, updated_at: now,
    customer: { id: customerId, customer_code: "HDT", name: "현대테스트 주식회사", business_registration_number: "0987654321", representative_name: "김대표", address: "울산광역시 동구 방어진순환도로 1000", business_type: "제조업", business_item: "선박 및 해양플랜트", billing_contact_name: "재무팀", billing_email: "billing@example.com" }, project: { id: projectId, project_code: "ERP-2026-01", project_name: "통합 ERP 구축", contract_id: contractId, customer_id: customerId },
    bank_account: { id: crypto.randomUUID(), bank_name: "기업은행", account_number: "123-456789-01-001", account_holder: "(주)디지털스퀘어", purpose: "수금계좌", is_default: true, active: true, note: "", version: 1, created_at: now, updated_at: now },
  },
};

await mkdir("output/pdf", { recursive: true });
const path = "output/pdf/phase3-tax-invoice-sample.pdf";
await writeFile(path, await createTaxInvoicePdf(invoice));
console.log(path);
