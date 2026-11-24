import { notFound } from "next/navigation";
import { requireAnyPage } from "@/shared/auth/account";
import { projectDetail } from "@/modules/project/infrastructure/repository";
import { projectHubDetail } from "@/modules/project-hub/infrastructure/repository";
import { organizationCatalogs } from "@/modules/organization/infrastructure/repository";
import { CommandForm } from "@/components/command-form";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

export default async function ProjectResourcesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await requireAnyPage([
    "PROJECT_RATE_READ",
    "PROJECT_RATE_MANAGE",
    "EMPLOYEE_COST_RATE_READ",
    "EMPLOYEE_COST_RATE_MANAGE",
  ]);
  const { id } = await params;
  const [project, hub, catalogs] = await Promise.all([
    projectDetail(id),
    projectHubDetail(id),
    organizationCatalogs(),
  ]);
  if (!project) notFound();
  const names = new Map(catalogs.directory.map((person) => [person.id, person.name]));
  const canManage =
    account.permissions.includes("PROJECT_RATE_MANAGE") &&
    (account.permissions.includes("PROJECT_READ_ALL") ||
      project.project.project_manager_id === account.id);
  const canManageEmployeeRates = account.permissions.includes("EMPLOYEE_COST_RATE_MANAGE");
  const canReadActualWork = account.permissions.some((permission) =>
    ["WORK_LOG_READ_SELF", "WORK_LOG_READ_PROJECT", "WORK_LOG_READ_ALL"].includes(permission),
  );
  const latestByAssignment = new Map<string, (typeof hub.rates)[number]>();
  for (const rate of hub.rates)
    if (!latestByAssignment.has(rate.assignment_id))
      latestByAssignment.set(rate.assignment_id, rate);
  return (
    <>
      <PageHeading
        eyebrow="RESOURCE & RATE"
        title="MM · 단가 Snapshot"
        description={`${project.project.project_code} · 투입 계획 MM와 원가/청구 단가 변경 이력을 보존합니다.`}
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>프로젝트 투입 단가</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {hub.assignments.map((assignment) => {
            const latest = latestByAssignment.get(assignment.id);
            const employeeRates = hub.costRates.filter(
              (rate) => rate.user_id === assignment.user_id,
            );
            const actualMinutes = hub.actualMinutesByUser[assignment.user_id] ?? 0;
            return (
              <div key={assignment.id} className="rounded-md border p-4">
                <div className="mb-4">
                  <p className="font-semibold">
                    {names.get(assignment.user_id) ?? "직원"} · {assignment.project_role}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    현재 계획 MM {assignment.planned_mm ?? "미등록"} · 실제 공수{" "}
                    {canReadActualWork
                      ? `${(actualMinutes / 60).toFixed(1)}시간 / ${(actualMinutes / 60 / 160).toFixed(2)}MM`
                      : "조회 권한 없음"}{" "}
                    · Snapshot {latest ? `#${latest.snapshot_no}` : "없음"}
                  </p>
                </div>
                {canManage ? (
                  <CommandForm
                    endpoint="/api/project-hub"
                    action="assignment.rate.snapshot"
                    constants={{ assignment_id: assignment.id }}
                    fields={[
                      {
                        name: "planned_mm",
                        label: "계획 MM",
                        type: "number",
                        min: 0,
                        step: 0.01,
                        value: latest?.planned_mm ?? assignment.planned_mm ?? 0,
                        required: true,
                      },
                      {
                        name: "monthly_cost_rate",
                        label: "월 원가",
                        type: "number",
                        min: 0,
                        step: 1,
                        value:
                          latest?.monthly_cost_rate ?? employeeRates[0]?.monthly_cost_rate ?? 0,
                        required: true,
                      },
                      {
                        name: "monthly_billing_rate",
                        label: "월 청구 단가",
                        type: "number",
                        min: 0,
                        step: 1,
                        value: latest?.monthly_billing_rate ?? 0,
                        required: true,
                      },
                      {
                        name: "source_employee_cost_rate_id",
                        label: "직원 원가 기준",
                        type: "select",
                        options: employeeRates.map((rate) => ({
                          value: rate.id,
                          label: `${rate.effective_from} · ${money.format(rate.monthly_cost_rate)}원`,
                        })),
                      },
                      { name: "reason", label: "변경 사유", type: "textarea" },
                    ]}
                    submit="Snapshot 저장"
                  />
                ) : (
                  <p className="text-sm">
                    계획 MM {latest?.planned_mm ?? assignment.planned_mm ?? "—"} · 월 원가{" "}
                    {latest ? `${money.format(latest.monthly_cost_rate)}원` : "—"} · 월 청구{" "}
                    {latest ? `${money.format(latest.monthly_billing_rate)}원` : "—"}
                  </p>
                )}
              </div>
            );
          })}
          {!hub.assignments.length ? (
            <p className="text-sm text-muted-foreground">투입 인력이 없습니다.</p>
          ) : null}
        </CardContent>
      </Card>
      {hub.rates.length ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Snapshot 이력</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>직원 / 역할</TableHead>
                  <TableHead>Snapshot</TableHead>
                  <TableHead>계획 MM</TableHead>
                  <TableHead>월 원가</TableHead>
                  <TableHead>월 청구</TableHead>
                  <TableHead>사유</TableHead>
                  <TableHead>등록일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hub.rates.map((rate) => {
                  const assignment = hub.assignments.find((item) => item.id === rate.assignment_id);
                  return (
                    <TableRow key={rate.id}>
                      <TableCell>
                        {assignment
                          ? `${names.get(assignment.user_id) ?? "직원"} · ${assignment.project_role}`
                          : "—"}
                      </TableCell>
                      <TableCell>#{rate.snapshot_no}</TableCell>
                      <TableCell>{rate.planned_mm}</TableCell>
                      <TableCell>{money.format(rate.monthly_cost_rate)}원</TableCell>
                      <TableCell>{money.format(rate.monthly_billing_rate)}원</TableCell>
                      <TableCell>{rate.reason || "—"}</TableCell>
                      <TableCell>{rate.created_at.slice(0, 10)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
      {canManageEmployeeRates ? (
        <Card>
          <CardHeader>
            <CardTitle>직원 원가 기준 등록</CardTitle>
          </CardHeader>
          <CardContent>
            <CommandForm
              endpoint="/api/project-hub"
              action="employee.cost_rate.save"
              fields={[
                {
                  name: "user_id",
                  label: "직원",
                  type: "select",
                  required: true,
                  options: catalogs.directory.map((person) => ({
                    value: person.id,
                    label: person.name,
                  })),
                },
                { name: "effective_from", label: "적용 시작일", type: "date", required: true },
                { name: "effective_to", label: "적용 종료일", type: "date" },
                {
                  name: "monthly_cost_rate",
                  label: "월 원가",
                  type: "number",
                  min: 0,
                  step: 1,
                  required: true,
                },
                { name: "note", label: "비고", type: "textarea" },
              ]}
              submit="원가 기준 저장"
            />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
