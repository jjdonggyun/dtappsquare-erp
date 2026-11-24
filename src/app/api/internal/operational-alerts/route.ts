import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runOperationalAlerts } from "@/modules/reporting/application/operational-alerts";
import { scheduleEmailDispatch } from "@/modules/notification/infrastructure/schedule-email-dispatch";
import { AppError } from "@/shared/domain/errors";
import { failure } from "@/shared/infrastructure/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || secret.length < 32 || !supplied) return false;
  const left = Buffer.from(secret);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    if (!authorized(request)) throw new AppError("Unauthorized");
    const rawDate = new URL(request.url).searchParams.get("date");
    const runDate = rawDate ? z.iso.date().parse(rawDate) : undefined;
    const data = await runOperationalAlerts(runDate);
    if (data.notificationCount > 0) scheduleEmailDispatch(requestId);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, requestId);
  }
}
