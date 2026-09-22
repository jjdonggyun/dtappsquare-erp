import { z } from "zod";
import { authorize } from "@/modules/rbac/domain/policy";
import type { Account } from "@/modules/users/domain/contracts";
import {
  balanceAdjustmentCommand,
  cancelLeaveCommand,
  createLeaveCommand,
  submitLeaveCommand,
} from "@/modules/leave/domain/contracts";
import { decideApprovalCommand } from "@/modules/approval/domain/contracts";
import { readNotificationCommand } from "@/modules/notification/domain/contracts";

export const leaveApprovalCommandSchema = z.discriminatedUnion("action", [
  createLeaveCommand,
  submitLeaveCommand,
  cancelLeaveCommand,
  balanceAdjustmentCommand,
  decideApprovalCommand,
  readNotificationCommand,
]);
export type LeaveApprovalCommand = z.infer<typeof leaveApprovalCommandSchema>;

const permissions: Record<LeaveApprovalCommand["action"], string> = {
  "leave.create": "LEAVE_REQUEST",
  "leave.submit": "LEAVE_REQUEST",
  "leave.cancel": "LEAVE_REQUEST",
  "leave.balance.adjust": "LEAVE_MANAGE",
  "approval.decide": "LEAVE_APPROVE",
  "notification.read": "NOTIFICATION_READ_SELF",
};

export interface LeaveApprovalRepository {
  execute(command: LeaveApprovalCommand, requestId: string): Promise<unknown>;
}

export async function executeLeaveApprovalCommand(
  account: Account | null,
  input: unknown,
  repository: LeaveApprovalRepository,
  requestId: string,
) {
  authorize(account);
  const command = leaveApprovalCommandSchema.parse(input);
  authorize(account, permissions[command.action]);
  return repository.execute(command, requestId);
}
