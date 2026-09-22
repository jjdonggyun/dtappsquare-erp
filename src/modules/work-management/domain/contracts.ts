import {z} from "zod";
export const workCategories=["PROJECT","INTERNAL_DEVELOPMENT","OPERATION","CUSTOMER_SUPPORT","SALES_SUPPORT","EDUCATION","MEETING","DOCUMENT","ADMINISTRATION","ETC"] as const;
export const workCategoryLabels:Record<(typeof workCategories)[number],string>={PROJECT:"프로젝트",INTERNAL_DEVELOPMENT:"사내개발",OPERATION:"운영",CUSTOMER_SUPPORT:"고객 대응",SALES_SUPPORT:"제안·영업 지원",EDUCATION:"교육",MEETING:"회의",DOCUMENT:"문서",ADMINISTRATION:"내부 행정",ETC:"기타"};
export const workStatuses=["PLANNED","IN_PROGRESS","DONE","BLOCKED"] as const;
export const workStatusLabels:Record<(typeof workStatuses)[number],string>={PLANNED:"예정",IN_PROGRESS:"진행 중",DONE:"완료",BLOCKED:"막힘"};
const maybeId=z.union([z.literal(""),z.uuid()]).default("");
const maybeTime=z.union([z.literal(""),z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]).default("");
export const workManagementCommands=z.discriminatedUnion("action",[
 z.object({action:z.literal("work_log.save"),payload:z.object({id:maybeId.optional(),version:z.number().int().positive().optional(),work_date:z.iso.date(),work_category:z.enum(workCategories),project_id:maybeId,project_task_id:maybeId,title:z.string().trim().min(1).max(200),description:z.string().max(4000).default(""),start_time:maybeTime,end_time:maybeTime,work_minutes:z.number().int().min(1).max(1440),progress:z.union([z.literal(""),z.number().min(0).max(100)]).default(""),status:z.enum(workStatuses),blocker:z.string().max(2000).default(""),memo:z.string().max(2000).default("")})}),
 z.object({action:z.literal("work_log.delete"),payload:z.object({id:z.uuid(),version:z.number().int().positive()})}),
 z.object({action:z.enum(["weekly_report.generate","weekly_report.refresh"]),payload:z.object({week_start_date:z.iso.date(),version:z.number().int().positive().optional()})}),
 z.object({action:z.literal("weekly_report.save"),payload:z.object({week_start_date:z.iso.date(),version:z.number().int().positive(),summary:z.string().max(4000),completed_work:z.string().max(8000),in_progress_work:z.string().max(8000),issues:z.string().max(4000),next_week_plan:z.string().max(4000)})}),
 z.object({action:z.literal("weekly_report.confirm"),payload:z.object({week_start_date:z.iso.date(),version:z.number().int().positive()})}),
]);
export type WorkManagementCommand=z.infer<typeof workManagementCommands>;
