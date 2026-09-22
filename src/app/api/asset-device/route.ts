import { NextResponse } from "next/server";
import { currentAccount } from "@/shared/auth/account";
import { executeAssetDeviceCommand } from "@/server/asset-device";
import { assetDeviceRepository } from "@/shared/infrastructure/asset-device-repository";
import { failure, readMutation } from "@/shared/infrastructure/http";
import { scheduleEmailDispatch } from "@/modules/notification/infrastructure/schedule-email-dispatch";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const [account, input] = await Promise.all([currentAccount(), readMutation(request)]);
    const data = await executeAssetDeviceCommand(
      account,
      input,
      assetDeviceRepository(),
      requestId,
    );
    scheduleEmailDispatch(requestId);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, requestId);
  }
}
