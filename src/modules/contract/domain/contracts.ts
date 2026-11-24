import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).default("");

export const contractStatuses = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "SIGNED",
  "ACTIVE",
  "COMPLETED",
  "TERMINATED",
  "CANCELED",
] as const;

export const contractStatusLabels: Record<string, string> = {
  DRAFT: "작성 중",
  SUBMITTED: "승인 대기",
  APPROVED: "승인",
  REJECTED: "반려",
  SIGNED: "서명 완료",
  ACTIVE: "이행 중",
  COMPLETED: "완료",
  TERMINATED: "종료",
  CANCELED: "취소",
};

const contractFields = z
  .object({
    contract_name: z.string().trim().min(1).max(200),
    purchase_order_number: optionalText(100),
    contract_date: z.iso.date(),
    start_date: z.iso.date(),
    end_date: z.iso.date(),
    supply_amount: z.number().min(0).max(9999999999999999.99),
    vat_rate: z.number().min(0).max(100),
    payment_terms: optionalText(2000),
    warranty_terms: optionalText(2000),
    note: optionalText(4000),
  })
  .superRefine((value, context) => {
    if (value.start_date > value.end_date)
      context.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "계약 종료일은 시작일보다 빠를 수 없습니다.",
      });
  });

export const contractCommandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("contract.create"),
    payload: contractFields.and(z.object({ quotation_revision_id: z.uuid() })),
  }),
  z.object({
    action: z.literal("contract.save"),
    payload: contractFields.and(
      z.object({
        id: z.uuid(),
        version: z.number().int().positive(),
        change_reason: optionalText(1000),
      }),
    ),
  }),
  z.object({
    action: z.literal("contract.submit"),
    payload: z.object({ id: z.uuid(), version: z.number().int().positive() }),
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
  z.object({
    action: z.literal("contract.sign"),
    payload: z.object({
      id: z.uuid(),
      version: z.number().int().positive(),
      signed_date: z.iso.date(),
    }),
  }),
  z.object({
    action: z.literal("contract.create_project"),
    payload: z.object({
      id: z.uuid(),
      project_code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/),
      project_manager_id: z.uuid(),
      description: optionalText(4000),
    }),
  }),
]);

export type ContractCommand = z.infer<typeof contractCommandSchema>;

