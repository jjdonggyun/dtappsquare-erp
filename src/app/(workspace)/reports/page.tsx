import { Download, FileSpreadsheet, HeartPulse, MailCheck } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAnyPage } from "@/shared/auth/account";
import { dateInTimeZone } from "@/shared/domain/date-time";
import { environment } from "@/shared/infrastructure/env";
import { operationalAlertStatus } from "@/modules/reporting/infrastructure/repository";

const reportPermissions = [
  "OPPORTUNITY_READ_ALL", "QUOTATION_READ_ALL", "QUOTATION_MANAGE",
  "BILLING_READ_ALL", "BILLING_MANAGE", "PAYMENT_READ_ALL", "PAYMENT_MANAGE",
  "PROJECT_FINANCE_READ_ALL",
];
const automationPermissions = ["BILLING_READ_ALL", "PAYMENT_READ_ALL", "PROJECT_FINANCE_READ_ALL", "RBAC_MANAGE"];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ asOf?: string }> }) {
  const account = await requireAnyPage(reportPermissions);
  const query = await searchParams;
  const asOf = query.asOf ?? dateInTimeZone(new Date(), environment().COMPANY_TIMEZONE);
  const canReadAutomation = automationPermissions.some((permission) => account.permissions.includes(permission));
  const runs = canReadAutomation ? await operationalAlertStatus() : [];
  return (
    <>
      <PageHeading
        eyebrow="OPERATIONS & REPORTING"
        title="통합 보고서 · 운영 자동화"
        description="영업에서 프로젝트 손익까지 같은 기준일로 내보내고, 청구 예정·미수 알림 실행 이력을 점검합니다. Excel에는 현재 계정이 조회할 수 있는 업무 영역만 포함됩니다."
      />
      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet size={18} /> 통합 운영 Excel</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-5 text-sm leading-6 text-muted-foreground">영업 파이프라인, 견적 현황, 청구 일정, 청구·미수, 입금·배분, 프로젝트 손익을 업무별 시트로 생성합니다. 회의·월마감 전 기준일을 맞춰 저장해 두세요.</p>
            <form className="flex flex-wrap items-end gap-3" method="get">
              <label className="text-xs font-medium">손익 기준일<input className="mt-1 block" type="date" name="asOf" defaultValue={asOf} /></label>
              <Button type="submit" variant="outline">기준일 적용</Button>
              <Button asChild><a href={`/api/reports/operations-excel?asOf=${asOf}`}><Download size={16} /> Excel 다운로드</a></Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MailCheck size={18} /> 자동 알림 범위</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md border p-3"><strong>청구 예정</strong><p className="mt-1 text-muted-foreground">7일 안에 도래하는 SCHEDULED/READY 일정을 청구 관리자에게 알립니다.</p></div>
            <div className="rounded-md border p-3"><strong>미수금</strong><p className="mt-1 text-muted-foreground">입금기한이 지났고 미수잔액이 남은 청구를 청구·수금 관리자에게 알립니다.</p></div>
            <p className="text-xs text-muted-foreground">동일 일정·청구·수신자 조합은 중복 발송되지 않습니다. 운영 스케줄러는 평일 오전 9시 실행을 권장합니다.</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse size={18} /> 자동화 실행 이력</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>{["실행일", "상태", "청구 예정", "미수금", "생성 알림", "시작", "완료 / 오류"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{runs.map((run) => <TableRow key={run.id}>
              <TableCell>{run.run_date}</TableCell>
              <TableCell><Badge variant={run.status === "FAILED" ? "destructive" : "outline"}>{run.status}</Badge></TableCell>
              <TableCell>{run.schedule_due_count}건</TableCell><TableCell>{run.overdue_billing_count}건</TableCell><TableCell>{run.notification_count}건</TableCell>
              <TableCell>{new Date(run.started_at).toLocaleString("ko-KR", { timeZone: environment().COMPANY_TIMEZONE })}</TableCell>
              <TableCell>{run.error_code ?? (run.completed_at ? new Date(run.completed_at).toLocaleString("ko-KR", { timeZone: environment().COMPANY_TIMEZONE }) : "실행 중")}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
          {!canReadAutomation ? <p className="py-8 text-center text-sm text-muted-foreground">자동화 이력은 전사 재무·시스템 권한이 있는 계정만 확인할 수 있습니다.</p> : null}
          {canReadAutomation && !runs.length ? <p className="py-8 text-center text-sm text-muted-foreground">아직 실행 이력이 없습니다. 운영 Runbook의 스케줄러 설정 후 확인하세요.</p> : null}
        </CardContent>
      </Card>
    </>
  );
}
