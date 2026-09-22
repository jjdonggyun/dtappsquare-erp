import "server-only";
import { serverClient } from "./supabase/server";
import { databaseError } from "@/shared/domain/errors";
import type { LeaveApprovalRepository } from "@/server/leave-approval";

export function leaveApprovalRepository(): LeaveApprovalRepository {
  return {
    async execute(command, requestId) {
      const client = await serverClient();
      const { data, error } = await client.rpc("leave_approval_command", {
        p_action: command.action,
        p_payload: command.payload,
        p_request_id: requestId,
      });
      if (error) throw databaseError(error);
      return data;
    },
  };
}
