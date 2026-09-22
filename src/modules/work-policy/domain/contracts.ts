import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const optionalTime = z.union([hhmm, z.literal("")]);

export const createWorkPolicyCommand = z.object({
  action: z.literal("work_policy.create"),
  payload: z
    .object({
      code: z
        .string()
        .trim()
        .regex(/^[A-Z][A-Z0-9_]{1,60}$/),
      name: z.string().trim().min(1).max(100),
      check_in_time: hhmm,
      check_out_time: hhmm,
      break_start: optionalTime.default(""),
      break_end: optionalTime.default(""),
      late_grace_minutes: z.coerce.number().int().min(0).max(180),
      timezone: z.string().trim().min(1).max(80),
      working_days: z.array(z.coerce.number().int().min(1).max(7)).min(1).max(7),
    })
    .superRefine((value, context) => {
      if (Boolean(value.break_start) !== Boolean(value.break_end))
        context.addIssue({
          code: "custom",
          message: "휴게 시작과 종료 시간을 모두 입력해 주세요.",
        });
      if (new Set(value.working_days).size !== value.working_days.length)
        context.addIssue({ code: "custom", message: "근무 요일이 중복되었습니다." });
    }),
});

export const assignWorkPolicyCommand = z.object({
  action: z.literal("work_policy.assign"),
  payload: z.object({
    user_id: z.uuid(),
    work_policy_id: z.uuid(),
    effective_from: z.iso.date(),
    effective_to: z.union([z.iso.date(), z.literal("")]).default(""),
  }),
});

export type WorkPolicyCommand =
  z.infer<typeof createWorkPolicyCommand> | z.infer<typeof assignWorkPolicyCommand>;
