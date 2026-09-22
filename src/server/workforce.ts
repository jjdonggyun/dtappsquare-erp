import { z } from "zod";
import { authorize } from "@/modules/rbac/domain/policy";
import type { Account } from "@/modules/users/domain/contracts";
import {
  correctAttendanceCommand,
  selfAttendanceCommand,
} from "@/modules/attendance/application/commands";
import {
  assignWorkPolicyCommand,
  createWorkPolicyCommand,
} from "@/modules/work-policy/domain/contracts";

export const workforceCommandSchema = z.discriminatedUnion("action", [
  selfAttendanceCommand,
  correctAttendanceCommand,
  createWorkPolicyCommand,
  assignWorkPolicyCommand,
]);
export type WorkforceCommand = z.infer<typeof workforceCommandSchema>;

const permissions: Record<WorkforceCommand["action"], string> = {
  "attendance.check_in": "ATTENDANCE_READ_SELF",
  "attendance.check_out": "ATTENDANCE_READ_SELF",
  "attendance.correct": "ATTENDANCE_MANAGE",
  "work_policy.create": "WORK_POLICY_MANAGE",
  "work_policy.assign": "WORK_POLICY_MANAGE",
};

export interface WorkforceRepository {
  execute(command: WorkforceCommand, requestId: string): Promise<unknown>;
}

export async function executeWorkforceCommand(
  account: Account | null,
  input: unknown,
  repository: WorkforceRepository,
  requestId: string,
) {
  authorize(account);
  const command = workforceCommandSchema.parse(input);
  authorize(account, permissions[command.action]);
  return repository.execute(command, requestId);
}
