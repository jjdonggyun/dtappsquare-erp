import { CalendarDays, FilePenLine, PlaneTakeoff } from "lucide-react";
import { requirePage } from "@/shared/auth/account";
import { leaveOverview } from "@/modules/leave/infrastructure/repository";
import {
  leaveStatusLabels,
  leaveTypeLabels,
  leaveTypes,
} from "@/modules/leave/domain/contracts";
import { dateInTimeZone } from "@/shared/domain/date-time";
import { environment } from "@/shared/infrastructure/env";
import { PageHeading } from "@/components/page-heading";
import { CommandForm } from "@/components/command-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function statusClass(status: string) {
  if (status === "APPROVED") return "border-0 bg-[#ecf7f2] text-[#287454]";
  if (status === "REJECTED") return "border-0 bg-[#fff0f0] text-[#b33b3b]";
  if (status === "REQUESTED") return "border-0 bg-[#fff6dd] text-[#9d7012]";
  return "border-0 bg-muted text-muted-foreground";
}

export default async function MyLeavePage() {
  const account = await requirePage("LEAVE_REQUEST");
  const data = await leaveOverview(account.id);
  const today = dateInTimeZone(new Date(), environment().COMPANY_TIMEZONE);
  return (
    <>
      <PageHeading
        eyebrow="LEAVE"
        title="내 휴가"
        description="휴가 초안을 작성한 뒤 제출하면 조직 리더를 기준으로 결재 경로가 생성됩니다."
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="gap-0 py-5"><CardContent><p className="text-xs text-muted-foreground">잔여 연차</p><p className="mt-4 text-2xl font-bold">{(data.totals.get("ANNUAL") ?? 0).toFixed(1)}<span className="ml-1 text-xs font-normal text-muted-foreground">일</span></p></CardContent></Card>
        <Card className="gap-0 py-5"><CardContent><p className="text-xs text-muted-foreground">결재 중</p><p className="mt-4 text-2xl font-bold">{data.rows.filter((row) => row.status === "REQUESTED").length}<span className="ml-1 text-xs font-normal text-muted-foreground">건</span></p></CardContent></Card>
        <Card className="gap-0 py-5"><CardContent><p className="text-xs text-muted-foreground">승인 휴가</p><p className="mt-4 text-2xl font-bold">{data.rows.filter((row) => row.status === "APPROVED").reduce((sum, row) => sum + row.duration, 0).toFixed(1)}<span className="ml-1 text-xs font-normal text-muted-foreground">일</span></p></CardContent></Card>
      </div>
      <Card className="mb-5">
        <CardHeader><CardTitle className="flex items-center gap-2"><FilePenLine size={17}/>휴가 신청 초안</CardTitle></CardHeader>
        <CardContent>
          <CommandForm endpoint="/api/leave-approval" action="leave.create" fields={[
            { name: "leave_type", label: "휴가 유형", type: "select", required: true, options: leaveTypes.map((type) => ({ value: type, label: leaveTypeLabels[type] })) },
            { name: "start_date", label: "시작일", type: "date", value: today, required: true },
            { name: "end_date", label: "종료일", type: "date", value: today, required: true },
            { name: "reason", label: "신청 사유", required: true },
          ]} submit="초안 저장" />
        </CardContent>
      </Card>
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4"><CardTitle>신청 이력</CardTitle><span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><CalendarDays size={14}/>최근 {data.rows.length}건</span></CardHeader>
        <CardContent className="px-0"><Table><TableHeader><TableRow><TableHead className="pl-5">유형</TableHead><TableHead>기간</TableHead><TableHead>일수</TableHead><TableHead>사유</TableHead><TableHead>상태</TableHead><TableHead className="text-right">작업</TableHead></TableRow></TableHeader><TableBody>{data.rows.map((row) => <TableRow key={row.id}><TableCell className="pl-5 font-semibold">{leaveTypeLabels[row.leave_type as keyof typeof leaveTypeLabels]}</TableCell><TableCell>{row.start_date} – {row.end_date}</TableCell><TableCell>{row.duration}일</TableCell><TableCell className="max-w-72 truncate text-muted-foreground">{row.reason}</TableCell><TableCell><Badge className={statusClass(row.status)}>{leaveStatusLabels[row.status]}</Badge></TableCell><TableCell className="text-right">{row.status === "DRAFT" && <div className="inline-flex gap-2"><CommandForm endpoint="/api/leave-approval" action="leave.submit" constants={{ id: row.id, version: row.version }} fields={[]} submit="제출"/><CommandForm endpoint="/api/leave-approval" action="leave.cancel" constants={{ id: row.id, version: row.version }} fields={[]} submit="삭제"/></div>}{row.status === "REQUESTED" && <CommandForm endpoint="/api/leave-approval" action="leave.cancel" constants={{ id: row.id, version: row.version }} fields={[]} submit="취소"/>}</TableCell></TableRow>)}</TableBody></Table>{!data.rows.length && <div className="py-16 text-center"><PlaneTakeoff size={24} className="mx-auto mb-3 text-muted-foreground"/><p className="text-xs text-muted-foreground">휴가 신청 이력이 없습니다.</p></div>}</CardContent>
      </Card>
    </>
  );
}
