import { Clock3, LogIn, LogOut, TimerReset, CalendarDays } from "lucide-react";
import { requirePage } from "@/shared/auth/account";
import { myAttendance } from "@/modules/attendance/infrastructure/repository";
import { attendanceBadgeClass, attendanceStatusLabels } from "@/modules/attendance/domain/labels";
import { environment } from "@/shared/infrastructure/env";
import { dateInTimeZone, formatMinutes, formatTime, nextMonth } from "@/shared/domain/date-time";
import { PageHeading } from "@/components/page-heading";
import { AttendanceCheckControl } from "@/components/attendance-check-control";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function MyAttendancePage() {
  const account = await requirePage("ATTENDANCE_READ_SELF");
  const timezone = environment().COMPANY_TIMEZONE;
  const today = dateInTimeZone(new Date(), timezone);
  const monthStart = `${today.slice(0, 7)}-01`;
  const data = await myAttendance(account.id, today, monthStart, nextMonth(today));
  const summary = data.today;
  const lateCount = data.month.filter((row) => row.status_flags.includes("LATE")).length;
  const cards = [
    { label: "오늘 출근", value: formatTime(summary?.check_in_at ?? null, timezone), icon: LogIn },
    {
      label: "오늘 퇴근",
      value: formatTime(summary?.check_out_at ?? null, timezone),
      icon: LogOut,
    },
    { label: "인정 근무", value: formatMinutes(summary?.worked_minutes ?? 0), icon: Clock3 },
    { label: "이번 달 지각", value: `${lateCount}회`, icon: TimerReset },
  ];
  return (
    <>
      <PageHeading
        eyebrow="ATTENDANCE"
        title="내 근태"
        description="서버 시각으로 출퇴근을 기록하고, 해당 날짜에 적용된 근무정책으로 근태를 판정합니다."
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="gap-0 py-5">
            <CardContent>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                {card.label}
                <card.icon size={17} strokeWidth={1.6} />
              </div>
              <p className="mt-4 text-xl font-bold tracking-tight">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mb-5 grid items-start gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden bg-brand-navy text-white">
          <CardContent className="flex flex-wrap items-center justify-between gap-5 py-6">
            <div>
              <p className="text-[10px] tracking-[.14em] text-white/55">TODAY · {today}</p>
              <div className="mt-3 flex items-center gap-3">
                <h2 className="text-xl font-semibold">오늘 근태</h2>
                <Badge className={attendanceBadgeClass(summary?.attendance_status)}>
                  {summary ? attendanceStatusLabels[summary.attendance_status] : "미출근"}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-[#b5c3d5]">
                출퇴근 버튼은 한 근무일에 각각 한 번만 기록할 수 있습니다.
              </p>
            </div>
            <div className="min-w-36">
              {!data.assignment ? null : !summary?.check_in_at ? (
                <AttendanceCheckControl eventType="CHECK_IN" />
              ) : !summary.check_out_at ? (
                <AttendanceCheckControl eventType="CHECK_OUT" />
              ) : (
                <p className="rounded-md border border-white/15 px-4 py-3 text-center text-xs text-white/75">
                  오늘 기록 완료
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>적용 근무정책</CardTitle>
          </CardHeader>
          <CardContent>
            {data.assignment ? (
              <dl className="grid grid-cols-2 gap-5 text-xs">
                <div>
                  <dt className="text-muted-foreground">정책</dt>
                  <dd className="mt-2 font-semibold">
                    {data.assignment.policy.name} v{data.assignment.policy.version}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">근무시간</dt>
                  <dd className="mt-2 font-semibold">
                    {data.assignment.policy.check_in_time.slice(0, 5)}–
                    {data.assignment.policy.check_out_time.slice(0, 5)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">지각 유예</dt>
                  <dd className="mt-2">{data.assignment.policy.late_grace_minutes}분</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">시간대</dt>
                  <dd className="mt-2">{data.assignment.policy.timezone}</dd>
                </div>
              </dl>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>
                  현재 적용할 근무정책이 없습니다. 인사 관리자에게 배정을 요청해 주세요.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
          <CardTitle>이번 달 근태 기록</CardTitle>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CalendarDays size={14} />
            {today.slice(0, 7)}
          </span>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">근무일</TableHead>
                <TableHead>출근</TableHead>
                <TableHead>퇴근</TableHead>
                <TableHead>인정 근무</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.month.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="pl-5 font-medium">{row.work_date}</TableCell>
                  <TableCell>{formatTime(row.check_in_at, timezone)}</TableCell>
                  <TableCell>{formatTime(row.check_out_at, timezone)}</TableCell>
                  <TableCell>{formatMinutes(row.worked_minutes)}</TableCell>
                  <TableCell>
                    <Badge className={attendanceBadgeClass(row.attendance_status)}>
                      {attendanceStatusLabels[row.attendance_status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!data.month.length && (
            <p className="py-14 text-center text-xs text-muted-foreground">
              이번 달 근태 기록이 없습니다.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
