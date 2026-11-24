import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAnyPage } from "@/shared/auth/account";
import { dateInTimeZone } from "@/shared/domain/date-time";
import { environment } from "@/shared/infrastructure/env";
import { projectFinancialPortfolio } from "@/modules/expense-finance/infrastructure/repository";

const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
export default async function ProjectPnlPage({ searchParams }: { searchParams: Promise<{ asOf?: string }> }) {
  await requireAnyPage(["PROJECT_FINANCE_READ", "PROJECT_FINANCE_READ_ALL"]);
  const query = await searchParams; const asOf = query.asOf ?? dateInTimeZone(new Date(), environment().COMPANY_TIMEZONE);
  const rows = await projectFinancialPortfolio(asOf);
  const totals = rows.reduce((value, row) => ({ contract: value.contract + row.contract_supply_amount, cost: value.cost + row.total_cost, profit: value.profit + row.gross_profit, outstanding: value.outstanding + row.outstanding_amount }), { contract: 0, cost: 0, profit: 0, outstanding: 0 });
  return <><PageHeading eyebrow="PROJECT PROFITABILITY" title="프로젝트 손익" description={`${asOf} 기준 계약 공급가액, 실제 공수 원가, 승인 비용, 미수금을 동일 기준으로 집계합니다.`} />
    <form className="mb-5 flex items-end gap-2" method="get"><label className="text-xs font-medium">기준일<input className="mt-1 block" type="date" name="asOf" defaultValue={asOf} /></label><button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" type="submit">조회</button></form>
    <div className="mb-6 grid gap-4 sm:grid-cols-4">{[["계약 공급가액",totals.contract],["실제 원가",totals.cost],["매출총이익",totals.profit],["미수금",totals.outstanding]].map(([label,value]) => <Card key={String(label)}><CardContent className="pt-6"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold">{money.format(Number(value))}원</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>프로젝트별 손익</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow>{["프로젝트","상태","계약 공급가액","청구","수금","미수","인건비","승인 비용","총원가","이익","이익률","마감"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.project_id}><TableCell><Link className="font-semibold text-primary hover:underline" href={`/projects/${row.project_id}/pnl?asOf=${asOf}`}>{row.project_code}</Link><p className="text-xs text-muted-foreground">{row.project_name}</p></TableCell><TableCell><Badge variant="outline">{row.status}</Badge></TableCell><TableCell>{money.format(row.contract_supply_amount)}원</TableCell><TableCell>{money.format(row.billed_total_amount)}원</TableCell><TableCell>{money.format(row.received_amount)}원</TableCell><TableCell>{money.format(row.outstanding_amount)}원</TableCell><TableCell>{money.format(row.labor_cost)}원</TableCell><TableCell>{money.format(row.expense_cost)}원</TableCell><TableCell>{money.format(row.total_cost)}원</TableCell><TableCell className={row.gross_profit < 0 ? "font-semibold text-destructive" : "font-semibold"}>{money.format(row.gross_profit)}원</TableCell><TableCell>{row.profit_margin === null ? "—" : `${row.profit_margin.toFixed(1)}%`}</TableCell><TableCell><Link className="text-primary underline" href={`/projects/${row.project_id}/closing?asOf=${asOf}`}>{row.closed_at ? "마감 이력" : "점검"}</Link></TableCell></TableRow>)}</TableBody></Table>{!rows.length ? <p className="py-12 text-center text-sm text-muted-foreground">조회 가능한 프로젝트가 없습니다.</p> : null}</CardContent></Card>
  </>;
}
