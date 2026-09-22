import { NextResponse } from "next/server";
import { currentAccount } from "@/shared/auth/account";
import { executeWorkforceCommand } from "@/server/workforce";
import { workforceRepository } from "@/shared/infrastructure/workforce-repository";
import { failure, readMutation } from "@/shared/infrastructure/http";

export async function POST(request: Request) {
  const id = crypto.randomUUID();
  try {
    const input = await readMutation(request);
    const data = await executeWorkforceCommand(
      await currentAccount(),
      input,
      workforceRepository(),
      id,
    );
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, id);
  }
}
