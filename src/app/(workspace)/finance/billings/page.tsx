import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { billingStatusLabels } from "@/modules/finance/domain/finance";
import { billingList } from "@/modules/finance/infrastructure/repository";
import { requireAnyPage } from "@/shared/auth/account";

const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
export default async function BillingsPage() {
  await requireAnyPage(["BILLING_READ", "BILLING_READ_ALL", "BILLING_MANAGE"]);
  const rows = await billingList();
  const totals = rows.reduce((value, row) => ({ billed: value.billed + (row.status === "CANCELED" ? 0 : row.total_amount), outstanding: value.outstanding + (row.status === "CANCELED" ? 0 : row.outstandingAmount), overdue: value.overdue + (row.displayStatus === "OVERDUE" ? row.outstandingAmount : 0) }), { billed: 0, outstanding: 0, overdue: 0 });
  return <><PageHeading eyebrow="ACCOUNTS RECEIVABLE" title="청구 · 미수금" description="청구서 발행부터 부분입금, 완납, 연체 잔액까지 한 원장으로 관리합니다." />
    <div className="mb-6 grid gap-4 sm:grid-cols-3">{[["누적 청구",totals.billed],["미수 잔액",totals.outstanding],["연체 잔액",totals.overdue]].map(([label,value]) => <Card key={String(label)}><CardContent className="pt-6"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold">{money.format(Number(value))}원</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>청구 원장</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow>{["청구번호","청구일 / 기한","고객사","프로젝트","청구금액","입금액","미수금","상태"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell><Link href={`/finance/billings/${row.id}`} className="font-semibold text-primary hover:underline">{row.billing_number}</Link></TableCell><TableCell><p>{row.billing_date}</p><p className="text-xs text-muted-foreground">기한 {row.due_date}</p></TableCell><TableCell>{row.customer?.name ?? "—"}</TableCell><TableCell>{row.project?.project_name ?? "—"}</TableCell><TableCell>{money.format(row.total_amount)}원</TableCell><TableCell>{money.format(row.allocatedAmount)}원</TableCell><TableCell className="font-semibold">{money.format(row.outstandingAmount)}원</TableCell><TableCell><Badge variant={row.displayStatus === "OVERDUE" ? "destructive" : "outline"}>{billingStatusLabels[row.displayStatus] ?? row.displayStatus}</Badge></TableCell></TableRow>)}</TableBody></Table>{!rows.length && <p className="py-12 text-center text-sm text-muted-foreground">생성된 청구서가 없습니다. 청구 일정에서 청구서를 생성하세요.</p>}</CardContent></Card>
  </>;
}
