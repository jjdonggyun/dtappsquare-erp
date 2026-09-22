import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { dispatchPendingEmails } from "@/modules/notification/application/dispatcher";
import { AppError } from "@/shared/domain/errors";
import { failure } from "@/shared/infrastructure/http";

function authorized(request: Request) {
  const configured = process.env.EMAIL_DISPATCH_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || configured.length < 32 || !supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const id = crypto.randomUUID();
  try {
    if (!authorized(request)) throw new AppError("Unauthorized");
    const data = await dispatchPendingEmails();
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, id);
  }
}
