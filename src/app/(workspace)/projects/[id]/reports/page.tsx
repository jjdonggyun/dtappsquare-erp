import { notFound } from "next/navigation";
import { requireAnyPage } from "@/shared/auth/account";
import { projectDetail } from "@/modules/project/infrastructure/repository";
import { projectWeeklyReports } from "@/modules/work-management/infrastructure/repository";
import { organizationCatalogs } from "@/modules/organization/infrastructure/repository";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ProjectWeeklyReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAnyPage([
    "WEEKLY_REPORT_READ_SELF",
    "WEEKLY_REPORT_READ_TEAM",
    "WEEKLY_REPORT_READ_ALL",
  ]);
  const { id } = await params;
  const [project, reports, catalogs] = await Promise.all([
    projectDetail(id),
    projectWeeklyReports(id),
    organizationCatalogs(),
  ]);
  if (!project) notFound();
  const names = new Map(catalogs.directory.map((person) => [person.id, person.name]));
  const rows = reports.flatMap((report) =>
    report.entries_snapshot
      .filter((entry) => entry.project_id === id)
      .map((entry) => ({ report, entry })),
  );
  return (
    <>
      <PageHeading
        eyebrow="PROJECT WEEKLY REPORT"
        title="프로젝트 주간보고"
        description={`${project.project.project_code} · 주간보고 Snapshot에서 이 프로젝트 업무만 표시합니다.`}
      />
      <Card>
        <CardHeader>
          <CardTitle>주간보고 연결 업무</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>보고 주간</TableHead>
                <TableHead>직원</TableHead>
                <TableHead>업무일</TableHead>
                <TableHead>업무</TableHead>
                <TableHead>시간</TableHead>
                <TableHead>보고 상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ report, entry }) => (
                <TableRow key={`${report.id}:${entry.id}`}>
                  <TableCell>
                    {report.week_start_date} ~ {report.week_end_date}
                  </TableCell>
                  <TableCell>{names.get(report.user_id) ?? "직원"}</TableCell>
                  <TableCell>{entry.date}</TableCell>
                  <TableCell>
                    <p className="font-medium">{entry.title}</p>
                    <p className="text-xs text-muted-foreground">{entry.description || "—"}</p>
                  </TableCell>
                  <TableCell>{(entry.minutes / 60).toFixed(1)}시간</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {report.status === "CONFIRMED" ? "확정" : "초안"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!rows.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              연결된 주간보고 Snapshot이 없습니다.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
