import { z } from "zod";

export const approvalStatusLabels: Record<string, string> = {
  PENDING: "결재 대기",
  APPROVED: "승인",
  REJECTED: "반려",
  CANCELED: "취소",
};

export const decideApprovalCommand = z.object({
  action: z.literal("approval.decide"),
  payload: z.object({
    id: z.uuid(),
    version: z.coerce.number().int().positive(),
    decision: z.enum(["APPROVED", "REJECTED"]),
    comment: z.string().trim().max(1000).default(""),
  }),
});
