import { NextResponse } from "next/server";
import { currentAccount } from "@/shared/auth/account";
import { failure, readMutation } from "@/shared/infrastructure/http";
import { executeContractCommand } from "@/modules/contract/application/commands";
import { contractCommandRepository } from "@/modules/contract/infrastructure/repository";

export async function POST(request: Request) {
  const requestId = request.headers.get("X-Idempotency-Key") ?? crypto.randomUUID();
  try {
    const [account, input] = await Promise.all([currentAccount(), readMutation(request)]);
    const data = await executeContractCommand(
      account,
      input,
      contractCommandRepository(),
      requestId,
    );
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, requestId);
  }
}

