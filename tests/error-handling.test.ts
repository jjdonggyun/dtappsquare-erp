import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError, databaseError } from "../src/shared/domain/errors";
import { assertMutationOrigin, failure } from "../src/shared/infrastructure/http";

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
});
