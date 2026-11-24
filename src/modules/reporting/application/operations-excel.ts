import ExcelJS from "exceljs";
import type { z } from "zod";
import type { opportunitySchema } from "@/modules/sales/infrastructure/repository";
import type { quotationSchema } from "@/modules/quotation/infrastructure/repository";
import type { scheduleSchema, BillingRow } from "@/modules/finance/infrastructure/repository";
import type { projectFinancialSummarySchema } from "@/modules/expense-finance/domain/contracts";

type Opportunity = z.infer<typeof opportunitySchema>;
type Quotation = z.infer<typeof quotationSchema>;
type BillingSchedule = z.infer<typeof scheduleSchema>;
type ProjectFinancialSummary = z.infer<typeof projectFinancialSummarySchema>;
type Payment = {
  payment_number: string;
  received_date: string;
  customer: { name: string } | null;
  project: { project_code: string; project_name: string } | null;
  payer_name: string;
  amount: number;
  allocatedAmount: number;
  remainingAmount: number;
  status: string;
};

export type OperationsReportInput = {
  asOf: string;
  generatedAt: string;
  generatedBy: string;
  opportunities?: Opportunity[];
  quotations?: Quotation[];
  billingSchedules?: BillingSchedule[];
  billings?: BillingRow[];
  payments?: Payment[];
  profitability?: ProjectFinancialSummary[];
};

const border: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD5DCE5" } },
  left: { style: "thin", color: { argb: "FFD5DCE5" } },
  bottom: { style: "thin", color: { argb: "FFD5DCE5" } },
  right: { style: "thin", color: { argb: "FFD5DCE5" } },
};
const won = "#,##0;[Red]-#,##0";
const percent = "0.0%;[Red]-0.0%";
const safe = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  title: string,
  description: string,
  columns: { header: string; key: string; width: number; numFmt?: string }[],
  rows: Record<string, string | number | null>[],
  input: OperationsReportInput,
) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = columns.map((column) => ({ key: column.key, width: column.width }));
  sheet.mergeCells(1, 1, 1, columns.length);
  sheet.getCell(1, 1).value = title;
  sheet.getCell(1, 1).font = { name: "맑은 고딕", size: 18, bold: true, color: { argb: "FF102A43" } };
  sheet.getCell(1, 1).alignment = { horizontal: "left", vertical: "middle" };
  sheet.getRow(1).height = 34;
  sheet.mergeCells(2, 1, 2, columns.length);
  sheet.getCell(2, 1).value = safe(description);
  sheet.getCell(2, 1).font = { name: "맑은 고딕", size: 9, color: { argb: "FF526173" } };
  sheet.mergeCells(3, 1, 3, columns.length);
  sheet.getCell(3, 1).value = safe(`기준일 ${input.asOf} · 생성 ${input.generatedAt} · 작성자 ${input.generatedBy}`);
  sheet.getCell(3, 1).font = { name: "맑은 고딕", size: 9, color: { argb: "FF526173" } };

  const header = sheet.getRow(5);
  columns.forEach((column, index) => {
    const cell = header.getCell(index + 1);
    cell.value = column.header;
    cell.font = { name: "맑은 고딕", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = border;
  });
  header.height = 28;

  for (const row of rows) {
    const excelRow = sheet.addRow(
      columns.map((column) => {
        const value = row[column.key];
        return typeof value === "string" ? safe(value) : value;
      }),
    );
    excelRow.height = 24;
    excelRow.eachCell((cell, columnNumber) => {
      cell.font = { name: "맑은 고딕", size: 9 };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = border;
      const format = columns[columnNumber - 1]?.numFmt;
      if (format) cell.numFmt = format;
    });
  }
  if (!rows.length) {
    sheet.mergeCells(6, 1, 6, columns.length);
    sheet.getCell(6, 1).value = "현재 권한과 조회 조건에서 출력할 데이터가 없습니다.";
    sheet.getCell(6, 1).alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell(6, 1).border = border;
    sheet.getRow(6).height = 34;
  }
  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: columns.length } };
  sheet.properties.defaultRowHeight = 20;
}

export async function buildOperationsReportExcel(input: OperationsReportInput) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Digital Square ERP";
  workbook.company = "Digital Square";
  workbook.subject = "영업·견적·청구·수금·손익 통합 운영 보고";

  if (input.opportunities) addSheet(workbook, "영업 파이프라인", "영업 파이프라인", "고객 접점부터 수주·실주까지 영업기회의 예상 매출과 확률을 확인합니다.", [
    { header: "기회번호", key: "code", width: 18 }, { header: "고객사", key: "customer", width: 24 },
    { header: "영업기회", key: "title", width: 32 }, { header: "담당자", key: "owner", width: 15 },
    { header: "단계", key: "stage", width: 14 }, { header: "예상금액", key: "amount", width: 16, numFmt: won },
    { header: "확률", key: "probability", width: 10, numFmt: percent }, { header: "기대매출", key: "revenue", width: 16, numFmt: won },
    { header: "제안마감", key: "proposalDue", width: 13 }, { header: "예상시작", key: "start", width: 13 },
  ], input.opportunities.map((row) => ({ code: row.opportunity_code, customer: row.customer?.name ?? "", title: row.title, owner: row.sales_owner?.name ?? "", stage: row.stage, amount: row.expected_amount, probability: row.probability / 100, revenue: row.expected_revenue, proposalDue: row.proposal_due_date ?? "", start: row.expected_start_date ?? "" })), input);

  if (input.quotations) addSheet(workbook, "견적 현황", "견적 현황", "Revision 기준 최신 견적 금액과 승인·계약 전환 상태를 점검합니다.", [
    { header: "견적번호", key: "number", width: 19 }, { header: "고객사", key: "customer", width: 24 },
    { header: "프로젝트", key: "project", width: 30 }, { header: "Revision", key: "revision", width: 10 },
    { header: "상태", key: "status", width: 14 }, { header: "견적일", key: "date", width: 13 },
    { header: "유효기간", key: "valid", width: 13 }, { header: "공급가액", key: "supply", width: 16, numFmt: won },
    { header: "총액", key: "total", width: 16, numFmt: won }, { header: "예상이익", key: "profit", width: 16, numFmt: won },
  ], input.quotations.map((row) => ({ number: row.quotation_number, customer: row.customer?.name ?? "", project: row.current_revision?.project_name ?? row.opportunity?.expected_project_name ?? "", revision: row.current_revision ? `V${row.current_revision.revision_no}` : "", status: row.status, date: row.current_revision?.quotation_date ?? "", valid: row.current_revision?.valid_until ?? "", supply: row.current_revision?.supply_amount ?? 0, total: row.current_revision?.total_amount ?? 0, profit: row.current_revision?.expected_profit ?? 0 })), input);

  if (input.billingSchedules) addSheet(workbook, "청구 일정", "청구 일정", "계약 이후 언제·어떤 조건으로 청구할지를 사전에 계획한 일정입니다. 실제 청구서가 생성되면 BILLED로 전환됩니다.", [
    { header: "프로젝트", key: "project", width: 28 }, { header: "계약번호", key: "contract", width: 18 },
    { header: "차수", key: "sequence", width: 8 }, { header: "일정명", key: "title", width: 28 },
    { header: "청구조건", key: "condition", width: 32 }, { header: "예정일", key: "date", width: 13 },
    { header: "공급가액", key: "supply", width: 16, numFmt: won }, { header: "총액", key: "total", width: 16, numFmt: won },
    { header: "상태", key: "status", width: 14 },
  ], input.billingSchedules.map((row) => ({ project: row.project ? `${row.project.project_code} ${row.project.project_name}` : "", contract: row.contract?.contract_number ?? "", sequence: row.sequence_no, title: row.title, condition: row.billing_condition, date: row.scheduled_date, supply: row.supply_amount, total: row.total_amount, status: row.status })), input);

  if (input.billings) addSheet(workbook, "청구 미수", "청구·미수금", "발행한 청구의 총액, 입금 배분액과 남은 미수잔액을 확인합니다.", [
    { header: "청구번호", key: "number", width: 20 }, { header: "고객사", key: "customer", width: 24 },
    { header: "프로젝트", key: "project", width: 28 }, { header: "청구명", key: "title", width: 30 },
    { header: "청구일", key: "date", width: 13 }, { header: "입금기한", key: "due", width: 13 },
    { header: "총액", key: "total", width: 16, numFmt: won }, { header: "수금액", key: "paid", width: 16, numFmt: won },
    { header: "미수잔액", key: "outstanding", width: 16, numFmt: won }, { header: "상태", key: "status", width: 14 },
  ], input.billings.map((row) => ({ number: row.billing_number, customer: row.customer?.name ?? "", project: row.project ? `${row.project.project_code} ${row.project.project_name}` : "", title: row.title, date: row.billing_date, due: row.due_date, total: row.total_amount, paid: row.allocatedAmount, outstanding: row.outstandingAmount, status: row.displayStatus })), input);

  if (input.payments) addSheet(workbook, "수금", "입금·수금 배분", "통장 입금내역과 청구서에 배분된 금액, 아직 배분되지 않은 금액을 확인합니다.", [
    { header: "입금번호", key: "number", width: 20 }, { header: "입금일", key: "date", width: 13 },
    { header: "고객사", key: "customer", width: 24 }, { header: "프로젝트", key: "project", width: 28 },
    { header: "입금자", key: "payer", width: 20 }, { header: "입금액", key: "amount", width: 16, numFmt: won },
    { header: "배분액", key: "allocated", width: 16, numFmt: won }, { header: "미배분액", key: "remaining", width: 16, numFmt: won },
    { header: "상태", key: "status", width: 14 },
  ], input.payments.map((row) => ({ number: row.payment_number, date: row.received_date, customer: row.customer?.name ?? "", project: row.project ? `${row.project.project_code} ${row.project.project_name}` : "", payer: row.payer_name, amount: row.amount, allocated: row.allocatedAmount, remaining: row.remainingAmount, status: row.status })), input);

  if (input.profitability) addSheet(workbook, "프로젝트 손익", "프로젝트 손익", "계약 매출, 청구·수금, 실제 공수와 승인 비용을 같은 기준일로 집계한 관리 손익입니다.", [
    { header: "프로젝트", key: "project", width: 30 }, { header: "고객사", key: "customer", width: 24 },
    { header: "상태", key: "status", width: 12 }, { header: "계약 공급가액", key: "contract", width: 17, numFmt: won },
    { header: "청구액", key: "billed", width: 16, numFmt: won }, { header: "수금액", key: "received", width: 16, numFmt: won },
    { header: "미수금", key: "outstanding", width: 16, numFmt: won }, { header: "실제 원가", key: "cost", width: 16, numFmt: won },
    { header: "매출총이익", key: "profit", width: 16, numFmt: won }, { header: "이익률", key: "margin", width: 11, numFmt: percent },
    { header: "마감일", key: "closed", width: 18 },
  ], input.profitability.map((row) => ({ project: `${row.project_code} ${row.project_name}`, customer: row.customer_name, status: row.status, contract: row.contract_supply_amount, billed: row.billed_total_amount, received: row.received_amount, outstanding: row.outstanding_amount, cost: row.total_cost, profit: row.gross_profit, margin: row.profit_margin === null ? null : row.profit_margin / 100, closed: row.closed_at ?? "" })), input);

  const sheet = workbook.worksheets[0];
  if (!sheet) addSheet(workbook, "안내", "통합 운영 보고", "현재 계정에 보고서로 출력할 수 있는 권한이 없습니다.", [{ header: "안내", key: "message", width: 80 }], [], input);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
