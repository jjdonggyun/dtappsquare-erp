import PDFDocument from "pdfkit";
import path from "node:path";
import type { quotationDetail } from "../infrastructure/repository";
import type { financeSettings } from "@/modules/finance/infrastructure/repository";

type QuotationDetail = NonNullable<Awaited<ReturnType<typeof quotationDetail>>>;
type CompanyProfile = Awaited<ReturnType<typeof financeSettings>>["profile"];

const fontRoot = path.join(process.cwd(), "node_modules/pretendard/dist/public/static/alternative");
const regularFont = path.join(fontRoot, "Pretendard-Regular.ttf");
const boldFont = path.join(fontRoot, "Pretendard-Bold.ttf");
const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

function valueCell(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, labelWidth: number, valueWidth: number) {
  doc.save().fillColor("#eef3f8").rect(x, y, labelWidth, 24).fill().restore();
  doc.strokeColor("#aeb9c6").lineWidth(0.6).rect(x, y, labelWidth, 24).stroke().rect(x + labelWidth, y, valueWidth, 24).stroke();
  doc.font("PretendardBold").fontSize(8).fillColor("#172033").text(label, x + 5, y + 7, { width: labelWidth - 10, align: "center", lineBreak: false });
  doc.font("Pretendard").text(value, x + labelWidth + 6, y + 7, { width: valueWidth - 12, ellipsis: true, lineBreak: false });
}

export async function createQuotationPdf(detail: QuotationDetail, company: CompanyProfile): Promise<Buffer> {
  const { quote, items } = detail;
  const revision = quote.current_revision;
  if (!revision) throw new Error("quotation revision unavailable");
  const doc = new PDFDocument({
    size: "A4",
    margin: 38,
    autoFirstPage: true,
    info: { Title: `${quote.quotation_number} 견적서`, Author: company?.company_name ?? "Digital Square", Subject: "견적서" },
  });
  doc.registerFont("Pretendard", regularFont);
  doc.registerFont("PretendardBold", boldFont);
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.font("PretendardBold").fontSize(24).fillColor("#102a43").text("견 적 서", 38, 38, { width: 519, align: "center" });
  doc.font("Pretendard").fontSize(8).fillColor("#526173").text(`견적번호 ${quote.quotation_number} · Revision V${revision.revision_no}`, 38, 76, { width: 519, align: "center" });
  if (quote.status !== "APPROVED") {
    doc.save().opacity(0.08).rotate(-25, { origin: [297, 420] }).font("PretendardBold").fontSize(76).fillColor("#b42318").text("승인 전", 115, 360, { width: 360, align: "center" }).restore();
  }

  let y = 100;
  valueCell(doc, "수신", quote.customer?.name ?? "고객사", 38, y, 50, 210);
  valueCell(doc, "견적일", revision.quotation_date, 298, y, 52, 207);
  y += 24;
  valueCell(doc, "건명", revision.project_name, 38, y, 50, 210);
  valueCell(doc, "유효기간", revision.valid_until, 298, y, 52, 207);
  y += 34;

  doc.font("PretendardBold").fontSize(9).fillColor("#172033").text("아래와 같이 견적합니다.", 38, y);
  y += 22;
  const widths = [30, 154, 64, 48, 72, 76, 75];
  const headers = ["No.", "항목 / 역할", "투입기간", "수량", "단가", "공급가액", "비고"];
  const drawHeader = () => {
    let x = 38;
    headers.forEach((header, index) => {
      doc.save().fillColor("#1f4e78").rect(x, y, widths[index], 25).fill().restore();
      doc.strokeColor("#aeb9c6").rect(x, y, widths[index], 25).stroke();
      doc.font("PretendardBold").fontSize(7.5).fillColor("#ffffff").text(header, x + 3, y + 8, { width: widths[index] - 6, align: "center", lineBreak: false });
      x += widths[index];
    });
    y += 25;
  };
  drawHeader();
  for (const [index, item] of items.entries()) {
    if (y > 710) {
      doc.addPage();
      y = 46;
      doc.font("PretendardBold").fontSize(10).fillColor("#172033").text(`${quote.quotation_number} · ${revision.project_name}`, 38, 28);
      drawHeader();
    }
    const period = item.period_start && item.period_end ? `${item.period_start.slice(5)}~${item.period_end.slice(5)}` : "-";
    const values = [String(index + 1), `${item.item_name}${item.role_name ? ` / ${item.role_name}` : ""}`, period, `${item.quantity}`, money.format(item.unit_price), money.format(item.amount), item.note || ""];
    let x = 38;
    values.forEach((value, column) => {
      doc.strokeColor("#c4ccd6").lineWidth(0.5).rect(x, y, widths[column], 30).stroke();
      doc.font("Pretendard").fontSize(7.2).fillColor("#172033").text(value, x + 4, y + 7, { width: widths[column] - 8, height: 18, ellipsis: true, align: [0, 2, 3, 4, 5].includes(column) ? "right" : "left" });
      x += widths[column];
    });
    y += 30;
  }
  if (!items.length) {
    doc.strokeColor("#c4ccd6").rect(38, y, 519, 34).stroke();
    doc.font("Pretendard").fontSize(8).fillColor("#526173").text("견적 항목이 없습니다.", 38, y + 12, { width: 519, align: "center" });
    y += 34;
  }

  if (y > 660) { doc.addPage(); y = 48; }
  y += 10;
  const summaryX = 337;
  [["공급가액", revision.supply_amount], ["부가세", revision.vat_amount], ["합계금액", revision.total_amount]].forEach(([label, amount], index) => {
    const rowY = y + index * 25;
    doc.save().fillColor(index === 2 ? "#dce8f5" : "#f5f7fa").rect(summaryX, rowY, 82, 25).fill().restore();
    doc.strokeColor("#aeb9c6").rect(summaryX, rowY, 82, 25).stroke().rect(summaryX + 82, rowY, 138, 25).stroke();
    doc.font("PretendardBold").fontSize(8).fillColor("#172033").text(String(label), summaryX + 5, rowY + 8, { width: 72, align: "center" });
    doc.font(index === 2 ? "PretendardBold" : "Pretendard").fontSize(index === 2 ? 10 : 8).text(`${money.format(Number(amount))}원`, summaryX + 88, rowY + 7, { width: 126, align: "right" });
  });
  doc.font("PretendardBold").fontSize(8).fillColor("#172033").text("비고", 38, y + 4);
  doc.font("Pretendard").fontSize(8).fillColor("#526173").text(revision.note || "부가가치세 포함 여부와 지급 조건은 계약 체결 시 최종 확정합니다.", 75, y + 4, { width: 240, height: 58, ellipsis: true });
  y += 92;
  doc.strokeColor("#d5dce5").moveTo(38, y).lineTo(557, y).stroke();
  doc.font("PretendardBold").fontSize(11).fillColor("#102a43").text(company?.company_name ?? "디지털스퀘어", 38, y + 14);
  doc.font("Pretendard").fontSize(7.5).fillColor("#526173").text(
    company
      ? `대표 ${company.representative_name} · 사업자등록번호 ${company.business_registration_number}\n${company.address}\n${company.business_type} / ${company.business_item} · ${company.phone}${company.email ? ` · ${company.email}` : ""}`
      : "공급자 정보는 재무 설정에서 등록해 주세요.",
    38, y + 32, { width: 519, lineGap: 3 },
  );
  doc.font("Pretendard").fontSize(7).fillColor("#68768a").text("본 견적서는 ERP의 승인 상태와 Revision을 기준으로 출력되었습니다. 계약 체결 전 최종 승인본인지 확인하십시오.", 38, 786, { width: 519, align: "center" });
  doc.end();
  return completed;
}
