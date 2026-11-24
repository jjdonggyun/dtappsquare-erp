import { NextResponse } from "next/server";
import { currentAccount } from "@/shared/auth/account";
import { failure, readMutation } from "@/shared/infrastructure/http";
import { executeFinanceCommand } from "@/modules/finance/application/commands";
import { financeCommandRepository } from "@/modules/finance/infrastructure/repository";

export async function POST(request: Request) {
  const requestId = request.headers.get("X-Idempotency-Key") ?? crypto.randomUUID();
  try {
    const [account, input] = await Promise.all([currentAccount(), readMutation(request)]);
    const data = await executeFinanceCommand(account, input, financeCommandRepository(), requestId);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, requestId);
  }
}
