import { NextResponse } from "next/server";
import { currentAccount } from "@/shared/auth/account";
import { executeProjectResourceCommand } from "@/server/project-resource";
import { projectResourceRepository } from "@/shared/infrastructure/project-resource-repository";
import { failure, readMutation } from "@/shared/infrastructure/http";
import { scheduleEmailDispatch } from "@/modules/notification/infrastructure/schedule-email-dispatch";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const [account, input] = await Promise.all([currentAccount(), readMutation(request)]);
    const data = await executeProjectResourceCommand(
      account,
      input,
      projectResourceRepository(),
      requestId,
    );
    scheduleEmailDispatch(requestId);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, requestId);
  }
}
