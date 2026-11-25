"use client";
import { apiErrorMessage } from "@/shared/browser/api-error";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientRequestId } from "@/shared/browser/client-request-id";
import { documentCategories, documentCategoryLabels } from "@/modules/project-hub/domain/contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProjectDocumentUpload({
  projectId,
  documents,
}: {
  projectId: string;
  documents: { id: string; title: string; document_version: number; archived_at: string | null }[];
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const requestId = useRef<string | null>(null);
  const router = useRouter();

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const formElement = event.currentTarget;
        setBusy(true);
        setMessage("");
        try {
          requestId.current ??= createClientRequestId();
          const form = new FormData(formElement);
          form.set("project_id", projectId);
          const response = await fetch("/api/project-hub/document", {
            method: "POST",
            headers: { "X-Idempotency-Key": requestId.current },
            body: form,
          });
          const result = await response.json();
          if (!response.ok)
            throw new Error(
              apiErrorMessage(result, "업로드하지 못했습니다.", response.status),
            );
          requestId.current = null;
          setFailed(false);
          setMessage(result.data?.message ?? "문서를 등록했습니다.");
          formElement.reset();
          router.refresh();
        } catch (error) {
          setFailed(true);
          setMessage(error instanceof Error ? error.message : "연결을 확인해 주세요.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="document-title">문서명 *</Label>
          <Input id="document-title" name="title" required maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="document-category">분류 *</Label>
          <select id="document-category" name="category" required defaultValue="DELIVERABLE">
            {documentCategories.map((category) => (
              <option key={category} value={category}>
                {documentCategoryLabels[category]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="document-replaces">이전 버전</Label>
          <select id="document-replaces" name="replaces_document_id" defaultValue="">
            <option value="">신규 문서</option>
            {documents
              .filter((document) => !document.archived_at)
              .map((document) => (
                <option key={document.id} value={document.id}>
                  {document.title} · V{document.document_version}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="document-file">파일 *</Label>
          <Input
            id="document-file"
            name="file"
            type="file"
            required
            accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.webp"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX, JPEG, PNG, WebP · 최대 50MB</p>
      {message ? (
        <Alert variant={failed ? "destructive" : "default"}>
          <AlertDescription className="whitespace-pre-line">{message}</AlertDescription>
        </Alert>
      ) : null}
      <Button disabled={busy} type="submit">
        {busy ? "업로드 중…" : "문서 등록"}
      </Button>
    </form>
  );
}
