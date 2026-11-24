import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).default("");
const optionalDate = z.union([z.literal(""), z.iso.date()]).default("");
const optionalUuid = z.union([z.literal(""), z.uuid()]).default("");

export const documentCategories = [
  "RFP",
  "PROPOSAL",
  "QUOTATION",
  "CONTRACT",
  "PURCHASE_ORDER",
  "BUSINESS_REGISTRATION",
  "KICKOFF",
  "PROJECT_PLAN",
  "WEEKLY_REPORT",
  "MONTHLY_REPORT",
  "CHANGE_REQUEST",
  "DELIVERABLE",
  "INSPECTION",
  "COMPLETION_REPORT",
  "TRANSACTION_STATEMENT",
  "BILLING",
  "TAX_INVOICE",
  "REPORT",
  "OTHER",
] as const;
export const documentCategoryLabels: Record<string, string> = {
  RFP: "RFP",
  PROPOSAL: "제안서",
  CONTRACT: "계약",
  QUOTATION: "견적",
  PURCHASE_ORDER: "발주서",
  BUSINESS_REGISTRATION: "사업자등록증",
  KICKOFF: "착수계",
  PROJECT_PLAN: "프로젝트 계획서",
  WEEKLY_REPORT: "주간보고",
  MONTHLY_REPORT: "월간보고",
  CHANGE_REQUEST: "변경요청서",
  DELIVERABLE: "산출물",
  INSPECTION: "검수",
  COMPLETION_REPORT: "완료보고서",
  TRANSACTION_STATEMENT: "거래명세서",
  BILLING: "청구서",
  TAX_INVOICE: "세금계산서",
  REPORT: "보고서",
  OTHER: "기타",
};
export const inspectionStatuses = [
  "DRAFT",
  "REQUESTED",
  "SCHEDULED",
  "COMPLETED",
  "CANCELED",
] as const;
export const inspectionStatusLabels: Record<string, string> = {
  DRAFT: "작성 중",
  REQUESTED: "검수 요청",
  SCHEDULED: "검수 예정",
  COMPLETED: "완료",
  CANCELED: "취소",
};
export const inspectionResults = ["PENDING", "PASSED", "CONDITIONAL", "FAILED", "WAIVED"] as const;
export const inspectionResultLabels: Record<string, string> = {
  PENDING: "미정",
  PASSED: "통과",
  CONDITIONAL: "조건부 통과",
  FAILED: "실패",
  WAIVED: "면제",
};

const inspectionFields = z
  .object({
    project_id: z.uuid(),
    milestone_id: optionalUuid,
    document_id: optionalUuid,
    inspection_type: z.enum(["DELIVERY", "MILESTONE", "QUALITY", "ACCEPTANCE", "OTHER"]),
    title: z.string().trim().min(1).max(200),
    requested_date: optionalDate,
    scheduled_date: optionalDate,
    completed_date: optionalDate,
    customer_contact_name: optionalText(120),
    customer_contact_email: z.union([z.literal(""), z.email().max(254)]).default(""),
    status: z.enum(inspectionStatuses),
    result: z.enum(inspectionResults),
    note: optionalText(4000),
  })
  .superRefine((value, context) => {
    if (value.requested_date && value.scheduled_date && value.scheduled_date < value.requested_date)
      context.addIssue({
        code: "custom",
        path: ["scheduled_date"],
        message: "검수 예정일을 확인해 주세요.",
      });
    if (value.scheduled_date && value.completed_date && value.completed_date < value.scheduled_date)
      context.addIssue({
        code: "custom",
        path: ["completed_date"],
        message: "검수 완료일을 확인해 주세요.",
      });
    if (value.status === "COMPLETED" && !value.completed_date)
      context.addIssue({
        code: "custom",
        path: ["completed_date"],
        message: "완료일이 필요합니다.",
      });
    if (value.status !== "COMPLETED" && value.result !== "PENDING")
      context.addIssue({
        code: "custom",
        path: ["result"],
        message: "검수 완료 후 결과를 선택해 주세요.",
      });
  });

export const projectHubCommandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("employee.cost_rate.save"),
    payload: z.object({
      user_id: z.uuid(),
      effective_from: z.iso.date(),
      effective_to: optionalDate,
      monthly_cost_rate: z.number().min(0).max(9999999999999999.99),
      note: optionalText(1000),
    }),
  }),
  z.object({
    action: z.literal("assignment.rate.snapshot"),
    payload: z.object({
      assignment_id: z.uuid(),
      planned_mm: z.number().min(0).max(99999999.99),
      monthly_cost_rate: z.number().min(0).max(9999999999999999.99),
      monthly_billing_rate: z.number().min(0).max(9999999999999999.99),
      source_employee_cost_rate_id: optionalUuid,
      reason: optionalText(1000),
    }),
  }),
  z.object({
    action: z.literal("document.register"),
    payload: z.object({
      id: z.uuid().optional(),
      project_id: z.uuid(),
      title: z.string().trim().min(1).max(200),
      category: z.enum(documentCategories),
      file_name: z.string().trim().min(1).max(255),
      storage_key: z.string().min(10).max(600),
      mime_type: z.string().min(3).max(120),
      size_bytes: z
        .number()
        .int()
        .positive()
        .max(50 * 1024 * 1024),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  }),
  z.object({ action: z.literal("document.archive"), payload: z.object({ id: z.uuid() }) }),
  z.object({
    action: z.literal("inspection.save"),
    payload: inspectionFields.and(
      z.object({ id: z.uuid().optional(), version: z.number().int().positive().optional() }),
    ),
  }),
]);

export type ProjectHubCommand = z.infer<typeof projectHubCommandSchema>;
