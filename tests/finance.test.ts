import { describe, expect, it } from "vitest";
import { financeCommandSchema, missingTaxInvoiceBuyerFields } from "../src/modules/finance/domain/finance";
import { apiErrorMessage } from "../src/shared/browser/api-error";
import { createTaxInvoicePdf } from "../src/modules/finance/application/tax-invoice-pdf";
import type { TaxInvoiceRow } from "../src/modules/finance/infrastructure/repository";

const uuid = () => crypto.randomUUID();
function fixture(status: "DRAFT" | "ISSUED" = "DRAFT"): TaxInvoiceRow {
  const id = uuid(); const customerId = uuid(); const projectId = uuid(); const contractId = uuid(); const billingId = uuid(); const now = new Date().toISOString();
  return {
    id, invoice_number: "TAX-202609-00001", billing_id: billingId, original_tax_invoice_id: null, correction_reason: "", issue_date: "2026-09-27", supply_date: "2026-09-27", purpose: "CHARGE", status,
    issue_channel: status === "ISSUED" ? "HOMETAX" : null, nts_approval_number: status === "ISSUED" ? "202609271234567890123456" : null,
    supplier_registration_number: "1234567890", supplier_name: "주식회사 디지털스퀘어", supplier_representative_name: "홍길동", supplier_address: "울산광역시 남구 테스트로 1", supplier_business_type: "정보통신업", supplier_business_item: "소프트웨어 개발", supplier_email: "finance@digitalsquare.local",
    buyer_registration_number: "0987654321", buyer_name: "테스트 고객 주식회사", buyer_representative_name: "김고객", buyer_address: "서울특별시 중구 고객로 2", buyer_business_type: "서비스업", buyer_business_item: "정보서비스", recipient_name: "재무팀", recipient_email: "billing@example.com",
    supply_amount: 10_000_000, vat_amount: 1_000_000, total_amount: 11_000_000,
    items: [{ date: "2026-09-27", name: "ERP 구축 용역", specification: "1식", quantity: 1, unitPrice: 10_000_000, supplyAmount: 10_000_000, vatAmount: 1_000_000, note: "" }], note: "검수 완료 후 청구",
    issued_at: status === "ISSUED" ? now : null, transmitted_at: status === "ISSUED" ? now : null, canceled_at: null, version: 1, created_at: now, updated_at: now,
    billing: { id: billingId, billing_number: "BIL-202609-00001", schedule_id: null, customer_id: customerId, project_id: projectId, contract_id: contractId, bank_account_id: uuid(), title: "ERP 구축 1차 청구", billing_date: "2026-09-27", due_date: "2026-10-31", supply_amount: 10_000_000, vat_rate: 10, vat_amount: 1_000_000, total_amount: 11_000_000, status: "BILLED", note: "", issued_at: now, canceled_at: null, version: 1, created_at: now, updated_at: now,
      customer: { id: customerId, customer_code: "TEST", name: "테스트 고객 주식회사", business_registration_number: "0987654321", representative_name: "김고객", address: "서울특별시 중구 고객로 2", business_type: "서비스업", business_item: "정보서비스", billing_contact_name: "재무팀", billing_email: "billing@example.com" },
      project: { id: projectId, project_code: "TEST-PJT", project_name: "ERP 구축", contract_id: contractId, customer_id: customerId },
      bank_account: { id: uuid(), bank_name: "기업은행", account_number: "123-456789-01-001", account_holder: "(주)디지털스퀘어", purpose: "수금계좌", is_default: true, active: true, note: "", version: 1, created_at: now, updated_at: now },
    },
  };
}

describe("Phase 3 finance commands and tax invoice output", () => {
  it("rejects invalid NTS approval numbers and accepts 24 digits", () => {
    const base = { id: uuid(), version: 1, issue_channel: "HOMETAX" as const };
    expect(() => financeCommandSchema.parse({ action: "tax_invoice.record_issue", payload: { ...base, nts_approval_number: "123" } })).toThrow();
    expect(financeCommandSchema.parse({ action: "tax_invoice.record_issue", payload: { ...base, nts_approval_number: "202609271234567890123456" } })).toMatchObject({ payload: { nts_approval_number: "202609271234567890123456" } });
  });

  it("accepts multiple line items and rejects a zero-quantity item", () => {
    const command = { action: "tax_invoice.save" as const, payload: { id: uuid(), version: 1, issue_date: "2026-09-27", supply_date: "2026-09-27", purpose: "CHARGE" as const, recipient_name: "재무팀", recipient_email: "billing@example.com", items: [{ date: "2026-09-27", name: "구축 용역", specification: "", quantity: 1, unitPrice: 1000, supplyAmount: 1000, vatAmount: 100, note: "" }], note: "" } };
    expect(financeCommandSchema.parse(command)).toMatchObject({ payload: { items: command.payload.items } });
    expect(() => financeCommandSchema.parse({ ...command, payload: { ...command.payload, items: [{ ...command.payload.items[0], quantity: 0 }] } })).toThrow();
  });

  it("lists every missing customer field required for a tax invoice", () => {
    const missing = missingTaxInvoiceBuyerFields({ business_registration_number: null, representative_name: null, address: "", business_type: "", business_item: "", billing_contact_name: "", billing_email: null });
    expect(missing.map((item) => item.label)).toEqual(["사업자등록번호", "대표자명", "사업장 주소", "업태", "종목", "세금계산서 담당자", "세금계산서 수신 이메일"]);
  });

  it("formats field errors, a recovery hint, and the request ID for users", () => {
    expect(apiErrorMessage({ error: { message: "고객사의 세금계산서 필수정보가 부족합니다.", requestId: "request-1", details: { fieldErrors: [{ label: "사업자등록번호", message: "고객사의 사업자등록번호를 입력해 주세요." }], hint: "고객사 상세에서 저장해 주세요." } } }, "실패", 400))
      .toContain("고객사의 사업자등록번호를 입력해 주세요.\n해결 방법: 고객사 상세에서 저장해 주세요.\n요청 ID: request-1");
  });

  it("generates readable draft and issued PDF documents", async () => {
    const draft = await createTaxInvoicePdf(fixture("DRAFT"));
    const issued = await createTaxInvoicePdf(fixture("ISSUED"));
    expect(draft.subarray(0, 5).toString()).toBe("%PDF-");
    expect(issued.subarray(0, 5).toString()).toBe("%PDF-");
    expect(draft.length).toBeGreaterThan(20_000);
    expect(issued.length).toBeGreaterThan(20_000);
  });
});
