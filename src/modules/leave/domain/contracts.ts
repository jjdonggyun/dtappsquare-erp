import { z } from "zod";

export const leaveTypes = [
  "ANNUAL",
  "HALF_DAY_AM",
  "HALF_DAY_PM",
  "SICK",
  "SPECIAL",
  "OTHER",
] as const;

export const leaveTypeLabels: Record<(typeof leaveTypes)[number], string> = {
  ANNUAL: "연차",
  HALF_DAY_AM: "오전 반차",
  HALF_DAY_PM: "오후 반차",
  SICK: "병가",
  SPECIAL: "특별휴가",
  OTHER: "기타",
};

export const leaveStatusLabels: Record<string, string> = {
  DRAFT: "작성 중",
  REQUESTED: "결재 중",
  APPROVED: "승인",
  REJECTED: "반려",
  CANCELED: "취소",
};

export const createLeaveCommand = z.object({
  action: z.literal("leave.create"),
  payload: z
    .object({
      leave_type: z.enum(leaveTypes),
      start_date: z.iso.date(),
      end_date: z.iso.date(),
      reason: z.string().trim().min(2).max(1000),
    })
    .refine((value) => value.end_date >= value.start_date, {
      message: "종료일은 시작일보다 빠를 수 없습니다.",
      path: ["end_date"],
    })
    .refine(
      (value) =>
        !value.leave_type.startsWith("HALF_DAY") || value.start_date === value.end_date,
      { message: "반차는 하루만 선택할 수 있습니다.", path: ["end_date"] },
    ),
});

const versionedId = z.object({ id: z.uuid(), version: z.coerce.number().int().positive() });
export const submitLeaveCommand = z.object({ action: z.literal("leave.submit"), payload: versionedId });
export const cancelLeaveCommand = z.object({ action: z.literal("leave.cancel"), payload: versionedId });

export const balanceAdjustmentCommand = z.object({
  action: z.literal("leave.balance.adjust"),
  payload: z.object({
    user_id: z.uuid(),
    leave_type: z.enum(["ANNUAL", "SICK", "SPECIAL", "OTHER"]),
    amount: z.coerce.number().min(-365).max(365).refine((value) => value !== 0),
    entry_type: z.enum(["GRANT", "ADJUST"]),
    memo: z.string().trim().max(500).default(""),
  }),
});
