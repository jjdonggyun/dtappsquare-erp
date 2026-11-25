import { NextResponse } from "next/server";
import { authenticate } from "@/modules/authentication/application/service";
import { AppError } from "@/shared/domain/errors";
import { environment } from "@/shared/infrastructure/env";
import { failure, readFormMutation, readMutation } from "@/shared/infrastructure/http";
export async function POST(request: Request) {
  const id = crypto.randomUUID();
  const formRequest = request.headers
    .get("content-type")
    ?.startsWith("application/x-www-form-urlencoded");
  let action: unknown;
  try {
    const input = formRequest ? await readFormMutation(request) : await readMutation(request);
    action = typeof input === "object" && input !== null ? Reflect.get(input, "action") : undefined;
    const data = await authenticate(input, id);
    if (formRequest) {
      const destination =
        data.redirect ?? (action === "signup" ? "/signup?submitted=1" : "/login");
      return NextResponse.redirect(
        new URL(destination, request.headers.get("origin") ?? environment().APP_URL),
        303,
      );
    }
    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (formRequest && !(error instanceof AppError && ["Forbidden", "InternalError"].includes(error.code))) {
      const destination =
        action === "signup"
          ? "/signup?error=invalid"
          : error instanceof AppError && error.code === "EmailNotConfirmed"
            ? "/login?error=email-unconfirmed"
            : "/login?error=invalid";
      return NextResponse.redirect(
        new URL(destination, request.headers.get("origin") ?? environment().APP_URL),
        303,
      );
    }
    return failure(error, id);
  }
}
