import "server-only";
import { serverClient } from "./supabase/server";
import { databaseError } from "@/shared/domain/errors";
import type { WorkforceRepository } from "@/server/workforce";

export function workforceRepository(): WorkforceRepository {
  return {
    async execute(command, requestId) {
      const client = await serverClient();
      const functionName =
        command.action.startsWith("attendance.") && command.action !== "attendance.correct"
          ? "attendance_command"
          : "workforce_command";
      const { data, error } = await client.rpc(functionName, {
        p_action: command.action,
        p_payload: command.payload,
        p_request_id: requestId,
      });
      if (error) throw databaseError(error);
      return data;
    },
  };
}
