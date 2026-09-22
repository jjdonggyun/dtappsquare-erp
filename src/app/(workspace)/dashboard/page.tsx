import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  LogIn,
  Network,
  PackageOpen,
  PlaneTakeoff,
  ShieldCheck,
  UserCheck,
  Users,
  NotebookPen,
  Presentation,
  CreditCard,
} from "lucide-react";
import { requirePage } from "@/shared/auth/account";
import { dashboardMetrics } from "@/modules/users/application/dashboard";
import { employeeList } from "@/modules/users/infrastructure/repository";
import { organizationCatalogs } from "@/modules/organization/infrastructure/repository";
import {
  attendanceMonthly,
  attendanceRoster,
  myAttendance,
} from "@/modules/attendance/infrastructure/repository";
import { attendanceStatusLabels } from "@/modules/attendance/domain/labels";
import { leaveOverview } from "@/modules/leave/infrastructure/repository";
import { approvalInbox } from "@/modules/approval/infrastructure/repository";
import { assetCatalog } from "@/modules/asset/infrastructure/repository";
import { projectCatalog } from "@/modules/project/infrastructure/repository";
import { buildResourcePlan } from "@/modules/project-resource/domain/planning";
import {workDailyStatus,weeklyRoster} from "@/modules/work-management/infrastructure/repository";
import {mondayOf} from "@/modules/work-management/domain/week";
import {cardMonthAmount,settlement} from "@/modules/corporate-card/infrastructure/repository";
import { environment } from "@/shared/infrastructure/env";
import { dateInTimeZone, formatMinutes, formatTime, nextMonth } from "@/shared/domain/date-time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Metric = {
  label: string;
  value: string | number;
  unit: string;
  icon: LucideIcon;
  note: string;
  href: string;
};
function moneyForDashboard(value:number){return `${Math.round(value).toLocaleString("ko-KR")}원`}

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;
  return (
    <Link href={metric.href} className="group">
      <Card className="h-full gap-0 rounded-lg py-5 transition-colors hover:border-primary/35">
        <CardContent className="px-5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-muted-foreground">{metric.label}</span>
            <Icon size={17} strokeWidth={1.6} className="text-[#8b99ab]" />
          </div>
          <p className="mt-4 flex min-h-9 items-baseline gap-1.5 truncate text-[26px] font-bold tracking-tight">
            {metric.value}
            <span className="text-[12px] font-normal text-muted-foreground">{metric.unit}</span>
          </p>
          <div className="mt-4 flex items-center justify-between border-t pt-3">
            <p className="truncate text-[10px] text-muted-foreground">{metric.note}</p>
            <ChevronRight
              size={12}
              className="shrink-0 text-muted-foreground group-hover:text-primary"
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const account = await requirePage();
  const admin = account.permissions.includes("USER_READ");
  const team = account.permissions.includes("USER_READ_TEAM");
  const showRequests = admin && (await searchParams).view === "requests";
  const timezone = environment().COMPANY_TIMEZONE;
  const now = new Date();
  const today = dateInTimeZone(now, timezone);
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = nextMonth(today);
  const weekStart=mondayOf(today);
  const previousMonth=new Date(`${monthStart}T00:00:00Z`);previousMonth.setUTCMonth(previousMonth.getUTCMonth()-1);
  const [metrics, catalogs, list, attendance, roster, leave, approvals, assets, projects, monthRows] =
    await Promise.all([
      dashboardMetrics(account),
      organizationCatalogs(),
      employeeList({ status: showRequests ? "REQUESTED" : "ACTIVE" }),
      myAttendance(account.id, today, monthStart, monthEnd),
      admin || team ? attendanceRoster(today) : Promise.resolve([]),
      leaveOverview(!admin && !team ? account.id : undefined),
      approvalInbox(),
      assetCatalog(),
      projectCatalog(),
      admin || team ? attendanceMonthly(monthStart, monthEnd) : Promise.resolve([]),
    ]);

  const checkedIn = roster.filter((row) => row.summary?.check_in_at).length;
  const late = roster.filter((row) => row.summary?.status_flags.includes("LATE")).length;
  const onLeave = roster.filter((row) =>
    ["VACATION", "HALF_DAY"].includes(row.summary?.attendance_status ?? ""),
  ).length;
  const currentAssignments = projects.assignments.filter(
    (row) =>
      row.status === "IN_PROGRESS" &&
      row.planned_start_date <= today &&
      row.planned_end_date >= today,
  );
  const currentProjects = currentAssignments.filter((row) => row.user_id === account.id);
  const currentAssets = assets.assignments.filter(
    (row) => row.user_id === account.id && !row.returned_at,
  );
  const waitingApprovals = approvals.filter(
    (request) =>
      request.status === "PENDING" &&
      request.steps.some(
        (step) =>
          step.step_order === request.current_step_order &&
          step.approver_id === account.id &&
          step.status === "PENDING",
      ),
  );
  const resourcePlan = admin
    ? buildResourcePlan(catalogs.directory, projects.projects, projects.assignments, today)
    : [];
  const [workStatus,weeklyStatus,cardAmount,cardReport]=await Promise.all([
    account.permissions.includes("WORK_LOG_READ_SELF")?workDailyStatus(today):Promise.resolve([]),
    account.permissions.includes("WEEKLY_REPORT_READ_SELF")?weeklyRoster(weekStart):Promise.resolve([]),
    account.permissions.includes("EXPENSE_READ_ALL")?cardMonthAmount(monthStart):Promise.resolve(null),
    account.permissions.includes("CARD_SETTLEMENT_READ")?settlement(previousMonth.toISOString().slice(0,10)):Promise.resolve(null),
  ]);
  const myWork=workStatus.find(row=>row.user_id===account.id);
  const myWeekly=weeklyStatus.find(row=>row.user_id===account.id);
  const unlogged=workStatus.filter(row=>row.entry_count===0).length;
  const weeklyMissing=weeklyStatus.filter(row=>!row.status&&row.approved_leave_days<5).length;
  const weeklyConfirmed=weeklyStatus.filter(row=>row.status==="CONFIRMED").length;

  let cards: Metric[];
  if (admin) {
    cards = [
      { label: "전체 직원", value: metrics.active, unit: "명", icon: Users, note: "현재 재직 중", href: "/admin/users?status=ACTIVE" },
      { label: "오늘 출근", value: checkedIn, unit: "명", icon: LogIn, note: `${today} 기록`, href: "/admin/attendance" },
      { label: "오늘 지각", value: late, unit: "명", icon: Clock3, note: "개인별 정책 반영", href: "/admin/attendance" },
      { label: "오늘 휴가", value: onLeave, unit: "명", icon: PlaneTakeoff, note: "전일·반일 휴가", href: "/admin/leave" },
      { label: "대기 인력", value: resourcePlan.filter((row) => row.state === "WAITING").length, unit: "명", icon: UserCheck, note: "현재 미투입", href: "/admin/resources?state=WAITING" },
      { label: "투입 인력", value: new Set(currentAssignments.map((row) => row.user_id)).size, unit: "명", icon: BriefcaseBusiness, note: "현재 투입 중", href: "/admin/resources?state=IN_PROGRESS" },
      { label: "진행 프로젝트", value: projects.projects.filter((row) => row.status === "IN_PROGRESS").length, unit: "개", icon: BriefcaseBusiness, note: "진행 상태 기준", href: "/admin/projects" },
      { label: "사용 중 자산", value: assets.assignments.filter((row) => !row.returned_at).length, unit: "대", icon: PackageOpen, note: "미반납 기준", href: "/admin/assets" },
      { label: "주간보고 확정", value: weeklyConfirmed, unit: "명", icon: Presentation, note: `미작성 ${weeklyMissing}명`, href: "/weekly-reports" },
      { label: "오늘 업무 미작성", value: unlogged, unit: "명", icon: NotebookPen, note: "승인 휴가 여부는 주간보고에서 확인", href: "/work-logs" },
      ...(cardAmount!==null?[{ label: "이번 달 카드 사용액", value: moneyForDashboard(cardAmount), unit: "", icon: CreditCard, note: cardReport?`정산 ${cardReport.status}`:"정산 미생성", href: "/admin/card-settlements" }]:[]),
    ];
  } else if (team) {
    cards = [
      { label: "관리 조직 구성원", value: roster.length, unit: "명", icon: Users, note: "본인 포함 조회 인원", href: "/admin/attendance" },
      { label: "오늘 출근", value: checkedIn, unit: "명", icon: LogIn, note: `${today} 기록`, href: "/admin/attendance" },
      { label: "휴가 승인 대기", value: waitingApprovals.length, unit: "건", icon: ClipboardCheck, note: "현재 내 결재 단계", href: "/approvals" },
      { label: "프로젝트 투입", value: new Set(currentAssignments.map((row) => row.user_id)).size, unit: "명", icon: BriefcaseBusiness, note: "관리 조직 프로젝트", href: "/admin/projects" },
      { label: "팀 업무일지", value: workStatus.length-unlogged, unit: "명", icon: NotebookPen, note: `미작성 ${unlogged}명`, href: "/work-logs" },
      { label: "주간보고", value: weeklyConfirmed, unit: "명", icon: Presentation, note: `미작성 ${weeklyMissing}명`, href: "/weekly-reports" },
    ];
  } else {
    const todayState = attendance.today
      ? attendanceStatusLabels[attendance.today.attendance_status]
      : "미출근";
    cards = [
      { label: "오늘 근태", value: todayState, unit: "", icon: Clock3, note: `${formatTime(attendance.today?.check_in_at ?? null, timezone)} · ${formatMinutes(attendance.today?.worked_minutes ?? 0)}`, href: "/attendance" },
      { label: "잔여 연차", value: leave.totals.get("ANNUAL") ?? 0, unit: "일", icon: PlaneTakeoff, note: "승인 대기분 반영", href: "/leave" },
      { label: "현재 프로젝트", value: currentProjects.length, unit: "개", icon: BriefcaseBusiness, note: currentProjects.length ? `${currentProjects.reduce((sum, row) => sum + row.allocation_rate, 0)}% 투입` : "현재 대기", href: "/projects" },
      { label: "지급 자산", value: currentAssets.length, unit: "대", icon: PackageOpen, note: "현재 미반납 자산", href: "/assets" },
      { label: "오늘 업무일지", value: myWork?.entry_count??0, unit: "건", icon: NotebookPen, note: `${Math.round((myWork?.total_minutes??0)/60*10)/10}시간 기록`, href: "/work-logs" },
      { label: "이번 주 보고", value: myWeekly?.status==="CONFIRMED"?"확정":myWeekly?.status==="DRAFT"?"작성 중":"미작성", unit: "", icon: Presentation, note: "월요일~금요일", href: "/weekly-reports" },
    ];
  }

  const actions = [
    { href: "/attendance", label: "내 근태", detail: "출퇴근 기록과 월간 현황", icon: Clock3 },
    { href: "/leave", label: "휴가", detail: "잔여 연차와 신청 내역", icon: PlaneTakeoff },
    { href: "/approvals", label: "결재함", detail: "요청·승인 진행 상황", icon: ClipboardCheck },
    { href: "/notifications", label: "알림", detail: "업무 이벤트 알림", icon: Bell },
    { href: "/assets", label: "내 자산", detail: "지급 자산과 반납 이력", icon: PackageOpen },
    { href: "/projects", label: "내 프로젝트", detail: "현재·예정 투입 현황", icon: BriefcaseBusiness },
    { href: "/work-logs", label: "업무일지", detail: "오늘 수행한 업무 기록", icon: NotebookPen },
    { href: "/weekly-reports", label: "주간보고", detail: "이번 주 업무 정리와 확정", icon: Presentation },
    { href: "/expenses", label: "법인카드 사용내역", detail: "프로젝트 비용과 영수증", icon: CreditCard },
    ...(account.permissions.includes("USER_WRITE")
      ? [{ href: "/admin/users", label: "직원관리", detail: "구성원 조회 및 등록", icon: Users }]
      : []),
    ...(account.permissions.includes("USER_APPROVE")
      ? [{ href: "/admin/requests", label: "가입 요청", detail: `승인 대기 ${metrics.requested}건`, icon: UserCheck }]
      : []),
    { href: "/organizations", label: "조직도", detail: "조직과 구성원 찾기", icon: Network },
    { href: "/profile", label: "내 프로필", detail: "연락처 및 기본 정보", icon: ShieldCheck },
  ];
  const monthlyStats = [
    { label: "정상", value: monthRows.filter((row) => row.attendance_status === "NORMAL").length, color: "bg-emerald-500" },
    { label: "지각", value: monthRows.filter((row) => row.status_flags.includes("LATE")).length, color: "bg-amber-500" },
    { label: "결근", value: monthRows.filter((row) => row.attendance_status === "ABSENT").length, color: "bg-rose-500" },
    { label: "휴가", value: monthRows.filter((row) => ["VACATION", "HALF_DAY"].includes(row.attendance_status)).length, color: "bg-blue-500" },
  ];
  const date = new Intl.DateTimeFormat("ko-KR", {
    timeZone: timezone,
    dateStyle: "full",
  }).format(now);
  const projectById = new Map(projects.projects.map((project) => [project.id, project]));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            {admin ? "전사 운영 현황" : team ? "팀 업무 현황" : "내 워크스페이스"}
          </p>
          <h1 className="text-[26px] font-bold tracking-[-.045em]">대시보드</h1>
        </div>
        <p className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">
          <CalendarDays size={14} /> {date}
        </p>
      </div>
      <section className="relative mb-6 overflow-hidden rounded-lg bg-brand-navy px-6 py-6 text-white sm:px-7">
        <div className="pointer-events-none absolute -top-12 right-14 hidden size-56 rotate-12 border border-white/10 sm:block" />
        <div className="pointer-events-none absolute top-3 right-4 hidden size-40 rotate-12 border border-white/10 sm:block" />
        <div className="relative">
          <div className="mb-3 flex items-center gap-2 text-[9px] font-medium tracking-[.18em] text-white/60">
            <span className="size-1.5 bg-brand-yellow" /> DIGITAL SQUARE WORKSPACE
          </div>
          <h2 className="text-xl font-semibold tracking-tight">안녕하세요, {account.name}님.</h2>
          <p className="mt-2 text-[12px] leading-6 text-[#b5c3d5]">
            {admin
              ? "사람, 프로젝트, 자산의 운영 현황을 한눈에 확인하세요."
              : "오늘의 근태와 배정된 업무를 확인하고 업무를 시작하세요."}
          </p>
        </div>
      </section>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </div>
      {admin || team ? (
        <Card className="mb-6 gap-0 py-0">
          <CardHeader className="border-b px-5 py-4"><CardTitle className="text-sm">이번 달 근태 지표</CardTitle></CardHeader>
          <CardContent className="grid gap-5 py-5 sm:grid-cols-4">
            {monthlyStats.map((stat) => (
              <div key={stat.label}>
                <div className="mb-2 flex items-center justify-between text-xs"><span className="text-muted-foreground">{stat.label}</span><strong>{stat.value}건</strong></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full ${stat.color}`} style={{ width: `${monthRows.length ? Math.max(4, (stat.value / monthRows.length) * 100) : 0}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
            <CardTitle className="text-sm">{admin ? "직원 운영 현황" : team ? "팀원 현황" : "내 업무 정보"}</CardTitle>
            {admin ? <Link href="/admin/users" className="text-[11px] text-muted-foreground">전체 보기</Link> : null}
          </CardHeader>
          <CardContent className="px-0">
            {admin ? (
              <div className="flex gap-6 px-5 pt-3">
                <Link href="/dashboard" className={`border-b-2 pb-3 text-xs ${!showRequests ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground"}`}>재직 직원 {metrics.active}</Link>
                <Link href="/dashboard?view=requests" className={`border-b-2 pb-3 text-xs ${showRequests ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground"}`}>가입 요청 {metrics.requested}</Link>
              </div>
            ) : null}
            <Table>
              <TableHeader><TableRow><TableHead className="pl-5">이름 / 사번</TableHead><TableHead>소속 조직</TableHead><TableHead>오늘 근태</TableHead><TableHead>현재 프로젝트</TableHead></TableRow></TableHeader>
              <TableBody>
                {list.rows.slice(0, 8).map((row) => {
                  const rosterRow = roster.find((item) => item.id === row.id);
                  const userProjects = currentAssignments.filter((item) => item.user_id === row.id).map((item) => projectById.get(item.project_id)?.project_name).filter(Boolean);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="pl-5"><p className="text-[12px] font-semibold">{row.name}</p><p className="mt-1 text-[10px] text-muted-foreground">{row.employee_number ?? "사번 미부여"}</p></TableCell>
                      <TableCell>{catalogs.organizations.find((org) => org.id === row.organization_id)?.name ?? "미배정"}</TableCell>
                      <TableCell><Badge variant="outline">{showRequests ? "승인 대기" : rosterRow?.summary ? attendanceStatusLabels[rosterRow.summary.attendance_status] : row.id === account.id && attendance.today ? attendanceStatusLabels[attendance.today.attendance_status] : "미출근"}</Badge></TableCell>
                      <TableCell className="max-w-52 truncate">{userProjects.join(", ") || "대기"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {!list.rows.length ? <p className="py-16 text-center text-xs text-muted-foreground">표시할 직원 정보가 없습니다.</p> : null}
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-5 py-4"><CardTitle className="text-sm">업무 바로가기</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-px bg-border p-0">
              {actions.map((action) => {
                const Icon = action.icon;
                return <Link key={action.href} href={action.href} className="group bg-card p-4 hover:bg-[#fafcff]"><div className="mb-3 flex items-center justify-between"><Icon size={19} strokeWidth={1.5} className="text-primary"/><ArrowUpRight size={12} className="text-[#a6b0bd] group-hover:text-primary"/></div><p className="text-xs font-semibold">{action.label}</p><p className="mt-1.5 text-[10px] text-muted-foreground">{action.detail}</p></Link>;
              })}
            </CardContent>
          </Card>
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-5 py-4"><CardTitle className="text-sm">조직 현황</CardTitle></CardHeader>
            <CardContent className="px-5 py-1">
              {catalogs.organizations.filter((org) => org.active && org.parent_id).map((org) => <div key={org.id} className="flex items-center gap-2.5 border-b py-3 last:border-0"><Building2 size={15} className="text-[#93a0b2]"/><p className="text-xs">{org.name}</p><span className="ml-auto text-[10px] text-muted-foreground">{catalogs.directory.filter((person) => person.organization_id === org.id).length}명</span></div>)}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
