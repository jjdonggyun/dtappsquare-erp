import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Account } from "@/modules/users/domain/contracts";
import { authorize } from "@/modules/rbac/domain/policy";
import { assetCommands } from "@/modules/asset/domain/contracts";
import { deviceCommands } from "@/modules/device/domain/contracts";

export const assetDeviceCommandSchema = z.discriminatedUnion("action", [
  ...assetCommands,
  ...deviceCommands,
]);
export type AssetDeviceCommand = z.infer<typeof assetDeviceCommandSchema>;

const permissions: Record<AssetDeviceCommand["action"], string> = {
  "asset.save": "ASSET_WRITE",
  "asset.assign": "ASSET_WRITE",
  "asset.return": "ASSET_WRITE",
  "device.register": "DEVICE_MANAGE",
  "device.status": "DEVICE_MANAGE",
};

export interface AssetDeviceRepository {
  execute(command: AssetDeviceCommand, requestId: string, deviceToken?: string): Promise<unknown>;
}

export async function executeAssetDeviceCommand(
  account: Account | null,
  input: unknown,
  repository: AssetDeviceRepository,
  requestId: string,
) {
  authorize(account);
  const command = assetDeviceCommandSchema.parse(input);
  authorize(account, permissions[command.action]);
  const deviceToken = command.action === "device.register" ? randomBytes(32).toString("base64url") : undefined;
  const result = await repository.execute(command, requestId, deviceToken);
  return command.action === "device.register" && result && typeof result === "object"
    ? { ...result, device_token: deviceToken }
    : result;
}
