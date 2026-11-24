import { notFound } from "next/navigation";
import { requireAnyPage } from "@/shared/auth/account";
import { projectDetail, projectPlanning } from "@/modules/project/infrastructure/repository";
import { projectHubDetail } from "@/modules/project-hub/infrastructure/repository";
import {
  inspectionResults,
  inspectionResultLabels,
  inspectionStatuses,
  inspectionStatusLabels,
} from "@/modules/project-hub/domain/contracts";
import { CommandForm, type Field } from "@/components/command-form";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const inspectionTypes = [
  { value: "DELIVERY", label: "납품" },
  { value: "MILESTONE", label: "마일스톤" },
  { value: "QUALITY", label: "품질" },
  { value: "ACCEPTANCE", label: "인수" },
  { value: "OTHER", label: "기타" },
];

export default async function ProjectInspectionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await requireAnyPage(["PROJECT_INSPECTION_READ", "PROJECT_INSPECTION_MANAGE"]);
  const { id } = await params;
  const [project, planning, hub] = await Promise.all([
    projectDetail(id),
    projectPlanning(id),
    projectHubDetail(id),
  ]);
  if (!project) notFound();
  const canManage =
    account.permissions.includes("PROJECT_INSPECTION_MANAGE") &&
    (account.permissions.includes("PROJECT_READ_ALL") ||
      project.project.project_manager_id === account.id);
  const fields = (inspection?: (typeof hub.inspections)[number]): Field[] => [
    { name: "title", label: "검수명", value: inspection?.title, required: true },
    {
      name: "inspection_type",
      label: "검수 유형",
      type: "select",
      value: inspection?.inspection_type ?? "DELIVERY",
      required: true,
      options: inspectionTypes,
    },
    {
      name: "milestone_id",
      label: "연결 마일스톤",
      type: "select",
      value: inspection?.milestone_id ?? "",
      options: planning.milestones.map((milestone) => ({
        value: milestone.id,
        label: `${milestone.planned_date} · ${milestone.name}`,
      })),
    },
    {
      name: "document_id",
      label: "검수 문서",
      type: "select",
      value: inspection?.document_id ?? "",
      options: hub.documents
        .filter((document) => !document.archived_at)
        .map((document) => ({
          value: document.id,
          label: `${document.title} · V${document.document_version}`,
        })),
    },
    {
      name: "requested_date",
      label: "요청일",
      type: "date",
      value: inspection?.requested_date ?? "",
    },
    {
      name: "scheduled_date",
      label: "예정일",
      type: "date",
      value: inspection?.scheduled_date ?? "",
    },
    {
      name: "completed_date",
      label: "완료일",
      type: "date",
      value: inspection?.completed_date ?? "",
    },
    {
      name: "customer_contact_name",
      label: "고객 담당자",
      value: inspection?.customer_contact_name ?? "",
    },
    {
      name: "customer_contact_email",
      label: "고객 이메일",
      type: "email",
      value: inspection?.customer_contact_email ?? "",
    },
    {
      name: "status",
      label: "상태",
      type: "select",
      value: inspection?.status ?? "DRAFT",
      required: true,
      options: inspectionStatuses.map((status) => ({
        value: status,
        label: inspectionStatusLabels[status],
      })),
    },
    {
      name: "result",
      label: "결과",
      type: "select",
      value: inspection?.result ?? "PENDING",
      required: true,
      options: inspectionResults.map((result) => ({
        value: result,
        label: inspectionResultLabels[result],
      })),
    },
    { name: "note", label: "검수 내용", type: "textarea", value: inspection?.note ?? "" },
  ];
  return (
    <>
      <PageHeading
        eyebrow="INSPECTION"
        title="검수 · 완료"
        description={`${project.project.project_code} · 요청부터 완료 결과와 증빙 문서까지 추적합니다.`}
      />
      {canManage ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>새 검수 등록</CardTitle>
          </CardHeader>
          <CardContent>
            <CommandForm
              endpoint="/api/project-hub"
              action="inspection.save"
              constants={{ project_id: id }}
              fields={fields()}
              submit="검수 등록"
            />
          </CardContent>
        </Card>
      ) : null}
      <div className="space-y-5">
        {hub.inspections.map((inspection) => (
          <Card key={inspection.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>{inspection.title}</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline">
                    {inspectionStatusLabels[inspection.status] ?? inspection.status}
                  </Badge>
                  <Badge variant="outline">
                    {inspectionResultLabels[inspection.result] ?? inspection.result}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {canManage ? (
                <CommandForm
                  endpoint="/api/project-hub"
                  action="inspection.save"
                  constants={{ id: inspection.id, project_id: id, version: inspection.version }}
                  fields={fields(inspection)}
                  submit="검수 정보 저장"
                />
              ) : (
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">일정</dt>
                    <dd>
                      {inspection.requested_date ?? "—"} → {inspection.scheduled_date ?? "—"} →{" "}
                      {inspection.completed_date ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">고객 담당자</dt>
                    <dd>
                      {inspection.customer_contact_name || "—"}{" "}
                      {inspection.customer_contact_email
                        ? `· ${inspection.customer_contact_email}`
                        : ""}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">검수 내용</dt>
                    <dd className="whitespace-pre-wrap">{inspection.note || "—"}</dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>
        ))}
        {!hub.inspections.length ? (
          <Card>
            <CardContent className="py-14 text-center text-sm text-muted-foreground">
              등록된 검수가 없습니다.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
