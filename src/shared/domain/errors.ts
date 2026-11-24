export type ErrorCode =
  | "Unauthorized"
  | "EmailNotConfirmed"
  | "Forbidden"
  | "ValidationError"
  | "NotFound"
  | "Conflict"
  | "InternalError";

export type FieldValidationError = {
  field: string;
  label: string;
  message: string;
};

export type ErrorDetails = {
  fieldErrors?: FieldValidationError[];
  hint?: string;
};

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
    public details?: ErrorDetails,
  ) {
    super(message ?? code);
  }
}
export const errorStatus: Record<ErrorCode, number> = {
  Unauthorized: 401,
  EmailNotConfirmed: 403,
  Forbidden: 403,
  ValidationError: 400,
  NotFound: 404,
  Conflict: 409,
  InternalError: 500,
};

const databaseFieldLabels: Record<string, string> = {
  business_registration_number: "사업자등록번호",
  representative_name: "대표자명",
  address: "주소",
  business_type: "업태",
  business_item: "종목",
  billing_contact_name: "세금계산서 담당자",
  billing_email: "세금계산서 수신 이메일",
  recipient_email: "수신 이메일",
  nts_approval_number: "국세청 승인번호",
};

function databaseField(error: { message?: string; details?: string | null }) {
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  return text.match(/column ["']([^"']+)["']/i)?.[1];
}

export function databaseError(error: {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}): AppError {
  const code = error.code ?? "";
  if (code === "28000") return new AppError("Unauthorized");
  if (code === "42501") return new AppError("Forbidden");
  if (code === "P0002") return new AppError("NotFound");
  if (code === "23505")
    return new AppError("Conflict", "이미 등록된 값과 중복됩니다.", {
      hint: "중복될 수 있는 코드, 이메일, 사업자등록번호 또는 문서번호를 확인해 주세요.",
    });
  if (["40001", "40P01"].includes(code)) return new AppError("Conflict");
  if (code === "23503")
    return new AppError("ValidationError", "연결한 대상을 찾을 수 없거나 사용할 수 없는 상태입니다.", {
      hint: "선택한 직원, 고객사, 계약, 프로젝트 또는 문서가 삭제되거나 비활성화되지 않았는지 확인해 주세요.",
    });
  if (code === "23502") {
    const field = databaseField(error);
    const label = field ? databaseFieldLabels[field] ?? field : "필수 입력값";
    return new AppError("ValidationError", `${label}을(를) 입력해 주세요.`, {
      fieldErrors: field ? [{ field, label, message: `${label}은(는) 필수입니다.` }] : undefined,
    });
  }
  if (code === "23514")
    return new AppError("ValidationError", "허용 범위를 벗어난 값이 있습니다.", {
      hint: "금액, 날짜 순서, 상태, 길이 제한을 확인해 주세요.",
    });
  if (code.startsWith("22"))
    return new AppError("ValidationError", "입력 형식이나 현재 업무 조건을 확인해 주세요.", {
      hint: "날짜, 숫자, 필수 선택값과 대상의 현재 상태를 다시 확인해 주세요.",
    });
  return new AppError("InternalError");
}
