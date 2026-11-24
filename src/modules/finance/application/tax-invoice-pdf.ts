import PDFDocument from "pdfkit";
import path from "node:path";
import type { TaxInvoiceRow } from "../infrastructure/repository";

const pretendardRoot = path.join(process.cwd(), "node_modules/pretendard");
const regularFont = path.join(pretendardRoot, "dist/public/static/alternative/Pretendard-Regular.ttf");
const boldFont = path.join(pretendardRoot, "dist/public/static/alternative/Pretendard-Bold.ttf");
const won = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

function text(doc: PDFKit.PDFDocument, value: string, x: number, y: number, width: number, options: PDFKit.Mixins.TextOptions = {}) {
  doc.text(value, x, y, { width, lineBreak: false, ellipsis: true, ...options });
}
function cell(doc: PDFKit.PDFDocument, value: string, x: number, y: number, width: number, height: number, options: { bold?: boolean; align?: "left" | "center" | "right"; fill?: string; size?: number } = {}) {
  if (options.fill) doc.save().fillColor(options.fill).rect(x, y, width, height).fill().restore();
  doc.strokeColor("#9aa7b5").lineWidth(0.6).rect(x, y, width, height).stroke();
  doc.font(options.bold ? "PretendardBold" : "Pretendard").fontSize(options.size ?? 8).fillColor("#172033");
  const lineHeight = options.size ? options.size + 2 : 11;
  text(doc, value, x + 4, y + Math.max(4, (height - lineHeight) / 2), width - 8, { align: options.align ?? "left" });
}
function partyTable(doc: PDFKit.PDFDocument, invoice: TaxInvoiceRow, y: number) {
  const x = 38, total = 519, half = total / 2;
  const values = [
    ["등록번호", invoice.supplier_registration_number, "등록번호", invoice.buyer_registration_number],
    ["상호", invoice.supplier_name, "상호", invoice.buyer_name],
    ["대표자", invoice.supplier_representative_name, "대표자", invoice.buyer_representative_name],
    ["주소", invoice.supplier_address, "주소", invoice.buyer_address],
    ["업태", invoice.supplier_business_type, "업태", invoice.buyer_business_type],
    ["종목", invoice.supplier_business_item, "종목", invoice.buyer_business_item],
    ["이메일", invoice.supplier_email ?? "", "이메일", invoice.recipient_email],
  ];
  cell(doc, "공급자", x, y, half, 24, { bold: true, align: "center", fill: "#e7f0ff", size: 10 });
  cell(doc, "공급받는자", x + half, y, half, 24, { bold: true, align: "center", fill: "#fff0f0", size: 10 });
  values.forEach((row, index) => {
    const rowY = y + 24 + index * 23;
    cell(doc, row[0], x, rowY, 48, 23, { bold: true, align: "center", fill: "#f5f7fa" }); cell(doc, row[1], x + 48, rowY, half - 48, 23);
    cell(doc, row[2], x + half, rowY, 48, 23, { bold: true, align: "center", fill: "#f5f7fa" }); cell(doc, row[3], x + half + 48, rowY, half - 48, 23);
  });
  return y + 24 + values.length * 23;
}
function summaryTable(doc: PDFKit.PDFDocument, invoice: TaxInvoiceRow, y: number) {
  const x = 38, widths = [84, 84, 84, 84, 84, 99];
  ["작성일자", "공급가액", "세액", "합계금액", "영수/청구", "승인번호"].forEach((label, i) => cell(doc, label, x + widths.slice(0, i).reduce((a, b) => a + b, 0), y, widths[i], 22, { bold: true, align: "center", fill: "#f5f7fa" }));
  const values = [invoice.issue_date, won.format(invoice.supply_amount), won.format(invoice.vat_amount), won.format(invoice.total_amount), invoice.purpose === "RECEIPT" ? "영수" : "청구", invoice.nts_approval_number ?? "발행 전"];
  values.forEach((value, i) => cell(doc, value, x + widths.slice(0, i).reduce((a, b) => a + b, 0), y + 22, widths[i], 26, { bold: i === 3, align: "center", size: i === 5 ? 6 : 8 }));
  return y + 48;
}
function itemHeader(doc: PDFKit.PDFDocument, y: number) {
  const x = 38, widths = [62, 130, 66, 42, 66, 72, 64, 17];
  ["공급일자", "품목", "규격", "수량", "단가", "공급가액", "세액", ""].forEach((label, i) => cell(doc, label, x + widths.slice(0, i).reduce((a, b) => a + b, 0), y, widths[i], 23, { bold: true, align: "center", fill: "#eaf0f7" }));
  return { x, widths, y: y + 23 };
}

export async function createTaxInvoicePdf(invoice: TaxInvoiceRow): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 38, info: { Title: `${invoice.invoice_number} 세금계산서`, Author: invoice.supplier_name, Subject: invoice.status === "ISSUED" ? "전자세금계산서 발행내역" : "세금계산서 발행자료" }, autoFirstPage: true });
  doc.registerFont("Pretendard", regularFont); doc.registerFont("PretendardBold", boldFont);
  const chunks: Buffer[] = []; doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const title = invoice.status === "ISSUED" ? "전자세금계산서 발행내역" : "세금계산서 발행자료";
  doc.font("PretendardBold").fontSize(20).fillColor("#172033").text(title, 38, 36, { width: 519, align: "center" });
  doc.font("Pretendard").fontSize(8).fillColor("#526173"); text(doc, `관리번호 ${invoice.invoice_number}`, 38, 68, 260); text(doc, `출력일시 ${new Date().toLocaleString("ko-KR")}`, 298, 68, 259, { align: "right" });
  if (invoice.status !== "ISSUED") {
    doc.save().opacity(0.1).font("PretendardBold").fontSize(70).fillColor("#c23838").rotate(-25, { origin: [297, 420] }).text("발행 전", 115, 370, { width: 360, align: "center" }).restore();
    doc.font("PretendardBold").fontSize(8).fillColor("#b42318").text("※ 본 문서는 전자발급 전 발행자료입니다. 국세청 승인번호가 없으면 법적 전자세금계산서 발급 완료 문서가 아닙니다.", 38, 82, { width: 519, align: "center" });
  }
  let y = partyTable(doc, invoice, invoice.status === "ISSUED" ? 86 : 100) + 9;
  y = summaryTable(doc, invoice, y) + 9;
  let table = itemHeader(doc, y); const rowHeight = 24;
  invoice.items.forEach((item, index) => {
    if (table.y + rowHeight > 738) { doc.addPage(); doc.font("PretendardBold").fontSize(11).fillColor("#172033").text(`${title} · ${invoice.invoice_number}`, 38, 36); table = itemHeader(doc, 58); }
    const values = [item.date.slice(5), item.name, item.specification, String(item.quantity), won.format(item.unitPrice), won.format(item.supplyAmount), won.format(item.vatAmount), String(index + 1)];
    values.forEach((value, i) => cell(doc, value, table.x + table.widths.slice(0, i).reduce((a, b) => a + b, 0), table.y, table.widths[i], rowHeight, { align: i === 1 || i === 2 ? "left" : "right", size: 7.5 }));
    table.y += rowHeight;
  });
  if (table.y + 102 > 790) { doc.addPage(); table.y = 48; }
  const x = 38;
  cell(doc, "합계", x, table.y, 328, 27, { bold: true, align: "center", fill: "#f5f7fa" }); cell(doc, won.format(invoice.supply_amount), x + 328, table.y, 72, 27, { bold: true, align: "right" }); cell(doc, won.format(invoice.vat_amount), x + 400, table.y, 64, 27, { bold: true, align: "right" }); cell(doc, won.format(invoice.total_amount), x + 464, table.y, 55, 27, { bold: true, align: "right", size: 7 });
  const noteY = table.y + 37;
  doc.font("PretendardBold").fontSize(8).fillColor("#172033").text("비고", x, noteY); doc.font("Pretendard").fontSize(8).text(invoice.note || "-", x + 36, noteY, { width: 483, height: 28, ellipsis: true });
  if (invoice.billing?.bank_account) { doc.font("PretendardBold").text("입금계좌", x, noteY + 28); doc.font("Pretendard").text(`${invoice.billing.bank_account.bank_name} ${invoice.billing.bank_account.account_number} / 예금주 ${invoice.billing.bank_account.account_holder}`, x + 52, noteY + 28, { width: 467 }); }
  doc.font("Pretendard").fontSize(7).fillColor("#68768a").text("이 문서는 ERP 보관·확인용 출력물입니다. 전자발급 완료 여부는 국세청 승인번호 및 홈택스/등록 ASP 기록으로 확인하십시오.", 38, 786, { width: 519, align: "center" });
  doc.end();
  return completed;
}
