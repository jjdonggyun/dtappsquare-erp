import { notFound } from "next/navigation";
import { requireAnyPage } from "@/shared/auth/account";
import { projectDetail } from "@/modules/project/infrastructure/repository";
import { projectHubDetail } from "@/modules/project-hub/infrastructure/repository";
import { documentCategoryLabels } from "@/modules/project-hub/domain/contracts";
import { ProjectDocumentUpload } from "@/components/project-document-upload";
import { CommandForm } from "@/components/command-form";
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

function fileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

export default async function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await requireAnyPage(["PROJECT_DOCUMENT_READ", "PROJECT_DOCUMENT_MANAGE"]);
  const { id } = await params;
  const [project, hub] = await Promise.all([projectDetail(id), projectHubDetail(id)]);
  if (!project) notFound();
  const canManage =
    account.permissions.includes("PROJECT_DOCUMENT_MANAGE") &&
    (account.permissions.includes("PROJECT_READ_ALL") ||
      project.project.project_manager_id === account.id);
  return (
    <>
      <PageHeading
        eyebrow="PROJECT DOCUMENTS"
        title="프로젝트 문서"
        description={`${project.project.project_code} · 계약서, 산출물, 검수자료와 보고서를 버전별로 보관합니다.`}
      />
      {canManage ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>문서 등록</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectDocumentUpload projectId={id} documents={hub.documents} />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>문서 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>분류</TableHead>
                <TableHead>문서명 / 파일</TableHead>
                <TableHead>버전</TableHead>
                <TableHead>크기</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead>상태</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {hub.documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell>
                    {documentCategoryLabels[document.category] ?? document.category}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{document.title}</p>
                    <p className="text-xs text-muted-foreground">{document.file_name}</p>
                  </TableCell>
                  <TableCell>V{document.document_version}</TableCell>
                  <TableCell>{fileSize(document.size_bytes)}</TableCell>
                  <TableCell>{document.created_at.slice(0, 10)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{document.archived_at ? "보관" : "사용 중"}</Badge>
                  </TableCell>
                  <TableCell className="space-y-2">
                    <a
                      href={`/api/project-hub/document?id=${document.id}`}
                      className="block text-xs font-semibold text-primary hover:underline"
                    >
                      다운로드
                    </a>
                    {canManage && !document.archived_at ? (
                      <CommandForm
                        endpoint="/api/project-hub"
                        action="document.archive"
                        constants={{ id: document.id }}
                        submit="보관"
                        columns={1}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!hub.documents.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              등록된 프로젝트 문서가 없습니다.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
