import { z } from "zod";

export const selfAttendanceCommand = z.object({
  action: z.enum(["attendance.check_in", "attendance.check_out"]),
  payload: z.object({verification_id:z.uuid().optional()}).strict().default({}),
});

export const correctAttendanceCommand = z.object({
  action: z.literal("attendance.correct"),
  payload: z
    .object({
      user_id: z.uuid(),
      work_date: z.iso.date(),
      check_in_time: z.union([
        z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        z.literal(""),
      ]),
      check_out_time: z.union([
        z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        z.literal(""),
      ]),
      reason: z.string().trim().min(2).max(500),
    })
    .refine((value) => !value.check_out_time || Boolean(value.check_in_time), {
      message: "퇴근시각을 입력하려면 출근시각도 필요합니다.",
      path: ["check_in_time"],
    }),
});
