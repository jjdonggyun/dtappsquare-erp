import { NextResponse } from "next/server";
import { currentAccount } from "@/shared/auth/account";
import { failure, readMutation } from "@/shared/infrastructure/http";
import { executeProjectHubCommand } from "@/modules/project-hub/application/commands";
import { projectHubCommandRepository } from "@/modules/project-hub/infrastructure/repository";

export async function POST(request: Request) {
  const requestId = request.headers.get("X-Idempotency-Key") ?? crypto.randomUUID();
  try {
    const [account, input] = await Promise.all([currentAccount(), readMutation(request)]);
    const data = await executeProjectHubCommand(account, input, projectHubCommandRepository(), requestId);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, requestId);
  }
}
