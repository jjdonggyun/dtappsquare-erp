import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentAccount } from "@/shared/auth/account";
import { authorize } from "@/modules/rbac/domain/policy";
import { executeProjectHubCommand } from "@/modules/project-hub/application/commands";
import { projectHubCommandRepository } from "@/modules/project-hub/infrastructure/repository";
import { documentCategories } from "@/modules/project-hub/domain/contracts";
import { AppError, databaseError } from "@/shared/domain/errors";
import { assertMutationOrigin, failure } from "@/shared/infrastructure/http";
import { serverClient } from "@/shared/infrastructure/supabase/server";

const allowedTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(request: Request) {
  const requestId = request.headers.get("X-Idempotency-Key") ?? crypto.randomUUID();
  let uploadedKey = "";
  try {
    assertMutationOrigin(request);
    const account = await currentAccount();
    authorize(account, "PROJECT_DOCUMENT_MANAGE");
    const form = await request.formData();
    const projectId = z.uuid().parse(form.get("project_id"));
    const title = z.string().trim().min(1).max(200).parse(form.get("title"));
    const category = z.enum(documentCategories).parse(form.get("category"));
    const replaces = z.union([z.literal(""), z.uuid()]).parse(form.get("replaces_document_id") ?? "");
    const file = form.get("file");
    if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size <= 0 || file.size > 50 * 1024 * 1024)
      throw new AppError("ValidationError");

    const bytes = Buffer.from(await file.arrayBuffer());
    const digest = createHash("sha256").update(bytes).digest("hex");
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-180) || "document";
    uploadedKey = `${projectId}/${crypto.randomUUID()}/${safeName}`;
    const client = await serverClient();
    const uploaded = await client.storage.from("project-documents").upload(uploadedKey, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (uploaded.error) throw new AppError("InternalError");

    const data = await executeProjectHubCommand(
      account,
      {
        action: "document.register",
        payload: {
          ...(replaces ? { id: replaces } : {}),
          project_id: projectId,
          title,
          category,
          file_name: file.name,
          storage_key: uploadedKey,
          mime_type: file.type,
          size_bytes: file.size,
          sha256: digest,
        },
      },
      projectHubCommandRepository(),
      requestId,
    );
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (uploadedKey) {
      const client = await serverClient();
      await client.storage.from("project-documents").remove([uploadedKey]);
    }
    return failure(error, requestId);
  }
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const account = await currentAccount();
    authorize(account, "PROJECT_DOCUMENT_READ");
    const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
    const client = await serverClient();
    const row = await client.from("documents").select("storage_key,file_name,mime_type").eq("id", id).single();
    if (row.error) throw databaseError(row.error);
    const result = await client.storage.from("project-documents").download(row.data.storage_key);
    if (result.error) throw new AppError("InternalError");
    const fileName = row.data.file_name.replace(/[\r\n"]/g, "_");
    return new NextResponse(result.data.stream(), {
      headers: {
        "Content-Type": row.data.mime_type,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failure(error, requestId);
  }
}
