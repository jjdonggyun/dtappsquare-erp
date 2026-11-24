import { z } from "zod";

const optionalId = z.union([z.literal(""), z.uuid()]).optional();
const optionalDate = z.union([z.literal(""), z.iso.date()]).default("");
const optionalText = (max: number) => z.string().trim().max(max).default("");

export const quotationStatuses = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "CANCELED",
  "ARCHIVED",
] as const;

export const quotationStatusLabels: Record<string, string> = {
  DRAFT: "작성 중",
  SUBMITTED: "승인 대기",
  APPROVED: "승인",
  REJECTED: "반려",
  SUPERSEDED: "이전 Revision",
  CANCELED: "취소",
  ARCHIVED: "보관",
};

const revisionFields = z
  .object({
    project_name: z.string().trim().min(1).max(200),
    quotation_date: z.iso.date(),
    valid_until: z.iso.date(),
    vat_rate: z.number().min(0).max(100),
    expected_cost: z.number().min(0).max(9999999999999999.99),
    note: optionalText(4000),
  })
  .superRefine((value, context) => {
    if (value.valid_until < value.quotation_date)
      context.addIssue({
        code: "custom",
        path: ["valid_until"],
        message: "유효기간은 견적일보다 빠를 수 없습니다.",
      });
  });

const itemFields = z
  .object({
    id: optionalId,
    version: z.number().int().positive().optional(),
    revision_id: z.uuid(),
    item_name: z.string().trim().min(1).max(200),
    role_name: optionalText(120),
    headcount: z.number().int().min(0).max(10000),
    man_month: z.number().min(0).max(9999999999.99),
    period_start: optionalDate,
    period_end: optionalDate,
    quantity: z.number().positive().max(9999999999.99),
    unit_price: z.number().min(0).max(9999999999999999.99),
    note: optionalText(2000),
    sort_order: z.number().int().min(0).max(100000),
  })
  .superRefine((value, context) => {
    if (value.period_start && value.period_end && value.period_start > value.period_end)
      context.addIssue({
        code: "custom",
        path: ["period_end"],
        message: "종료일은 시작일보다 빠를 수 없습니다.",
      });
  });

export const quotationCommandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("quotation.create"),
    payload: revisionFields.and(z.object({ opportunity_id: z.uuid() })),
  }),
  z.object({
    action: z.literal("revision.save"),
    payload: revisionFields.and(
      z.object({ id: z.uuid(), version: z.number().int().positive() }),
    ),
  }),
  z.object({ action: z.literal("item.save"), payload: itemFields }),
  z.object({
    action: z.literal("item.archive"),
    payload: z.object({ id: z.uuid(), version: z.number().int().positive() }),
  }),
  z.object({
    action: z.literal("revision.create"),
    payload: z.object({ id: z.uuid() }),
  }),
  z.object({
    action: z.literal("quotation.submit"),
    payload: z.object({ id: z.uuid(), revision_version: z.number().int().positive() }),
  }),
  z.object({
    action: z.literal("approval.decide"),
    payload: z.object({
      id: z.uuid(),
      version: z.number().int().positive(),
      decision: z.enum(["APPROVED", "REJECTED"]),
      comment: optionalText(2000),
    }),
  }),
]);

export type QuotationCommand = z.infer<typeof quotationCommandSchema>;

