import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { projectCatalog, projectTasksForProjects } from "@/modules/project/infrastructure/repository";
import { projectFinancialPortfolio } from "@/modules/expense-finance/infrastructure/repository";
import { dashboardSummary } from "@/modules/dashboard/infrastructure/repository";
import { employeeList } from "@/modules/users/infrastructure/repository";
import { leaveOverview } from "@/modules/leave/infrastructure/repository";
import { weeklyReport } from "@/modules/work-management/infrastructure/repository";
import { mondayOf } from "@/modules/work-management/domain/week";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
import type { Account } from "@/modules/users/domain/contracts";

type Tile = { label: string; value: string; href: string; permission: string };
const number = (value: number) => value.toLocaleString("ko-KR");
const money = (value: number) => `${number(Math.round(value))}원`;
const has = (account: Account, permission: string) => account.permissions.includes(permission);
const any = (account: Account, permissions: string[]) => permissions.some((permission) => has(account, permission));

function Tiles({ account, tiles }: { account: Account; tiles: Tile[] }) {
  const visible = tiles.filter((tile) => has(account, tile.permission));
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{visible.map((tile) => (
    <Link href={tile.href} key={tile.label}>
      <Card className="h-full gap-0 py-5 hover:border-primary/40"><CardContent>
        <p className="text-xs text-muted-foreground">{tile.label}</p>
        <p className="mt-3 text-xl font-semibold">{tile.value}</p>
      </CardContent></Card>
    </Link>
  ))}</div>;
}

function Links({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  if (!items.length) return null;
  return <Card className="gap-0 py-0"><CardHeader className="border-b py-4"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
    <CardContent className="grid gap-3 py-5 sm:grid-cols-2">{items.map((item) =>
      <Link key={item.href} href={item.href} className="rounded-md border px-4 py-3 text-sm hover:border-primary/40 hover:text-primary">{item.label} →</Link>
    )}</CardContent></Card>;
}

export async function RoleDashboard({ account, role }: { account: Account; role: "HEAD" | "ADMINISTRATIVE_POSITION" | "TEAM_LEADER" | "MEMBER" | "GUEST" }) {
  if (role === "GUEST") return <div className="mx-auto max-w-xl py-20 text-center">
    <h1 className="text-2xl font-semibold">ERP 이용 안내</h1>
    <p className="mt-4 text-sm text-muted-foreground">관리자가 소속과 역할을 지정하면 업무 화면을 사용할 수 있습니다.</p>
    <Link href="/profile" className="mt-6 inline-block text-sm text-primary">내 프로필 보기 →</Link>
  </div>;

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const projects = any(account, ["PROJECT_READ_SELF", "PROJECT_READ", "PROJECT_READ_ALL"])
    ? await projectCatalog() : { projects: [], assignments: [] };
  const myProjects = projects.projects.filter((project) => project.project_manager_id === account.id ||
    projects.assignments.some((assignment) => assignment.project_id === project.id && assignment.user_id === account.id));
  const ownLeave = has(account, "LEAVE_REQUEST") ? await leaveOverview(account.id) : null;
  const pendingLeave = ownLeave?.rows.filter((leave) => leave.status === "REQUESTED").length ?? 0;
  const pendingApprovals = any(account, ["LEAVE_APPROVE", "QUOTATION_APPROVE", "CONTRACT_APPROVE"])
    ? await pendingApprovalCount(account.id) : 0;
  const heading = {
    HEAD: "경영 현황", ADMINISTRATIVE_POSITION: "운영 현황", TEAM_LEADER: "팀과 프로젝트", MEMBER: "내 업무", GUEST: "이용 안내",
  }[role];

  if (role === "MEMBER") {
    const tasks = has(account, "PROJECT_READ_SELF") ? await projectTasksForProjects(myProjects.map((project) => project.id)) : [];
    const myTasks = tasks.filter((task) => task.assignee_id === account.id && task.status !== "DONE");
    const report = has(account, "WEEKLY_REPORT_READ_SELF") ? await weeklyReport(mondayOf(today), account.id) : null;
    return <div className="space-y-6"><h1 className="text-2xl font-semibold">{heading}</h1>
      <Tiles account={account} tiles={[
        { label: "참여 프로젝트", value: number(myProjects.length), href: "/projects", permission: "PROJECT_READ_SELF" },
        { label: "내 진행 업무", value: number(myTasks.length), href: "/work-logs", permission: "WORK_LOG_READ_SELF" },
        { label: "휴가 승인 대기", value: number(pendingLeave), href: "/leave", permission: "LEAVE_REQUEST" },
        { label: "남은 연차", value: `${ownLeave?.totals.get("ANNUAL") ?? 0}일`, href: "/leave", permission: "LEAVE_REQUEST" },
        { label: "이번 주 보고", value: report ? "작성됨" : "미작성", href: "/weekly-reports", permission: "WEEKLY_REPORT_READ_SELF" },
      ]}/>
      <Links title="오늘 할 일" items={[
        ...(has(account, "WORK_LOG_WRITE_SELF") ? [{ label: "일일업무 작성", href: "/work-logs" }] : []),
        ...(has(account, "WEEKLY_REPORT_READ_SELF") ? [{ label: "주간보고 확인", href: "/weekly-reports" }] : []),
        ...(has(account, "ATTENDANCE_READ_SELF") ? [{ label: "내 근태", href: "/attendance" }] : []),
        ...(has(account, "EXPENSE_READ_SELF") ? [{ label: "내 비용", href: "/expenses" }] : []),
      ]}/>
      <Links title="내 프로젝트" items={myProjects.slice(0, 8).map((project) => ({ label: project.project_name, href: `/projects/${project.id}` }))}/>
    </div>;
  }

  if (role === "TEAM_LEADER") {
    const team = has(account, "USER_READ_TEAM") ? await employeeList({ status: "ACTIVE" }) : null;
    const requests = has(account, "USER_APPROVE") ? await employeeList({ status: "REQUESTED" }) : null;
    const managedProjects = projects.projects;
    return <div className="space-y-6"><h1 className="text-2xl font-semibold">{heading}</h1>
      <Tiles account={account} tiles={[
        { label: "담당·팀 프로젝트", value: number(managedProjects.length), href: "/projects", permission: "PROJECT_READ" },
        { label: "팀원", value: number(team?.count ?? 0), href: "/admin/users", permission: "USER_READ_TEAM" },
        { label: "결재 대기", value: number(pendingApprovals), href: "/approvals", permission: "LEAVE_APPROVE" },
        { label: "가입 승인 대기", value: number(requests?.count ?? 0), href: "/admin/requests", permission: "USER_APPROVE" },
      ]}/>
      <Links title="처리할 업무" items={[
        ...(has(account, "LEAVE_APPROVE") ? [{ label: "팀원 휴가 승인", href: "/approvals" }] : []),
        ...(has(account, "USER_APPROVE") ? [{ label: "신규 가입 승인", href: "/admin/requests" }] : []),
        ...(has(account, "PROJECT_RESOURCE_MANAGE") ? [{ label: "프로젝트 인력·공수", href: "/admin/resources" }] : []),
        ...(has(account, "WEEKLY_REPORT_READ_SELF") ? [{ label: "주간보고", href: "/weekly-reports" }] : []),
      ]}/>
      <Links title="진행 프로젝트" items={managedProjects.slice(0, 8).map((project) => ({ label: project.project_name, href: `/projects/${project.id}` }))}/>
    </div>;
  }

  const portfolio = any(account, ["PROJECT_FINANCE_READ", "PROJECT_FINANCE_READ_ALL"])
    ? await projectFinancialPortfolio(today) : [];
  const summary = await dashboardSummary();
  const forecastLoss = portfolio.filter((row) => row.forecast_gross_profit < 0);
  const tiles: Tile[] = role === "HEAD" ? [
    { label: "전체 계약금액", value: money(summary.contractTotal ?? 0), href: "/contracts", permission: "CONTRACT_READ_ALL" },
    { label: "이번 달 매출(청구 공급가액)", value: money(summary.monthRevenue ?? 0), href: "/finance/billings", permission: "BILLING_READ_ALL" },
    { label: "이번 달 입금", value: money(summary.monthPayment ?? 0), href: "/finance/payments", permission: "PAYMENT_READ_ALL" },
    { label: "미수금", value: money(summary.outstanding ?? 0), href: "/finance/billings", permission: "BILLING_READ_ALL" },
    { label: "예상 이익", value: money(portfolio.reduce((sum, row) => sum + row.forecast_gross_profit, 0)), href: "/finance/project-pnl", permission: "PROJECT_FINANCE_READ_ALL" },
    { label: "평균 이익률", value: `${(portfolio.reduce((sum, row) => sum + (row.profit_margin ?? 0), 0) / (portfolio.filter((row) => row.profit_margin !== null).length || 1)).toFixed(1)}%`, href: "/finance/project-pnl", permission: "PROJECT_FINANCE_READ_ALL" },
    { label: "진행 프로젝트", value: number(summary.activeProjects ?? 0), href: "/projects", permission: "PROJECT_READ_ALL" },
    { label: "영업 파이프라인", value: number(summary.pipelineCount ?? 0), href: "/opportunities", permission: "OPPORTUNITY_READ_ALL" },
    { label: "인력 가동률", value: `${summary.utilizationPercent ?? 0}%`, href: "/admin/resources", permission: "RESOURCE_READ" },
    { label: "오늘 출근", value: number(summary.checkedIn ?? 0), href: "/admin/attendance", permission: "ATTENDANCE_MANAGE" },
  ] : [
    { label: "영업기회", value: number(summary.pipelineCount ?? 0), href: "/opportunities", permission: "OPPORTUNITY_READ_ALL" },
    { label: "이번 달 계약", value: money(summary.monthContract ?? 0), href: "/contracts", permission: "CONTRACT_READ_ALL" },
    { label: "이번 달 청구", value: money(summary.monthBilling ?? 0), href: "/finance/billings", permission: "BILLING_READ_ALL" },
    { label: "이번 달 입금", value: money(summary.monthPayment ?? 0), href: "/finance/payments", permission: "PAYMENT_READ_ALL" },
    { label: "미수금", value: money(summary.outstanding ?? 0), href: "/finance/billings", permission: "BILLING_READ_ALL" },
    { label: "미발행 세금계산서", value: number(summary.unissuedTaxInvoices ?? 0), href: "/finance/tax-invoices", permission: "TAX_INVOICE_READ_ALL" },
    { label: "결재 대기", value: number(pendingApprovals), href: "/approvals", permission: "LEAVE_APPROVE" },
    { label: "가입 승인 대기", value: number(summary.pendingSignup ?? 0), href: "/admin/requests", permission: "USER_APPROVE" },
  ];
  return <div className="space-y-6"><h1 className="text-2xl font-semibold">{heading}</h1>
    <Tiles account={account} tiles={tiles}/>
    <div className="grid gap-5 lg:grid-cols-2">
      <Links title={role === "HEAD" ? "경영 경보" : "처리 대기"} items={[
        ...(has(account, "BILLING_READ_ALL") && summary.overdueCount ? [{ label: `연체 청구 ${summary.overdueCount}건`, href: "/finance/billings" }] : []),
        ...(has(account, "PROJECT_FINANCE_READ_ALL") && forecastLoss.length ? [{ label: `손실 예상 프로젝트 ${forecastLoss.length}건`, href: "/finance/project-pnl" }] : []),
        ...(has(account, "PROJECT_READ_ALL") && summary.delayedProjects ? [{ label: `일정 지연 프로젝트 ${summary.delayedProjects}건`, href: "/projects" }] : []),
        ...(has(account, "APPROVAL_MANAGE") && summary.delayedApprovals ? [{ label: `장기 미결재 ${summary.delayedApprovals}건`, href: "/admin/approvals" }] : []),
        ...(has(account, "LEAVE_APPROVE") && pendingApprovals ? [{ label: `결재 대기 ${pendingApprovals}건`, href: "/approvals" }] : []),
        ...(has(account, "USER_APPROVE") ? [{ label: "가입 승인", href: "/admin/requests" }] : []),
      ]}/>
      <Links title="운영 영역" items={[
        ...(has(account, "OPPORTUNITY_READ_ALL") ? [{ label: "영업 파이프라인", href: "/opportunities" }] : []),
        ...(has(account, "PROJECT_READ_ALL") ? [{ label: "프로젝트 현황", href: "/projects" }] : []),
        ...(has(account, "PROJECT_FINANCE_READ_ALL") ? [{ label: "프로젝트 손익", href: "/finance/project-pnl" }] : []),
        ...(has(account, "ATTENDANCE_MANAGE") ? [{ label: "근태 운영", href: "/admin/attendance" }] : []),
      ]}/>
    </div>
  </div>;
}

async function pendingApprovalCount(userId: string) {
  const client = await serverClient();
  const result = await client.from("approval_request_steps")
    .select("id", { count: "exact", head: true }).eq("approver_id", userId).eq("status", "PENDING");
  if (result.error) throw databaseError(result.error);
  return result.count ?? 0;
}
