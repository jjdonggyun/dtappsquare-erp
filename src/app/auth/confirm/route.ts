import { NextResponse } from "next/server";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { environment } from "@/shared/infrastructure/env";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const client = await serverClient();
  const code = params.get("code");
  const token = params.get("token_hash");
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/account-status", environment().APP_URL));
  }
  if (token && params.get("type") === "email") {
    const { error } = await client.auth.verifyOtp({ token_hash: token, type: "email" });
    if (!error) return NextResponse.redirect(new URL("/account-status", environment().APP_URL));
  }
  return NextResponse.redirect(new URL("/login?confirmation=failed", environment().APP_URL));
}
