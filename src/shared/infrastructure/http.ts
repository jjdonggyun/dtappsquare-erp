import "server-only";
import { ZodError } from "zod";
import { NextResponse } from "next/server";
import { AppError, errorStatus } from "@/shared/domain/errors";
import { environment } from "./env";
const messages = {
  Unauthorized: "로그인이 필요합니다.",
  Forbidden: "이 작업을 수행할 권한이 없습니다.",
  ValidationError: "입력값을 확인해 주세요.",
  NotFound: "대상을 찾을 수 없습니다.",
  Conflict: "현재 상태와 충돌합니다. 새로고침 후 다시 시도해 주세요.",
  InternalError: "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};
export function failure(error: unknown, requestId: string) {
  const appError =
    error instanceof AppError
      ? error
      : error instanceof ZodError || error instanceof SyntaxError
        ? new AppError("ValidationError")
        : new AppError("InternalError");
  if (appError.code === "InternalError")
    console.error(JSON.stringify({ requestId, code: appError.code }));
  return NextResponse.json(
    { error: { code: appError.code, message: messages[appError.code], requestId } },
    { status: errorStatus[appError.code], headers: { "Cache-Control": "no-store" } },
  );
}
export async function readMutation(request: Request) {
  if (request.headers.get("origin") !== new URL(environment().APP_URL).origin)
    throw new AppError("Forbidden");
  return readExternalJson(request, 32768);
}

export async function readExternalJson(request: Request, maxBytes: number) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new AppError("ValidationError");
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("ValidationError");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new AppError("ValidationError");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
