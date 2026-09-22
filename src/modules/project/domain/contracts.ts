import { z } from "zod";

export const projectStatuses = ["PLANNING","SCHEDULED","IN_PROGRESS","ON_HOLD","COMPLETED","CANCELED"] as const;
export const assignmentStatuses = ["PLANNED","CONFIRMED","IN_PROGRESS","ON_HOLD","ENDED","CANCELED"] as const;

export const projectStatusLabels: Record<(typeof projectStatuses)[number],string> = {
  PLANNING:"기획",SCHEDULED:"예정",IN_PROGRESS:"진행 중",ON_HOLD:"보류",COMPLETED:"완료",CANCELED:"취소",
};
export const assignmentStatusLabels: Record<(typeof assignmentStatuses)[number],string> = {
  PLANNED:"계획",CONFIRMED:"확정",IN_PROGRESS:"투입 중",ON_HOLD:"보류",ENDED:"종료",CANCELED:"취소",
};

const nullableDate = z.union([z.literal(""),z.iso.date()]).default("");
const optionalEmployee = z.union([z.literal(""),z.uuid()]).default("");
const priority = z.enum(["LOW","MEDIUM","HIGH","URGENT"]);
export const projectCommands = [
  z.object({action:z.literal("project.save"),payload:z.object({
    id:z.union([z.literal(""),z.uuid()]).optional(),version:z.number().int().positive().optional(),
    project_code:z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/),
    project_name:z.string().trim().min(2).max(160),customer_name:z.string().trim().min(1).max(160),
    description:z.string().trim().max(4000).default(""),planned_start_date:z.iso.date(),planned_end_date:z.iso.date(),
    actual_start_date:nullableDate,actual_end_date:nullableDate,status:z.enum(projectStatuses),project_manager_id:z.uuid(),
  })}),
  z.object({action:z.literal("project_assignment.save"),payload:z.object({
    id:z.union([z.literal(""),z.uuid()]).optional(),version:z.number().int().positive().optional(),project_id:z.uuid(),user_id:z.uuid(),
    project_role:z.string().trim().min(1).max(100),planned_start_date:z.iso.date(),planned_end_date:z.iso.date(),
    actual_start_date:nullableDate,actual_end_date:nullableDate,allocation_rate:z.number().min(0).max(100),
    status:z.enum(assignmentStatuses),memo:z.string().trim().max(2000).default(""),
  })}),
  z.object({action:z.literal("project_assignment.batch"),payload:z.object({
    project_id:z.uuid(),user_ids:z.array(z.uuid()).min(1).max(100),
    project_role:z.string().trim().min(1).max(100),planned_start_date:z.iso.date(),planned_end_date:z.iso.date(),
    allocation_rate:z.number().min(0).max(100),status:z.enum(assignmentStatuses).default("PLANNED"),
    actual_start_date:nullableDate,actual_end_date:nullableDate,memo:z.string().trim().max(2000).default(""),
  })}),
  z.object({action:z.literal("project.progress"),payload:z.object({project_id:z.uuid(),version:z.number().int().positive(),actual_progress:z.number().min(0).max(100)})}),
  z.object({action:z.literal("project_task.save"),payload:z.object({
    id:optionalEmployee.optional(),version:z.number().int().positive().optional(),project_id:z.uuid(),parent_id:optionalEmployee,
    title:z.string().trim().min(1).max(200),assignee_id:optionalEmployee,status:z.enum(["PLANNED","IN_PROGRESS","ON_HOLD","DONE"]),
    priority,planned_start_date:z.iso.date(),planned_end_date:z.iso.date(),actual_start_date:nullableDate,actual_end_date:nullableDate,
    progress:z.number().min(0).max(100),description:z.string().trim().max(4000).default(""),
  })}),
  z.object({action:z.literal("project_milestone.save"),payload:z.object({
    id:optionalEmployee.optional(),version:z.number().int().positive().optional(),project_id:z.uuid(),name:z.string().trim().min(1).max(160),
    planned_date:z.iso.date(),completed_date:nullableDate,status:z.enum(["PLANNED","IN_PROGRESS","COMPLETED","ON_HOLD"]),
    description:z.string().trim().max(2000).default(""),
  })}),
  z.object({action:z.literal("project_issue.save"),payload:z.object({
    id:optionalEmployee.optional(),version:z.number().int().positive().optional(),project_id:z.uuid(),kind:z.enum(["ISSUE","RISK"]),
    title:z.string().trim().min(1).max(200),description:z.string().trim().max(4000).default(""),assignee_id:optionalEmployee,
    priority,status:z.enum(["OPEN","IN_PROGRESS","RESOLVED","CLOSED"]),target_date:nullableDate,resolved_date:nullableDate,
  })}),
] as const;
