import { NextResponse } from "next/server";
import { currentAccount } from "@/shared/auth/account";
import { executeLeaveApprovalCommand } from "@/server/leave-approval";
import { leaveApprovalRepository } from "@/shared/infrastructure/leave-approval-repository";
import { failure, readMutation } from "@/shared/infrastructure/http";
import { scheduleEmailDispatch } from "@/modules/notification/infrastructure/schedule-email-dispatch";

export async function POST(request: Request) {
  const id = crypto.randomUUID();
  try {
    const data = await executeLeaveApprovalCommand(
      await currentAccount(),
      await readMutation(request),
      leaveApprovalRepository(),
      id,
    );
    scheduleEmailDispatch(id);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, id);
  }
}
