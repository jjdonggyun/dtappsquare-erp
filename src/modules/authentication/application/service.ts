import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { environment } from "@/shared/infrastructure/env";
import { AppError } from "@/shared/domain/errors";
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
]);
export async function authenticate(input: unknown) {
  const parsed = inputSchema.parse(input);
  const client = await serverClient();
  if (parsed.action === "signout") {
    const { error } = await client.auth.signOut();
    if (error) throw new AppError("InternalError");
    return { redirect: "/login" };
  }
  if (parsed.action === "login") {
    const { error } = await client.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });
    if (error) throw new AppError("Unauthorized");
    return { redirect: "/dashboard" };
  }
  const { error } = await client.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: {
      data: { name: parsed.name },
      emailRedirectTo: `${environment().APP_URL}/auth/confirm`,
    },
  });
  if (error) throw new AppError("ValidationError");
  return { message: "가입 요청을 접수했습니다. 이메일 확인 후 관리자 승인을 기다려 주세요." };
}
