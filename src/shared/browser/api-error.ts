type ApiErrorPayload = {
  error?: {
    message?: string;
    requestId?: string;
    details?: {
      fieldErrors?: Array<{ label?: string; message?: string }>;
      hint?: string;
    };
  };
};

export function apiErrorMessage(result: ApiErrorPayload, fallback: string, status: number | string) {
  const lines = [result.error?.message ?? fallback];
  const fieldMessages = result.error?.details?.fieldErrors
    ?.map((item) => item.message ?? (item.label ? `${item.label}을(를) 확인해 주세요.` : null))
    .filter((value): value is string => Boolean(value));
  if (fieldMessages?.length) lines.push(...new Set(fieldMessages));
  if (result.error?.details?.hint) lines.push(`해결 방법: ${result.error.details.hint}`);
  lines.push(`요청 ID: ${result.error?.requestId ?? status}`);
  return lines.join("\n");
}
