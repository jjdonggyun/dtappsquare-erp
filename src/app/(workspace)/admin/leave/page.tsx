import { requirePage } from "@/shared/auth/account";
import { leaveOverview } from "@/modules/leave/infrastructure/repository";
import { leaveStatusLabels, leaveTypeLabels } from "@/modules/leave/domain/contracts";
import { organizationCatalogs } from "@/modules/organization/infrastructure/repository";
import { PageHeading } from "@/components/page-heading";
import { CommandForm } from "@/components/command-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function LeaveAdminPage() {
  await requirePage("LEAVE_MANAGE");
  const [data, catalogs] = await Promise.all([leaveOverview(), organizationCatalogs()]);
  const people = new Map(catalogs.directory.map((person) => [person.id, person.name]));
  return <>
    <PageHeading eyebrow="LEAVE OPERATIONS" title="휴가관리" description="직원별 휴가 신청과 잔액 원장을 조회하고, 확정된 부여·조정 내역을 기록합니다."/>
    <Card className="mb-5"><CardHeader><CardTitle>잔액 원장 반영</CardTitle></CardHeader><CardContent><CommandForm endpoint="/api/leave-approval" action="leave.balance.adjust" fields={[
      { name: "user_id", label: "직원", type: "select", required: true, options: catalogs.directory.map((person) => ({ value: person.id, label: person.name })) },
      { name: "leave_type", label: "휴가 유형", type: "select", required: true, options: [{ value: "ANNUAL", label: "연차" },{ value: "SICK", label: "병가" },{ value: "SPECIAL", label: "특별휴가" },{ value: "OTHER", label: "기타" }] },
      { name: "entry_type", label: "원장 유형", type: "select", required: true, options: [{ value: "GRANT", label: "부여" },{ value: "ADJUST", label: "조정" }] },
      { name: "amount", label: "일수(차감은 음수)", type: "number", required: true, step: 0.5, min: -365, max: 365 },
      { name: "memo", label: "근거 / 메모" },
    ]} submit="원장 반영"/></CardContent></Card>
    <Card className="gap-0 py-0"><CardHeader className="border-b px-5 py-4"><CardTitle>전체 휴가 신청</CardTitle></CardHeader><CardContent className="px-0"><Table><TableHeader><TableRow><TableHead className="pl-5">직원</TableHead><TableHead>유형</TableHead><TableHead>기간</TableHead><TableHead>일수</TableHead><TableHead>상태</TableHead><TableHead>신청일</TableHead></TableRow></TableHeader><TableBody>{data.rows.map((row) => <TableRow key={row.id}><TableCell className="pl-5 font-semibold">{people.get(row.user_id) ?? "조회 제한"}</TableCell><TableCell>{leaveTypeLabels[row.leave_type as keyof typeof leaveTypeLabels]}</TableCell><TableCell>{row.start_date} – {row.end_date}</TableCell><TableCell>{row.duration}</TableCell><TableCell><Badge variant="outline">{leaveStatusLabels[row.status]}</Badge></TableCell><TableCell>{row.created_at.slice(0,10)}</TableCell></TableRow>)}</TableBody></Table>{!data.rows.length && <p className="py-16 text-center text-xs text-muted-foreground">휴가 신청이 없습니다.</p>}</CardContent></Card>
  </>;
}
