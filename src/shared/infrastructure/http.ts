import "server-only";
import { ZodError, type ZodIssue } from "zod";
import { NextResponse } from "next/server";
import { AppError, errorStatus } from "@/shared/domain/errors";
import { environment } from "./env";
const messages = {
  Unauthorized: "로그인이 필요합니다.",
  EmailNotConfirmed: "이메일 확인이 필요합니다. 확인 메일을 열거나 관리자에게 로그인 초기화를 요청해 주세요.",
  Forbidden: "이 작업을 수행할 권한이 없습니다.",
  ValidationError: "입력값을 확인해 주세요.",
  NotFound: "요청한 항목을 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 선택해 주세요.",
  Conflict: "현재 상태와 충돌합니다. 새로고침 후 다시 시도해 주세요.",
  SetupRequired: "이 작업에 필요한 설정이 완료되지 않았습니다. 관리자에게 설정을 요청해 주세요.",
  TooManyRequests: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  InternalError: "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

const fieldLabels: Record<string, string> = {
  action: "작업",
  code: "코드",
  email: "이메일",
  password: "비밀번호",
  password_confirmation: "비밀번호 확인",
  name: "이름",
  user_id: "직원",
  work_policy_id: "근무정책",
  effective_from: "적용 시작일",
  effective_to: "적용 종료일",
  leave_type: "휴가 유형",
  start_date: "시작일",
  end_date: "종료일",
  reason: "사유",
  working_days: "근무 요일",
  check_in_time: "출근 기준 시각",
  check_out_time: "퇴근 기준 시각",
  id: "대상",
  version: "데이터 버전",
  business_registration_number: "사업자등록번호",
  representative_name: "대표자명",
  address: "주소",
  business_type: "업태",
  business_item: "종목",
  billing_contact_name: "세금계산서 담당자",
  billing_email: "세금계산서 수신 이메일",
  issue_date: "작성일자",
  supply_date: "공급일자",
  purpose: "영수 청구 구분",
  recipient_name: "수신 담당자",
  recipient_email: "수신 이메일",
  issue_channel: "발급 채널",
  nts_approval_number: "국세청 승인번호",
  amount: "금액",
  title: "제목",
  due_date: "입금기한",
  billing_date: "청구일",
};

function issueField(issue: ZodIssue) {
  const parts = issue.path.filter((part) => part !== "payload");
  const last = [...parts].reverse().find((part) => typeof part === "string");
  const field = parts.join(".") || "input";
  const baseLabel = typeof last === "string" ? fieldLabels[last] ?? last : "입력값";
  const itemIndex = parts.findIndex((part) => part === "items");
  const row = itemIndex >= 0 && typeof parts[itemIndex + 1] === "number" ? Number(parts[itemIndex + 1]) + 1 : null;
  return { field, label: row ? `${row}번 품목 ${baseLabel}` : baseLabel };
}

function issueMessage(issue: ZodIssue, label: string) {
  if (issue.code === "custom" && issue.message !== "Invalid input") return issue.message;
  if (issue.code === "invalid_type") return `${label}의 값 또는 형식을 확인해 주세요.`;
  if (issue.code === "too_small") return `${label}이(가) 비어 있거나 허용된 최소값보다 작습니다.`;
  if (issue.code === "too_big") return `${label}이(가) 허용된 최대값을 초과했습니다.`;
  if (issue.code === "invalid_format") {
    const format = "format" in issue ? issue.format : undefined;
    if (format === "email") return `${label}을(를) 올바른 이메일 형식으로 입력해 주세요.`;
    if (format === "uuid") return `${label} 선택값이 올바르지 않습니다. 화면을 새로고침해 다시 선택해 주세요.`;
    if (format === "date") return `${label}을(를) YYYY-MM-DD 형식으로 입력해 주세요.`;
  }
  if (issue.code === "invalid_value") return `${label}에서 허용된 값을 선택해 주세요.`;
  return `${label}을(를) 확인해 주세요.`;
}

function validationError(error: ZodError) {
  const fieldErrors = error.issues.map((issue) => {
    const { field, label } = issueField(issue);
    return { field, label, message: issueMessage(issue, label) };
  });
  return new AppError("ValidationError", "입력한 항목을 다시 확인해 주세요.", { fieldErrors });
}

export function failure(error: unknown, requestId: string) {
  const appError =
    error instanceof AppError
      ? error
      : error instanceof ZodError || error instanceof SyntaxError
        ? error instanceof ZodError
          ? validationError(error)
          : new AppError("ValidationError", "요청 데이터 형식이 올바르지 않습니다.")
        : new AppError("InternalError");
  const message = appError.message === appError.code ? messages[appError.code] : appError.message;
  const log = { requestId, code: appError.code, fields: appError.details?.fieldErrors?.map((item) => item.field) };
  if (appError.code === "InternalError") console.error(JSON.stringify(log));
  else console.warn(JSON.stringify(log));
  return NextResponse.json(
    { error: { code: appError.code, message, requestId, details: appError.details } },
    { status: errorStatus[appError.code], headers: { "Cache-Control": "no-store" } },
  );
}
export async function readMutation(request: Request) {
  assertMutationOrigin(request);
  return readExternalJson(request, 32768);
}

export async function readFormMutation(request: Request) {
  assertMutationOrigin(request);
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded"))
    throw new AppError("ValidationError");
  return Object.fromEntries(new URLSearchParams((await readExternalBody(request, 32768)).toString()));
}

export function assertMutationOrigin(request: Request) {
  const env = environment();
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set(
    [new URL(request.url).origin, env.APP_URL, ...(env.APP_ALLOWED_ORIGINS?.split(",") ?? [])]
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => new URL(value).origin),
  );
  if (!origin || !allowedOrigins.has(origin)) {
    throw new AppError(
      "Forbidden",
      origin
        ? `현재 접속 주소(${origin})에서 요청을 처리할 수 없습니다.`
        : "요청 출처를 확인할 수 없어 처리할 수 없습니다.",
      {
        hint: origin
          ? `서버의 APP_ALLOWED_ORIGINS에 ${origin}을(를) 등록한 뒤 개발 서버를 다시 시작해 주세요.`
          : "브라우저에서 현재 서버 주소로 다시 접속한 뒤 시도해 주세요.",
      },
    );
  }
}

export async function readExternalJson(request: Request, maxBytes: number) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new AppError("ValidationError");
  return JSON.parse((await readExternalBody(request, maxBytes)).toString("utf8")) as unknown;
}

async function readExternalBody(request: Request, maxBytes: number) {
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
  return Buffer.concat(chunks);
}
