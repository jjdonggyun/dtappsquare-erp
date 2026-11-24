import ExcelJS from "exceljs";
import { shiftDays } from "../domain/week";
import type { z } from "zod";
import type { rosterSchema, weeklyReportSchema } from "../infrastructure/repository";

type Person = z.infer<typeof rosterSchema>;
type Report = z.infer<typeof weeklyReportSchema>;

export type WeeklyReportExcelInput = {
  week: string;
  organizationName: string;
  roster: Person[];
  reports: Report[];
};

const safe = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);
const border: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF7F7F7F" } },
  left: { style: "thin", color: { argb: "FF7F7F7F" } },
  bottom: { style: "thin", color: { argb: "FF7F7F7F" } },
  right: { style: "thin", color: { argb: "FF7F7F7F" } },
};

function sectionTitle(sheet: ExcelJS.Worksheet, row: number, title: string) {
  sheet.mergeCells(row, 1, row, 7);
  const cell = sheet.getCell(row, 1);
  cell.value = `◆ ${title}`;
  cell.font = { name: "맑은 고딕", size: 10, bold: true };
  cell.alignment = { vertical: "middle" };
  sheet.getRow(row).height = 24;
}

function header(sheet: ExcelJS.Worksheet, row: number, labels: string[], fill = "FFC6E0F0") {
  labels.forEach((label, index) => {
    const cell = sheet.getCell(row, index + 1);
    cell.value = label;
    cell.font = { name: "맑은 고딕", size: 9, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = border;
  });
  sheet.getRow(row).height = 24;
}

export async function buildWeeklyReportExcel(input: WeeklyReportExcelInput) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Digital Square ERP";
  const sheet = workbook.addWorksheet("주간 업무보고", {
    views: [{ state: "frozen", ySplit: 4, xSplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.properties.defaultRowHeight = 20;
  sheet.columns = [
    { width: 15 },
    { width: 30 },
    { width: 30 },
    { width: 30 },
    { width: 30 },
    { width: 30 },
    { width: 30 },
  ];

  sheet.mergeCells("A2:G2");
  sheet.getCell("A2").value = `주간 업무보고 (${safe(input.organizationName)})`;
  sheet.getCell("A2").font = { name: "맑은 고딕", size: 18, bold: true };
  sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 34;
  sheet.mergeCells("A3:G3");
  sheet.getCell("A3").value = `${input.week} ~ ${shiftDays(input.week, 4)}`;
  sheet.getCell("A3").font = { name: "맑은 고딕", size: 10, bold: true };
  sheet.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };

  const reportByUser = new Map(input.reports.map((report) => [report.user_id, report]));
  const personById = new Map(input.roster.map((person) => [person.user_id, person]));
  const projects = new Map<string, Set<string>>();
  for (const report of input.reports) {
    const name = personById.get(report.user_id)?.name ?? "직원";
    for (const entry of report.entries_snapshot) {
      if (!entry.project_name) continue;
      const people = projects.get(entry.project_name) ?? new Set<string>();
      people.add(name);
      projects.set(entry.project_name, people);
    }
  }

  let row = 5;
  sectionTitle(sheet, row++, "프로젝트 관리");
  header(sheet, row++, ["프로젝트", "기간", "투입인력", "비고"]);
  sheet.mergeCells(row - 1, 2, row - 1, 3);
  sheet.mergeCells(row - 1, 4, row - 1, 6);
  for (const [project, people] of projects) {
    sheet.mergeCells(row, 2, row, 3);
    sheet.mergeCells(row, 4, row, 6);
    const values = [safe(project), `${input.week} ~ ${shiftDays(input.week, 4)}`, safe([...people].join(", ")), "업무일지 기준"];
    [1, 2, 4, 7].forEach((column, index) => {
      const cell = sheet.getCell(row, column);
      cell.value = values[index];
      cell.font = { name: "맑은 고딕", size: 9 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    for (let column = 1; column <= 7; column++) sheet.getCell(row, column).border = border;
    row++;
  }
  if (!projects.size) {
    sheet.mergeCells(row, 1, row, 7);
    sheet.getCell(row, 1).value = "등록된 프로젝트 업무가 없습니다.";
    sheet.getCell(row, 1).alignment = { horizontal: "center", vertical: "middle" };
    for (let column = 1; column <= 7; column++) sheet.getCell(row, column).border = border;
    row++;
  }

  row++;
  sectionTitle(sheet, row++, "이슈현황");
  header(sheet, row++, ["작성자", "내용", "상태"] , "FFFCE4D6");
  sheet.mergeCells(row - 1, 2, row - 1, 6);
  const issueReports = input.reports.filter((report) => report.issues.trim());
  for (const report of issueReports) {
    sheet.mergeCells(row, 2, row, 6);
    sheet.getCell(row, 1).value = safe(personById.get(report.user_id)?.name ?? "직원");
    sheet.getCell(row, 2).value = safe(report.issues);
    sheet.getCell(row, 7).value = report.status === "CONFIRMED" ? "확정" : "작성 중";
    for (let column = 1; column <= 7; column++) {
      const cell = sheet.getCell(row, column);
      cell.font = { name: "맑은 고딕", size: 9 };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = border;
    }
    sheet.getRow(row).height = 34;
    row++;
  }
  if (!issueReports.length) {
    sheet.mergeCells(row, 1, row, 7);
    sheet.getCell(row, 1).value = "등록된 이슈가 없습니다.";
    sheet.getCell(row, 1).alignment = { horizontal: "center", vertical: "middle" };
    for (let column = 1; column <= 7; column++) sheet.getCell(row, column).border = border;
    row++;
  }

  row++;
  sectionTitle(sheet, row++, `금주 업무평가 - ${input.week} ~ ${shiftDays(input.week, 4)}`);
  header(sheet, row++, ["이름", "월", "화", "수", "목", "금", "비고"]);
  for (const person of input.roster) {
    const report = reportByUser.get(person.user_id);
    sheet.getCell(row, 1).value = safe(person.name);
    for (let day = 0; day < 5; day++) {
      const date = shiftDays(input.week, day);
      const entries = report?.entries_snapshot.filter((entry) => entry.date === date) ?? [];
      const text = entries.map((entry) => `- ${entry.title}`).join("\n");
      sheet.getCell(row, day + 2).value = safe(text || (!report && person.approved_leave_days >= 5 ? "휴가" : ""));
    }
    sheet.getCell(row, 7).value = safe(report?.summary ?? (person.approved_leave_days >= 5 ? "승인 휴가" : "미작성"));
    for (let column = 1; column <= 7; column++) {
      const cell = sheet.getCell(row, column);
      cell.font = { name: "맑은 고딕", size: 9 };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = border;
    }
    sheet.getCell(row, 1).alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(row).height = 48;
    row++;
  }

  row++;
  sectionTitle(sheet, row++, `차주 업무계획 - ${shiftDays(input.week, 7)} ~ ${shiftDays(input.week, 11)}`);
  header(sheet, row++, ["이름", "주간 계획", "", "", "", "", "상태"]);
  sheet.mergeCells(row - 1, 2, row - 1, 6);
  for (const person of input.roster) {
    const report = reportByUser.get(person.user_id);
    sheet.mergeCells(row, 2, row, 6);
    sheet.getCell(row, 1).value = safe(person.name);
    sheet.getCell(row, 2).value = safe(report?.next_week_plan ?? "");
    sheet.getCell(row, 7).value = report?.status === "CONFIRMED" ? "확정" : report ? "작성 중" : "미작성";
    for (let column = 1; column <= 7; column++) {
      const cell = sheet.getCell(row, column);
      cell.font = { name: "맑은 고딕", size: 9 };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = border;
    }
    sheet.getCell(row, 1).alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(row).height = 42;
    row++;
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
