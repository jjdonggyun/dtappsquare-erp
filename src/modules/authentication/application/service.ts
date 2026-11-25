import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { environment } from "@/shared/infrastructure/env";
import { AppError } from "@/shared/domain/errors";
import type { AuthError } from "@supabase/supabase-js";
const inputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("login"),
      email: z.email().max(254),
      password: z.string().min(1).max(128),
    })
    .strict(),
  z
    .object({
      action: z.literal("signup"),
      email: z.email().max(254),
      password: z.string().min(12).max(128),
      name: z.string().trim().min(1).max(80),
    })
    .strict(),
  z.object({ action: z.literal("signout") }).strict(),
  z
    .object({
      action: z.literal("password.change"),
      password: z.string().min(12).max(128),
      password_confirmation: z.string().min(12).max(128),
    })
    .strict(),
]);
function signupError(error: AuthError) {
  if (error.status === 429)
    return new AppError("TooManyRequests", "가입 요청 또는 확인 메일 발송 횟수를 초과했습니다.", {
      hint: "잠시 후 다시 시도해 주세요. 계속되면 관리자에게 문의해 주세요.",
    });
  if (["signup_disabled", "email_provider_disabled"].includes(error.code ?? ""))
    return new AppError("Forbidden", "현재 서버에서 이메일 가입을 받지 않고 있습니다.", {
      hint: "관리자에게 가입 허용 설정을 확인해 달라고 요청해 주세요.",
    });
  if (error.code === "weak_password")
    return new AppError("ValidationError", "비밀번호가 서버의 보안 기준을 충족하지 않습니다.", {
      fieldErrors: [{ field: "password", label: "비밀번호", message: "12자 이상이며 대문자·소문자·숫자·특수문자를 포함한 비밀번호를 사용해 주세요." }],
    });
  if (error.code === "email_address_invalid")
    return new AppError("ValidationError", "가입에 사용할 수 있는 이메일 주소를 입력해 주세요.", {
      fieldErrors: [{ field: "email", label: "이메일", message: "실제로 메일을 받을 수 있는 회사 이메일을 입력해 주세요." }],
    });
  if (["user_already_exists", "email_exists"].includes(error.code ?? ""))
    return new AppError("Conflict", "이미 가입된 이메일입니다. 로그인해 주세요.", {
      hint: "승인 대기 계정은 관리자에게 가입 승인을 요청해 주세요. 비밀번호를 모르면 관리자에게 초기화를 요청해 주세요.",
    });
  return new AppError("InternalError", "서버에서 가입 요청을 처리하지 못했습니다.", {
    hint: "관리자에게 요청 ID를 전달해 주세요. 관리자는 Supabase Auth 로그와 가입 확인 메일(SMTP) 설정을 확인해야 합니다.",
  });
}

export async function authenticate(input: unknown, requestId: string) {
  const parsed = inputSchema.parse(input);
  const client = await serverClient();
  if (parsed.action === "signout") {
    const { error } = await client.auth.signOut();
    if (error) throw new AppError("InternalError");
    return { redirect: "/login" };
  }
  if (parsed.action === "password.change") {
    if (parsed.password !== parsed.password_confirmation) throw new AppError("ValidationError");
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) throw new AppError("Unauthorized");
    const { error } = await client.auth.updateUser({ password: parsed.password });
    if (error) throw new AppError("ValidationError");
    return { message: "비밀번호를 변경했습니다." };
  }
  if (parsed.action === "login") {
    const { error } = await client.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });
    if (error?.code === "email_not_confirmed") throw new AppError("EmailNotConfirmed");
    if (error) throw new AppError("Unauthorized");
    return { redirect: "/dashboard" };
  }
  const { data, error } = await client.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: {
      data: { name: parsed.name },
      emailRedirectTo: `${environment().APP_URL}/auth/confirm`,
    },
  });
  if (error) {
    console.error(JSON.stringify({
      event: "auth.signup.failed",
      requestId,
      authCode: error.code ?? "unknown",
      authStatus: error.status,
    }));
    throw signupError(error);
  }
  if (data.session)
    return { message: "가입 요청을 접수했습니다. 관리자 승인을 기다려 주세요.", redirect: "/account-status" };
  return { message: "가입 요청을 접수했습니다. 이메일 확인 후 관리자 승인을 기다려 주세요." };
}
