import { describe, expect, it } from "vitest";
import { expenseFinanceCommandSchema, projectFinancialSummarySchema } from "../src/modules/expense-finance/domain/contracts";

describe("Phase 4 expense, profitability, and closing contracts", () => {
  it("requires a corporate card only for CARD expenses", () => {
    const base = {
      transaction_date: "2026-09-27", project_id: crypto.randomUUID(), expense_type_id: crypto.randomUUID(),
      vendor_id: "", merchant: "테스트 거래처", purpose: "프로젝트 비용", supply_amount: 100_000, vat_amount: 10_000, memo: "",
    };
    expect(() => expenseFinanceCommandSchema.parse({ action: "expense.save", payload: { ...base, source_type: "CARD", corporate_card_id: "" } })).toThrow();
    expect(expenseFinanceCommandSchema.parse({ action: "expense.save", payload: { ...base, source_type: "TRANSFER", corporate_card_id: "" } })).toMatchObject({ payload: { source_type: "TRANSFER" } });
  });

  it("requires a meaningful reopen reason and preserves financial fields", () => {
    expect(() => expenseFinanceCommandSchema.parse({ action: "project.reopen", payload: { project_id: crypto.randomUUID(), version: 2, reason: "짧음" } })).toThrow();
    const summary = projectFinancialSummarySchema.parse({
      project_id: crypto.randomUUID(), project_code: "P-001", project_name: "ERP", customer_name: "고객", status: "IN_PROGRESS",
      as_of_date: "2026-09-27", closed_at: null, contract_supply_amount: 10_000_000, contract_vat_amount: 1_000_000,
      contract_total_amount: 11_000_000, billed_supply_amount: 10_000_000, billed_total_amount: 11_000_000,
      tax_issued_total_amount: 11_000_000, received_amount: 11_000_000, outstanding_amount: 0,
      planned_labor_cost: 4_800_000, actual_work_minutes: 60, labor_cost: 30_000, expense_recorded_total: 110_000,
      expense_cost: 100_000, total_cost: 130_000, gross_profit: 9_870_000, profit_margin: 98.7,
      forecast_total_cost: 4_900_000, forecast_gross_profit: 5_100_000, expense_by_type: { 식비: 100_000 },
    });
    expect(summary.total_cost).toBe(summary.labor_cost + summary.expense_cost);
    expect(summary.outstanding_amount).toBe(0);
  });
});
