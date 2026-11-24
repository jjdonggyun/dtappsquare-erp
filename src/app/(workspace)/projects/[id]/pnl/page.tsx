import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAnyPage } from "@/shared/auth/account";
import { dateInTimeZone } from "@/shared/domain/date-time";
import { environment } from "@/shared/infrastructure/env";
import { projectDetail } from "@/modules/project/infrastructure/repository";
import { projectFinancialSummary } from "@/modules/expense-finance/infrastructure/repository";

const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
export default async function ProjectPnlDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ asOf?: string }> }) {
  await requireAnyPage(["PROJECT_FINANCE_READ", "PROJECT_FINANCE_READ_ALL"]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const asOf = query.asOf ?? dateInTimeZone(new Date(), environment().COMPANY_TIMEZONE);
  const [project, row] = await Promise.all([projectDetail(id), projectFinancialSummary(id, asOf)]);
  if (!project) notFound();
  const metrics = [
    ["계약 공급가액", row.contract_supply_amount], ["청구 합계", row.billed_total_amount], ["수금 합계", row.received_amount], ["미수금", row.outstanding_amount],
    ["실제 인건비", row.labor_cost], ["승인 비용", row.expense_cost], ["총원가", row.total_cost], ["매출총이익", row.gross_profit],
  ];
  return <><PageHeading eyebrow="PROJECT P&L" title={`${project.project.project_name} 손익`} description={`${asOf} 기준 · 실제 공수 ${(row.actual_work_minutes / 60).toFixed(1)}시간 · 이익률 ${row.profit_margin === null ? "—" : `${row.profit_margin.toFixed(2)}%`}`} />
    <form className="mb-5 flex items-end gap-2" method="get"><label className="text-xs font-medium">기준일<input className="mt-1 block" type="date" name="asOf" defaultValue={asOf} /></label><button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" type="submit">조회</button></form>
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label,value]) => <Card key={String(label)}><CardContent className="pt-6"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-2 text-xl font-bold ${label === "매출총이익" && Number(value) < 0 ? "text-destructive" : ""}`}>{money.format(Number(value))}원</p></CardContent></Card>)}</div>
    <div className="grid gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle>원가 상세</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>구분</TableHead><TableHead>실적</TableHead><TableHead>계획·예측</TableHead></TableRow></TableHeader><TableBody>
      <TableRow><TableCell>인건비</TableCell><TableCell>{money.format(row.labor_cost)}원</TableCell><TableCell>{money.format(row.planned_labor_cost)}원</TableCell></TableRow>
      <TableRow><TableCell>비용</TableCell><TableCell>{money.format(row.expense_cost)}원</TableCell><TableCell>{money.format(row.expense_cost)}원</TableCell></TableRow>
      <TableRow><TableCell className="font-semibold">합계</TableCell><TableCell className="font-semibold">{money.format(row.total_cost)}원</TableCell><TableCell className="font-semibold">{money.format(row.forecast_total_cost)}원</TableCell></TableRow>
      <TableRow><TableCell className="font-semibold">이익</TableCell><TableCell className="font-semibold">{money.format(row.gross_profit)}원</TableCell><TableCell className="font-semibold">{money.format(row.forecast_gross_profit)}원</TableCell></TableRow>
    </TableBody></Table></CardContent></Card><Card><CardHeader><CardTitle>비용 유형별</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>비용 유형</TableHead><TableHead>원가 반영액</TableHead></TableRow></TableHeader><TableBody>{Object.entries(row.expense_by_type).map(([label, value]) => <TableRow key={label}><TableCell>{label}</TableCell><TableCell>{money.format(value)}원</TableCell></TableRow>)}</TableBody></Table>{!Object.keys(row.expense_by_type).length ? <p className="py-8 text-center text-sm text-muted-foreground">승인된 비용이 없습니다.</p> : null}</CardContent></Card></div>
  </>;
}
