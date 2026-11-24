import Link from "next/link";
import { BriefcaseBusiness, CalendarClock, Gauge } from "lucide-react";
import { requireAnyPage } from "@/shared/auth/account";
import { projectCatalog } from "@/modules/project/infrastructure/repository";
import { assignmentStatusLabels, projectStatusLabels } from "@/modules/project/domain/contracts";
import { organizationCatalogs } from "@/modules/organization/infrastructure/repository";
import { projectPortfolioStaffing } from "@/modules/workforce-profile/infrastructure/repository";
import { dateInTimeZone } from "@/shared/domain/date-time";
import { environment } from "@/shared/infrastructure/env";
import { PageHeading } from "@/components/page-heading";
import { ProjectIndex } from "@/components/project-index";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const account = await requireAnyPage(["PROJECT_READ_SELF", "PROJECT_READ", "PROJECT_READ_ALL"]);
  const { scope } = await searchParams;
  const canManagePortfolio = account.permissions.includes("PROJECT_READ") || account.permissions.includes("PROJECT_READ_ALL");
  const managementView = canManagePortfolio && scope !== "my";
  const dataPromise = projectCatalog();

  if (managementView) {
    const [data, catalogs] = await Promise.all([dataPromise, organizationCatalogs()]);
    const portfolio = account.permissions.includes("PROJECT_STAFFING_READ") ? await projectPortfolioStaffing() : [];
    return (
      <>
        <PageHeading eyebrow="PROJECT HUB" title="프로젝트" description="일정, 인력, 공수, 문서, 검수와 비용을 한 곳에서 관리합니다." />
        <div className="mb-4 flex justify-end"><Link href="/projects?scope=my" className="text-xs text-primary hover:underline">내 투입 프로젝트만 보기</Link></div>
        <ProjectIndex projects={data.projects} assignments={data.assignments} portfolio={portfolio} people={catalogs.directory} organizations={catalogs.organizations} canWrite={account.permissions.includes("PROJECT_WRITE")} canReadAll={account.permissions.includes("PROJECT_READ_ALL")} accountId={account.id} today={dateInTimeZone(new Date(), environment().COMPANY_TIMEZONE)} />
      </>
    );
  }

  const data = await dataPromise;
  const projects = new Map(data.projects.map((project) => [project.id, project]));
  const assignments = data.assignments.filter((row) => row.user_id === account.id);
  const current = assignments.filter((row) => row.status === "IN_PROGRESS");
  const allocation = current.reduce((sum, row) => sum + row.allocation_rate, 0);
  return (
    <>
      <PageHeading eyebrow="MY PROJECTS" title="내 프로젝트" description="현재와 예정 프로젝트의 투입 기간, 역할, MM와 투입률을 확인합니다." />
      {canManagePortfolio ? <div className="mb-4 flex justify-end"><Link href="/projects" className="text-xs text-primary hover:underline">전체 프로젝트 관리</Link></div> : null}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card><CardContent><BriefcaseBusiness size={20} className="mb-4 text-primary" /><p className="text-xs text-muted-foreground">현재 프로젝트</p><p className="mt-2 text-2xl font-bold">{current.length}<span className="ml-1 text-xs font-normal">개</span></p></CardContent></Card>
        <Card><CardContent><Gauge size={20} className="mb-4 text-primary" /><p className="text-xs text-muted-foreground">현재 투입률</p><p className="mt-2 text-2xl font-bold">{allocation}<span className="ml-1 text-xs font-normal">%</span></p></CardContent></Card>
        <Card><CardContent><CalendarClock size={20} className="mb-4 text-primary" /><p className="text-xs text-muted-foreground">예정 투입</p><p className="mt-2 text-2xl font-bold">{assignments.filter((row) => ["PLANNED", "CONFIRMED"].includes(row.status)).length}<span className="ml-1 text-xs font-normal">건</span></p></CardContent></Card>
      </div>
      <Card className="gap-0 py-0"><CardContent className="px-0"><Table><TableHeader><TableRow><TableHead className="pl-5">프로젝트</TableHead><TableHead>고객사</TableHead><TableHead>역할</TableHead><TableHead>투입기간</TableHead><TableHead>계획 MM</TableHead><TableHead>투입률</TableHead><TableHead>상태</TableHead></TableRow></TableHeader><TableBody>{assignments.map((row) => { const project = projects.get(row.project_id); return <TableRow key={row.id}><TableCell className="pl-5"><Link href={`/projects/${row.project_id}`} className="font-semibold text-primary hover:underline">{project?.project_name ?? "—"}</Link><p className="mt-1 text-[10px] font-normal text-muted-foreground">{project?.project_code}</p></TableCell><TableCell>{project?.customer_name ?? "—"}</TableCell><TableCell>{row.project_role}</TableCell><TableCell>{row.planned_start_date} – {row.planned_end_date}</TableCell><TableCell>{row.planned_mm ?? "—"}</TableCell><TableCell>{row.allocation_rate}%</TableCell><TableCell><Badge variant="outline">{assignmentStatusLabels[row.status as keyof typeof assignmentStatusLabels] ?? projectStatusLabels[project?.status as keyof typeof projectStatusLabels]}</Badge></TableCell></TableRow>; })}</TableBody></Table>{!assignments.length ? <p className="py-16 text-center text-xs text-muted-foreground">프로젝트 투입 이력이 없습니다.</p> : null}</CardContent></Card>
    </>
  );
}
