import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthApiError } from "@supabase/supabase-js";
import { authenticate } from "@/modules/authentication/application/service";
import { POST } from "@/app/api/auth/route";

const auth = vi.hoisted(() => ({ signUp: vi.fn(), signInWithPassword: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/shared/infrastructure/supabase/server", () => ({
  serverClient: async () => ({ auth }),
}));

const origin = "http://192.168.1.109:3200";
const input = {
  action: "signup",
  name: "가입 테스트",
  email: "signup-test@digitalsquare.local",
  password: "Example-Test-Password-123!",
};

function signupRequest(body: unknown = input) {
  return new Request(`${origin}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_URL", origin);
  vi.stubEnv("APP_ALLOWED_ORIGINS", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("signup authentication", () => {
  it("keeps email confirmation guidance when Auth does not issue a session", async () => {
    const response = await POST(signupRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).data.message).toContain("이메일 확인");
    expect(auth.signUp).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
      options: { data: { name: input.name }, emailRedirectTo: `${origin}/auth/confirm` },
    });
  });

  it("takes an automatically confirmed signup to the account status page", async () => {
    auth.signUp.mockResolvedValue({ data: { session: { access_token: "test-session" } }, error: null });
    const response = await POST(signupRequest());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      message: "가입 요청을 접수했습니다. 관리자 승인을 기다려 주세요.",
      redirect: "/account-status",
    });
    expect(JSON.stringify(body)).not.toContain("test-session");
  });

  it("reports an Auth server failure as HTTP 500 and correlates safe diagnostics", async () => {
    const privateError = "dial tcp: lookup smtp-private.internal failed; password=private-smtp-password";
    auth.signUp.mockResolvedValue({ error: new AuthApiError(privateError, 500, "unexpected_failure") });
    const response = await POST(signupRequest());
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error.code).toBe("InternalError");
    expect(body.error.message).toContain("서버");
    expect(body.error.details.hint).toContain("SMTP");
    const log = vi.mocked(console.error).mock.calls.map(([entry]) => JSON.parse(String(entry)));
    expect(log).toContainEqual({
      event: "auth.signup.failed",
      requestId: body.error.requestId,
      authCode: "unexpected_failure",
      authStatus: 500,
    });
    const visible = JSON.stringify({ body, log });
    for (const secret of [privateError, "private-smtp-password", input.email, input.password])
      expect(visible).not.toContain(secret);
  });

  it.each([
    ["over_email_send_rate_limit", 429, "TooManyRequests", 429],
    ["signup_disabled", 403, "Forbidden", 403],
    ["email_provider_disabled", 403, "Forbidden", 403],
    ["weak_password", 422, "ValidationError", 400],
    ["email_address_invalid", 422, "ValidationError", 400],
    ["user_already_exists", 422, "Conflict", 409],
    ["email_address_not_authorized", 403, "InternalError", 500],
  ])("classifies %s without exposing the provider message", async (code, status, expectedCode, expectedStatus) => {
    auth.signUp.mockResolvedValue({ error: new AuthApiError("private provider error", status, code) });
    const response = await POST(signupRequest());
    const body = await response.json();
    expect(response.status).toBe(expectedStatus);
    expect(body.error.code).toBe(expectedCode);
    expect(JSON.stringify(body)).not.toContain("private provider error");
  });

  it("rejects invalid input before calling Auth", async () => {
    const response = await POST(signupRequest({ ...input, password: "short" }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.details.fieldErrors[0].field).toBe("password");
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("explains that a repeated signup should use login and administrator approval", async () => {
    auth.signUp.mockResolvedValue({ error: new AuthApiError("User already registered", 422, "user_already_exists") });
    const response = await POST(signupRequest());
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.error.message).toBe("이미 가입된 이메일입니다. 로그인해 주세요.");
    expect(body.error.details.hint).toContain("가입 승인");
  });

  it("still blocks login for unconfirmed email accounts", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: new AuthApiError("Email not confirmed", 400, "email_not_confirmed") });
    await expect(authenticate({ action: "login", email: input.email, password: input.password }, "login-test"))
      .rejects.toMatchObject({ code: "EmailNotConfirmed" });
  });
});
