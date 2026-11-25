import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError, databaseError } from "../src/shared/domain/errors";
import { assertMutationOrigin, failure } from "../src/shared/infrastructure/http";
import { apiErrorMessage } from "../src/shared/browser/api-error";
import { createLeaveCommand } from "../src/modules/leave/domain/contracts";

vi.mock("server-only", () => ({}));

function stubEnvironment() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("APP_ALLOWED_ORIGINS", "");
}

afterEach(() => vi.unstubAllEnvs());

describe("API error handling", () => {
  it("accepts a mutation from the same origin used to reach the server", () => {
    stubEnvironment();
    expect(() =>
      assertMutationOrigin(
        new Request("http://172.25.128.1:3000/api/auth", {
          headers: { origin: "http://172.25.128.1:3000" },
        }),
      ),
    ).not.toThrow();
  });

  it("explains how to register a blocked mutation origin", () => {
    stubEnvironment();
    expect(() =>
      assertMutationOrigin(
        new Request("http://localhost:3000/api/auth", {
          headers: { origin: "http://untrusted.example:3000" },
        }),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "Forbidden",
        message: expect.stringContaining("http://untrusted.example:3000"),
        details: expect.objectContaining({ hint: expect.stringContaining("APP_ALLOWED_ORIGINS") }),
      }),
    );
  });

  it("returns field-level Zod validation errors without exposing input values", async () => {
    const schema = z.object({ payload: z.object({ recipient_email: z.email(), issue_date: z.iso.date() }) });
    let error: unknown;
    try {
      schema.parse({ payload: { recipient_email: "invalid", issue_date: "not-a-date" } });
    } catch (reason) {
      error = reason;
    }
    const response = failure(error, "request-zod");
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.requestId).toBe("request-zod");
    expect(body.error.details.fieldErrors).toEqual([
      expect.objectContaining({ field: "recipient_email", label: "수신 이메일" }),
      expect.objectContaining({ field: "issue_date", label: "작성일자" }),
    ]);
    expect(JSON.stringify(body)).not.toContain("invalid");
  });

  it("returns a safe actionable application error", async () => {
    const response = failure(new AppError("ValidationError", "고객사의 세금계산서 필수정보가 부족합니다.", {
      fieldErrors: [{ field: "customer.billing_email", label: "세금계산서 수신 이메일", message: "고객사의 세금계산서 수신 이메일을 입력해 주세요." }],
      hint: "고객사 상세에서 저장한 뒤 다시 생성해 주세요.",
    }), "request-tax");
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "ValidationError", requestId: "request-tax", details: { hint: "고객사 상세에서 저장한 뒤 다시 생성해 주세요." } });
  });

  it("maps common database constraint errors to helpful messages", () => {
    expect(databaseError({ code: "23505" }).message).toContain("중복");
    expect(databaseError({ code: "23503" }).details?.hint).toContain("선택한");
    expect(databaseError({ code: "23502", message: 'null value in column "billing_email" violates not-null constraint' }).details?.fieldErrors?.[0]?.label).toBe("세금계산서 수신 이메일");
  });

  it("explains how to assign a work policy instead of reporting a missing target", async () => {
    const response = failure(databaseError({ code: "P0002", message: "work policy not assigned" }), "request-policy");
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.error.code).toBe("SetupRequired");
    expect(body.error.message).toBe("선택한 날짜에 적용되는 근무정책이 배정되지 않았습니다.");
    const displayed = apiErrorMessage(body, "실패", response.status);
    expect(displayed).toContain("해결 방법:");
    expect(displayed).toContain("직원 정책 배정");
    expect(displayed).toContain("적용 기간");
    expect(displayed).toContain("요청 ID: request-policy");
    expect(displayed).not.toContain("work policy not assigned");
  });

  it.each([
    ["P0002", "business role required", "직원관리", 409],
    ["P0002", "business role required for leave approval", "직원관리", 409],
    ["P0002", "Head approval route unavailable", "Head", 409],
    ["P0002", "final approval route unavailable", "최종 승인", 409],
    ["P0002", "team and final approval route unavailable", "조직관리", 409],
    ["P0002", "legacy approval route unavailable", "휴가 승인", 409],
    ["P0002", "approval route unavailable", "신청자 본인", 409],
    ["P0002", "employee or policy not found", "근무정책", 400],
    ["40001", "insufficient leave balance", "휴가관리", 409],
    ["22023", "leave has no working day", "근무 요일", 400],
    ["22023", "half day must be one day", "같은 날짜", 400],
    ["22023", "invalid date range", "시작일", 400],
    ["40001", "check-in is required", "내 근태", 409],
    ["40001", "assigned policy schedules are immutable", "새 정책 버전", 409],
    ["22023", "Card is not assigned to this project on transaction date", "배정 기간", 409],
    ["22023", "No recipients configured", "수신 이메일", 409],
    ["40001", "Automatic email disabled", "자동 발송", 409],
    ["40001", "Excel is required", "Excel 미리 생성", 409],
    ["40001", "Settlement snapshot is stale; regenerate Excel before closing", "다시 집계", 409],
    ["40001", "Project is closed. Use the reopen command first.", "재개방", 409],
    ["40001", "Project is closed. Reopen it before changing work or finance data.", "재개방", 409],
    ["40001", "allocation exceeds configured limit", "리소스 계획", 409],
    ["42501", "Network verification failed", "출퇴근 검증", 403],
    ["42501", "Network verification expired", "다시 확인", 403],
    ["42501", "Device verification failed", "Device Agent", 403],
    ["42501", "Device verification expired", "다시 확인", 403],
    ["42501", "Remote approval required", "예외 승인", 403],
    ["42501", "Remote approval expired", "예외 승인", 403],
    ["42501", "Attendance verification required", "다시 확인", 403],
    ["42501", "Attendance verification failed", "다시 확인", 403],
    ["42501", "Attendance verification already consumed", "다시 확인", 403],
    ["22023", "Inactive card", "법인카드 관리", 409],
    ["22023", "rejection reason required", "2자 이상", 400],
    ["22023", "Rejection reason is required", "2자 이상", 400],
  ])("provides an actionable response for %s / %s", async (code, message, action, status) => {
    const response = failure(databaseError({ code, message }), "request-action");
    const body = await response.json();
    expect(response.status).toBe(status);
    expect(body.error.message).not.toBe(message);
    expect(body.error.details.hint).toContain(action);
    const displayed = apiErrorMessage(body, "실패", status);
    expect(displayed).toContain(action);
    expect(displayed).toContain("요청 ID: request-action");
  });

  it("preserves application validation instructions for an invalid leave date range", async () => {
    const parsed = createLeaveCommand.safeParse({
      action: "leave.create",
      payload: { leave_type: "ANNUAL", start_date: "2026-11-26", end_date: "2026-11-25", reason: "휴가 신청" },
    });
    if (parsed.success) throw new Error("Expected invalid date range");
    const response = failure(parsed.error, "request-leave-dates");
    const body = await response.json();
    expect(body.error.details.fieldErrors).toContainEqual({
      field: "end_date", label: "종료일", message: "종료일은 시작일보다 빠를 수 없습니다.",
    });
  });

  it("keeps unknown database details private and does not guess a setup problem", async () => {
    const response = failure(databaseError({ code: "P0002", message: "private table employee_secret was not found" }), "request-private");
    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NotFound");
    expect(body.error.message).toContain("다시 선택");
    expect(JSON.stringify(body)).not.toContain("employee_secret");
    expect(databaseError({ code: "42501", message: "work policy not assigned" }).code).toBe("Forbidden");
    expect(databaseError({ code: "XX000", message: "work policy not assigned" }).code).toBe("InternalError");
  });
});
