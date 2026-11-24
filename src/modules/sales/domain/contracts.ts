import { z } from "zod";

const optionalId = z.union([z.literal(""), z.uuid()]).optional();
const optionalDate = z.union([z.literal(""), z.iso.date()]).default("");
const optionalText = (max: number) => z.string().trim().max(max).default("");

export const opportunityStages = [
  "LEAD",
  "PROPOSAL",
  "QUOTATION",
  "NEGOTIATION",
  "ON_HOLD",
  "WON",
  "LOST",
  "ARCHIVED",
] as const;

export type OpportunityStage = (typeof opportunityStages)[number];

export const opportunityStageLabels: Record<OpportunityStage, string> = {
  LEAD: "발굴",
  PROPOSAL: "제안",
  QUOTATION: "견적",
  NEGOTIATION: "협상",
  ON_HOLD: "보류",
  WON: "수주",
  LOST: "실주",
  ARCHIVED: "보관",
};

export const opportunityTransitions: Record<OpportunityStage, OpportunityStage[]> = {
  LEAD: ["PROPOSAL", "ON_HOLD", "LOST"],
  PROPOSAL: ["QUOTATION", "ON_HOLD", "LOST"],
  QUOTATION: ["NEGOTIATION", "WON", "ON_HOLD", "LOST"],
  NEGOTIATION: ["WON", "ON_HOLD", "LOST"],
  ON_HOLD: ["LEAD", "PROPOSAL", "QUOTATION", "NEGOTIATION", "LOST"],
  WON: [],
  LOST: [],
  ARCHIVED: [],
};

const opportunityFields = z
  .object({
    id: optionalId,
    version: z.number().int().positive().optional(),
    customer_id: z.uuid(),
    sales_owner_id: z.uuid(),
    title: z.string().trim().min(1).max(200),
    expected_project_name: optionalText(200),
    expected_amount: z.number().min(0).max(9999999999999999.99),
    probability: z.number().min(0).max(100),
    expected_start_date: optionalDate,
    expected_end_date: optionalDate,
    proposal_due_date: optionalDate,
    competitor: optionalText(300),
    note: optionalText(4000),
  })
  .superRefine((value, context) => {
    if (
      value.expected_start_date &&
      value.expected_end_date &&
      value.expected_start_date > value.expected_end_date
    ) {
      context.addIssue({
        code: "custom",
        path: ["expected_end_date"],
        message: "예상 종료일은 시작일보다 빠를 수 없습니다.",
      });
    }
  });

export const salesCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("opportunity.save"), payload: opportunityFields }),
  z.object({
    action: z.literal("opportunity.transition"),
    payload: z.object({
      id: z.uuid(),
      version: z.number().int().positive(),
      to_stage: z.enum(opportunityStages),
      lost_reason: optionalText(1000),
    }),
  }),
  z.object({
    action: z.literal("opportunity.archive"),
    payload: z.object({ id: z.uuid(), version: z.number().int().positive() }),
  }),
]);

export type SalesCommand = z.infer<typeof salesCommandSchema>;

