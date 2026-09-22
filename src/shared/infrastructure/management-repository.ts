import "server-only";
import { serverClient } from "./supabase/server";
import { databaseError } from "@/shared/domain/errors";
import type { ManagementRepository } from "@/server/management";
export function managementRepository(): ManagementRepository {
  return {
    async execute(command, requestId) {
      const client = await serverClient();
      const { data, error } = await client.rpc("management_command", {
        p_action: command.action,
        p_payload: command.payload,
        p_request_id: requestId,
      });
      if (error) throw databaseError(error);
      return data;
    },
  };
}
