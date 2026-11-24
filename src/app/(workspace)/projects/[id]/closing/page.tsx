import { notFound } from "next/navigation";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CommandForm } from "@/components/command-form";
import { requireAnyPage } from "@/shared/auth/account";
import { dateInTimeZone } from "@/shared/domain/date-time";
import { environment } from "@/shared/infrastructure/env";
import { projectDetail } from "@/modules/project/infrastructure/repository";
import { projectClosing } from "@/modules/expense-finance/infrastructure/repository";

const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
export default async function ProjectClosingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ asOf?: string }> }) {
  const account = await requireAnyPage(["PROJECT_FINANCE_READ", "PROJECT_FINANCE_READ_ALL", "PROJECT_CLOSE", "PROJECT_REOPEN"]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const asOf = query.asOf ?? dateInTimeZone(new Date(), environment().COMPANY_TIMEZONE);
  const [project, data] = await Promise.all([projectDetail(id), projectClosing(id, asOf)]);
  if (!project) notFound(); const summary = data.check.financial_summary;
  const canClose = account.permissions.includes("PROJECT_CLOSE") && !project.project.closed_at && data.check.can_close;
  const canReopen = account.permissions.includes("PROJECT_REOPEN") && Boolean(project.project.closed_at);
  return <><PageHeading eyebrow="PROJECT CLOSING" title={`${project.project.project_name} 마감`} description="검수, 청구, 세금계산서, 미수금, 비용·공수, 필수 문서를 한 번에 점검하고 불변 스냅샷을 남깁니다." />
    <form className="mb-5 flex items-end gap-2" method="get"><label className="text-xs font-medium">마감 기준일<input className="mt-1 block" type="date" name="asOf" defaultValue={asOf} /></label><button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" type="submit">다시 점검</button></form>
    <div className="mb-6 grid gap-4 sm:grid-cols-4">{[["계약 공급가액",summary.contract_supply_amount],["총원가",summary.total_cost],["매출총이익",summary.gross_profit],["미수금",summary.outstanding_amount]].map(([label,value]) => <Card key={String(label)}><CardContent className="pt-6"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold">{money.format(Number(value))}원</p></CardContent></Card>)}</div>
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]"><Card><CardHeader><CardTitle>마감 체크리스트</CardTitle></CardHeader><CardContent className="space-y-3">{data.check.checks.map((check) => <div key={check.code} className={`flex gap-3 rounded-md border p-4 ${check.passed ? "bg-emerald-50/50" : "bg-red-50/50"}`}>{check.passed ? <CheckCircle2 className="mt-0.5 text-emerald-600" size={18} /> : <CircleAlert className="mt-0.5 text-destructive" size={18} />}<div><p className="font-semibold">{check.label}</p><p className="mt-1 text-xs text-muted-foreground">{check.detail}</p></div></div>)}</CardContent></Card>
      <div className="space-y-6"><Card><CardHeader><CardTitle>{project.project.closed_at ? "마감 재개방" : "프로젝트 마감"}</CardTitle></CardHeader><CardContent>{project.project.closed_at ? <><p className="mb-4 text-sm text-muted-foreground">{project.project.closed_at.slice(0, 10)}에 마감되었습니다. 재개방 사유는 감사 이력에 남습니다.</p>{canReopen ? <CommandForm endpoint="/api/expense-finance" action="project.reopen" constants={{ project_id: id, version: project.project.version }} fields={[{ name: "reason", label: "재개방 사유", type: "textarea", required: true, minLength: 5 }]} submit="마감 재개방" confirmMessage="프로젝트 마감을 재개방하시겠습니까?" /> : <p className="text-sm text-muted-foreground">재개방 권한이 없습니다.</p>}</> : <><Badge variant={data.check.can_close ? "outline" : "destructive"}>{data.check.can_close ? "마감 가능" : "보완 필요"}</Badge><p className="my-4 text-sm text-muted-foreground">마감 후 업무일지와 모든 재무 데이터 변경이 잠깁니다.</p>{canClose ? <CommandForm endpoint="/api/expense-finance" action="project.close" constants={{ project_id: id, version: project.project.version, as_of_date: asOf }} fields={[{ name: "note", label: "마감 메모", type: "textarea" }]} submit="프로젝트 마감 확정" confirmMessage="점검 결과와 손익을 스냅샷으로 확정하고 프로젝트를 마감하시겠습니까?" /> : <p className="text-sm text-muted-foreground">미통과 항목을 처리한 뒤 다시 점검해 주세요.</p>}</>}</CardContent></Card>
        <Card><CardHeader><CardTitle>마감 이력</CardTitle></CardHeader><CardContent className="space-y-3">{data.history.map((row) => <div className="rounded-md border p-3" key={row.id}><div className="flex items-center justify-between"><p className="font-semibold">#{row.closing_no} · {row.as_of_date}</p><Badge variant="outline">{row.status === "CLOSED" ? "마감" : "재개방"}</Badge></div><p className="mt-2 text-xs text-muted-foreground">이익 {money.format(row.financial_snapshot.gross_profit)}원 · 미수 {money.format(row.financial_snapshot.outstanding_amount)}원</p>{row.note ? <p className="mt-1 text-xs">{row.note}</p> : null}{row.reopen_reason ? <p className="mt-1 text-xs text-destructive">재개방: {row.reopen_reason}</p> : null}</div>)}{!data.history.length ? <p className="text-sm text-muted-foreground">마감 이력이 없습니다.</p> : null}</CardContent></Card></div>
    </div>
  </>;
}
