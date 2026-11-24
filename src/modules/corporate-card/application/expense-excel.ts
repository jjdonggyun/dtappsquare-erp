import ExcelJS from "exceljs";
import { expenseCategoryLabels } from "../domain/contracts";

export type ExpenseExcelEntry = {
  transactionDate: string;
  category: string;
  payer: string;
  amount: number;
  merchant: string;
  purpose: string;
  memo: string;
};

export type ExpenseExcelInput = {
  month: string;
  projectName: string;
  customerName: string;
  generatedDate: string;
  authorName: string;
  cards: string[];
  cardCompanies: string[];
  entries: ExpenseExcelEntry[];
};

const safe = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);
const accountByCategory: Record<string, string> = {
  MEAL: "복리후생비",
  TRANSPORT: "여비교통비",
  ACCOMMODATION: "여비교통비",
  MEETING: "회의비",
  ENTERTAINMENT: "업무추진비",
  SUPPLIES: "소모품비",
  ETC: "기타",
};
const summaryRows = [
  { account: "복리후생비", group: "식비", categories: ["MEAL"], guide: "야근·출장 식대는 참석자와 사용 목적을 기재" },
  { account: "여비교통비", group: "교통·숙박", categories: ["TRANSPORT", "ACCOMMODATION"], guide: "출장지, 이동 구간과 사용 목적을 기재" },
  { account: "회의비", group: "회의", categories: ["MEETING"], guide: "회의 목적과 참석자를 기재" },
  { account: "업무추진비", group: "접대", categories: ["ENTERTAINMENT"], guide: "고객사, 목적과 참석자를 기재" },
  { account: "소모품비", group: "공용 물품", categories: ["SUPPLIES"], guide: "구매 품목과 업무 용도를 기재" },
  { account: "기타", group: "기타 비용", categories: ["ETC"], guide: "비용 성격과 업무 관련성을 기재" },
];

const border: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF7F7F7F" } },
  left: { style: "thin", color: { argb: "FF7F7F7F" } },
  bottom: { style: "thin", color: { argb: "FF7F7F7F" } },
  right: { style: "thin", color: { argb: "FF7F7F7F" } },
};

export async function buildExpenseExcel(input: ExpenseExcelInput) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Digital Square ERP";
  workbook.created = new Date(`${input.generatedDate}T00:00:00+09:00`);
  const sheet = workbook.addWorksheet("법인카드 서식", {
    views: [{ state: "frozen", ySplit: 15 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.properties.defaultRowHeight = 20;
  sheet.columns = [
    { width: 7 },
    { width: 14 },
    { width: 17 },
    { width: 18 },
    { width: 13 },
    { width: 15 },
    { width: 28 },
    { width: 52 },
    { width: 28 },
  ];

  sheet.mergeCells("A2:I2");
  const title = sheet.getCell("A2");
  title.value = `법인카드 사용 (${input.month.replace("-", "년 ")}월)`;
  title.font = { name: "맑은 고딕", size: 20, bold: true, color: { argb: "FF111827" } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 34;

  const dates = input.entries.map((entry) => entry.transactionDate).sort();
  const period = dates.length ? `${dates[0]} ~ ${dates.at(-1)}` : `${input.month}-01 ~ ${input.month}-말일`;
  const cardLabel = input.cards.length ? input.cards.join(", ") : "등록된 카드 없음";
  const companyLabel = input.cardCompanies.length ? input.cardCompanies.join(", ") : "—";
  const infoRows = [
    ["사용 기간", period, "제출일", input.generatedDate, "작성자", input.authorName],
    ["카드", cardLabel, "카드사", companyLabel, "사용 목적", `${input.customerName ? `${input.customerName} · ` : ""}${input.projectName}`],
  ];
  for (let offset = 0; offset < infoRows.length; offset++) {
    const row = 4 + offset;
    sheet.mergeCells(row, 2, row, 3);
    sheet.mergeCells(row, 5, row, 6);
    sheet.mergeCells(row, 8, row, 9);
    const values = infoRows[offset];
    for (const [column, value] of [
      [1, values[0]],
      [2, values[1]],
      [4, values[2]],
      [5, values[3]],
      [7, values[4]],
      [8, values[5]],
    ] as const) {
      const cell = sheet.getCell(row, column);
      cell.value = safe(value);
      cell.font = { name: "맑은 고딕", size: 10, bold: column % 3 === 1 };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = border;
    }
    for (let column = 1; column <= 9; column++) sheet.getCell(row, column).border = border;
    sheet.getRow(row).height = row === 5 ? 34 : 24;
  }

  sheet.mergeCells("D6:I6");
  ["계정", "구분", "총 사용금액", "기재 안내"].forEach((label, index) => {
    const column = index < 3 ? index + 1 : 4;
    const cell = sheet.getCell(6, column);
    cell.value = label;
    cell.font = { name: "맑은 고딕", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  for (let column = 1; column <= 9; column++) {
    sheet.getCell(6, column).border = border;
    sheet.getCell(6, column).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  }

  summaryRows.forEach((summary, index) => {
    const row = 7 + index;
    sheet.mergeCells(row, 4, row, 9);
    const amount = input.entries
      .filter((entry) => summary.categories.includes(entry.category))
      .reduce((sum, entry) => sum + entry.amount, 0);
    const values = [summary.account, summary.group, amount, summary.guide];
    [1, 2, 3, 4].forEach((column, valueIndex) => {
      const cell = sheet.getCell(row, column);
      cell.value = typeof values[valueIndex] === "string" ? safe(values[valueIndex] as string) : values[valueIndex];
      cell.font = { name: "맑은 고딕", size: 9 };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = border;
    });
    sheet.getCell(row, 3).numFmt = "#,##0;[Red]-#,##0";
    sheet.getCell(row, 3).alignment = { horizontal: "right", vertical: "middle" };
    for (let column = 1; column <= 9; column++) sheet.getCell(row, column).border = border;
  });

  const headerRow = 15;
  ["번호", "날짜", "계정", "구분", "결제자", "금액", "업체명(카드사용)", "내용", "비고"].forEach(
    (label, index) => {
      const cell = sheet.getCell(headerRow, index + 1);
      cell.value = label;
      cell.font = { name: "맑은 고딕", size: 9, bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6C9" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = border;
    },
  );
  sheet.getRow(headerRow).height = 24;

  input.entries.forEach((entry, index) => {
    const row = headerRow + 1 + index;
    const date = new Date(`${entry.transactionDate}T00:00:00Z`);
    const values: (string | number | Date)[] = [
      index + 1,
      date,
      accountByCategory[entry.category] ?? "기타",
      expenseCategoryLabels[entry.category as keyof typeof expenseCategoryLabels] ?? entry.category,
      safe(entry.payer),
      entry.amount,
      safe(entry.merchant),
      safe(entry.purpose),
      safe(entry.memo),
    ];
    values.forEach((value, valueIndex) => {
      const cell = sheet.getCell(row, valueIndex + 1);
      cell.value = value;
      cell.font = { name: "맑은 고딕", size: 9 };
      cell.alignment = {
        horizontal: [0, 1, 2, 3, 4].includes(valueIndex) ? "center" : valueIndex === 5 ? "right" : "left",
        vertical: "top",
        wrapText: true,
      };
      cell.border = border;
    });
    sheet.getCell(row, 2).numFmt = "yyyy-mm-dd";
    sheet.getCell(row, 6).numFmt = "#,##0;[Red]-#,##0";
    sheet.getRow(row).height = 32;
  });

  const lastDataRow = headerRow + Math.max(1, input.entries.length);
  const totalRow = Math.max(30, lastDataRow + 2);
  for (let row = headerRow + 1 + input.entries.length; row < totalRow; row++) {
    for (let column = 1; column <= 9; column++) sheet.getCell(row, column).border = border;
  }
  sheet.mergeCells(totalRow, 1, totalRow, 5);
  sheet.getCell(totalRow, 1).value = "합계";
  sheet.getCell(totalRow, 1).font = { name: "맑은 고딕", size: 10, bold: true };
  sheet.getCell(totalRow, 1).alignment = { horizontal: "left", vertical: "middle" };
  const totalAmount = input.entries.reduce((sum, entry) => sum + entry.amount, 0);
  sheet.getCell(totalRow, 6).value = input.entries.length
    ? { formula: `SUM(F${headerRow + 1}:F${headerRow + input.entries.length})`, result: totalAmount }
    : 0;
  sheet.getCell(totalRow, 6).numFmt = "#,##0;[Red]-#,##0";
  sheet.getCell(totalRow, 6).font = { name: "맑은 고딕", size: 10, bold: true };
  for (let column = 1; column <= 9; column++) sheet.getCell(totalRow, column).border = border;

  sheet.autoFilter = { from: "A15", to: "I15" };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
