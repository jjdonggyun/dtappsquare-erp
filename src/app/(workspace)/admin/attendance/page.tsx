import { notFound } from "next/navigation";
import { CalendarCheck2, Clock3, LogIn, TriangleAlert } from "lucide-react";
import { z } from "zod";
import { requirePage } from "@/shared/auth/account";
import { attendanceRoster } from "@/modules/attendance/infrastructure/repository";
import { attendanceBadgeClass, attendanceStatusLabels } from "@/modules/attendance/domain/labels";
import { organizationCatalogs } from "@/modules/organization/infrastructure/repository";
import { dateInTimeZone, formatMinutes, formatTime } from "@/shared/domain/date-time";
import { environment } from "@/shared/infrastructure/env";
import { PageHeading } from "@/components/page-heading";
import { CommandForm } from "@/components/command-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AttendanceAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const account = await requirePage();
  const canManage = account.permissions.includes("ATTENDANCE_MANAGE");
  if (!canManage && !account.permissions.includes("ATTENDANCE_READ_TEAM")) notFound();
  const timezone = environment().COMPANY_TIMEZONE;
  const params = await searchParams;
  const today = dateInTimeZone(new Date(), timezone);
  const workDate = z.iso.date().safeParse(params.date).success ? params.date! : today;
  const [roster, catalogs] = await Promise.all([
    attendanceRoster(workDate),
    organizationCatalogs(),
  ]);
  const organizations = new Map(catalogs.organizations.map((org) => [org.id, org.name]));
  const checkedIn = roster.filter((row) => row.summary?.check_in_at).length;
  const late = roster.filter((row) => row.summary?.status_flags.includes("LATE")).length;
  const missing = roster.length - checkedIn;
  const cards = [
    { label: "조회 직원", value: roster.length, unit: "명", icon: CalendarCheck2 },
    { label: "출근", value: checkedIn, unit: "명", icon: LogIn },
    { label: "지각", value: late, unit: "명", icon: Clock3 },
    { label: "미출근", value: missing, unit: "명", icon: TriangleAlert },
  ];
  return (
    <>
      <PageHeading
        eyebrow="ATTENDANCE OPERATIONS"
        title="근태관리"
        description={
          canManage
            ? "전사 근태 현황을 확인하고 보정 사유와 함께 관리자 보정을 기록합니다."
            : "관리 조직 구성원의 당일 근태 현황을 확인합니다."
        }
      />
      <Card className="mb-5 py-4">
        <CardContent>
          <form action="/admin/attendance" className="flex items-end gap-3">
            <label className="space-y-2 text-[11px] font-medium text-muted-foreground">
              근무일
              <Input name="date" type="date" defaultValue={workDate} className="w-48 bg-white" />
            </label>
            <Button type="submit" className="h-10">
              조회
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="gap-0 py-5">
            <CardContent>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                {card.label}
                <card.icon size={17} />
              </div>
              <p className="mt-4 text-2xl font-bold">
                {card.value}
                <span className="ml-1 text-xs font-normal text-muted-foreground">{card.unit}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-5 py-4">
          <CardTitle>{workDate} 직원 현황</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">직원</TableHead>
                <TableHead>조직</TableHead>
                <TableHead>출근</TableHead>
                <TableHead>퇴근</TableHead>
                <TableHead>근무</TableHead>
                <TableHead>상태</TableHead>
                {canManage && <TableHead className="text-right">관리</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roster.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="pl-5">
                    <p className="font-semibold">{row.name}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {row.employee_number ?? "사번 미부여"}
                    </p>
                  </TableCell>
                  <TableCell>{organizations.get(row.organization_id ?? "") ?? "미배정"}</TableCell>
                  <TableCell>{formatTime(row.summary?.check_in_at ?? null, timezone)}</TableCell>
                  <TableCell>{formatTime(row.summary?.check_out_at ?? null, timezone)}</TableCell>
                  <TableCell>{formatMinutes(row.summary?.worked_minutes ?? 0)}</TableCell>
                  <TableCell>
                    <Badge className={attendanceBadgeClass(row.summary?.attendance_status)}>
                      {row.summary
                        ? attendanceStatusLabels[row.summary.attendance_status]
                        : "미출근"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <details className="inline-block text-left">
                        <summary className="text-xs text-primary">보정</summary>
                        <div className="absolute right-8 z-10 mt-2 w-[420px] rounded-lg border bg-card p-5 shadow-xl">
                          <CommandForm
                            endpoint="/api/workforce"
                            action="attendance.correct"
                            constants={{ user_id: row.id, work_date: workDate }}
                            fields={[
                              {
                                name: "check_in_time",
                                label: "출근시각",
                                type: "time",
                                value: row.summary
                                  ? formatTime(row.summary.check_in_at, timezone).replace(
                                      "24:",
                                      "00:",
                                    )
                                  : "",
                              },
                              {
                                name: "check_out_time",
                                label: "퇴근시각",
                                type: "time",
                                value: row.summary
                                  ? formatTime(row.summary.check_out_at, timezone).replace(
                                      "24:",
                                      "00:",
                                    )
                                  : "",
                              },
                              { name: "reason", label: "보정 사유", required: true },
                            ]}
                            submit="보정 이력 기록"
                          />
                        </div>
                      </details>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!roster.length && (
            <p className="py-14 text-center text-xs text-muted-foreground">
              조회 가능한 직원이 없습니다.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
