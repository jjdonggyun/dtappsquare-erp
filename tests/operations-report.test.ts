import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildOperationsReportExcel } from "@/modules/reporting/application/operations-excel";

describe("operations report Excel", () => {
  it("creates only the authorized report sheets with stable headers", async () => {
    const output = await buildOperationsReportExcel({
      asOf: "2026-09-27",
      generatedAt: "2026. 9. 27. 오전 9:00",
      generatedBy: "관리자",
      opportunities: [],
      billingSchedules: [],
      profitability: [],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(output as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "영업 파이프라인",
      "청구 일정",
      "프로젝트 손익",
    ]);
    expect(workbook.getWorksheet("청구 일정")?.getCell("A5").value).toBe("프로젝트");
    expect(workbook.getWorksheet("프로젝트 손익")?.getCell("A2").value).toContain("계약 매출");
  });
});
