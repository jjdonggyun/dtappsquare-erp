import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { taxInvoiceStatusLabels } from "@/modules/finance/domain/finance";
import { taxInvoiceList } from "@/modules/finance/infrastructure/repository";
import { requireAnyPage } from "@/shared/auth/account";

const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
export default async function TaxInvoicesPage() {
  await requireAnyPage(["TAX_INVOICE_READ","TAX_INVOICE_READ_ALL","TAX_INVOICE_MANAGE"]);
  const rows = await taxInvoiceList();
  return <><PageHeading eyebrow="E-TAX INVOICE" title="세금계산서" description="발행자료 확정, 홈택스·ASP 발급, 국세청 승인번호 기록과 PDF 출력을 관리합니다." />
    <Card><CardHeader><CardTitle>세금계산서 원장</CardTitle></CardHeader><CardContent><div className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><b>발행자료 확정은 전자발급 완료가 아닙니다.</b> 홈택스 또는 등록 ASP에서 발급한 뒤 24자리 국세청 승인번호를 기록해야 전자발급 완료로 표시됩니다.</div><Table><TableHeader><TableRow>{["관리번호","작성일자","공급받는자","프로젝트","합계금액","승인번호","상태"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell><Link href={`/finance/tax-invoices/${row.id}`} className="font-semibold text-primary hover:underline">{row.invoice_number}</Link></TableCell><TableCell>{row.issue_date}</TableCell><TableCell>{row.buyer_name}</TableCell><TableCell>{row.billing?.project?.project_name ?? "—"}</TableCell><TableCell>{money.format(row.total_amount)}원</TableCell><TableCell className="font-mono text-xs">{row.nts_approval_number ?? "—"}</TableCell><TableCell><Badge variant={row.status === "ISSUED" ? "default" : "outline"}>{taxInvoiceStatusLabels[row.status] ?? row.status}</Badge></TableCell></TableRow>)}</TableBody></Table>{!rows.length && <p className="py-12 text-center text-sm text-muted-foreground">생성된 세금계산서 발행자료가 없습니다.</p>}</CardContent></Card>
  </>;
}
