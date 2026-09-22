import { NextResponse } from "next/server";
import { currentAccount } from "@/shared/auth/account";
import { executeCommand } from "@/server/management";
import { managementRepository } from "@/shared/infrastructure/management-repository";
import { failure, readMutation } from "@/shared/infrastructure/http";
import { scheduleEmailDispatch } from "@/modules/notification/infrastructure/schedule-email-dispatch";
export async function POST(request: Request) {
  const id = crypto.randomUUID();
  try {
    const account = await currentAccount();
    const input = await readMutation(request);
    const data = await executeCommand(account, input, managementRepository(), id);
    scheduleEmailDispatch(id);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, id);
  }
}
