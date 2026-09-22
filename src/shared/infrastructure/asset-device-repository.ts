import "server-only";
import type { AssetDeviceRepository } from "@/server/asset-device";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";

export function assetDeviceRepository(): AssetDeviceRepository {
  return {
    async execute(command, requestId, deviceToken) {
      const client = await serverClient();
      const payload = command.action === "device.register"
        ? { ...command.payload, device_token: deviceToken }
        : command.payload;
      const { data, error } = await client.rpc("asset_device_command", {
        p_action: command.action,
        p_payload: payload,
        p_request_id: requestId,
      });
      if (error) throw databaseError(error);
      return data;
    },
  };
}
