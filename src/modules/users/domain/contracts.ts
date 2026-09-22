import { z } from "zod";
export const userStatus = z.enum(["REQUESTED", "ACTIVE", "REJECTED", "SUSPENDED", "RESIGNED"]);
export const employmentType = z.enum(["FULL_TIME", "CONTRACT", "PART_TIME", "INTERN"]);
export const employeeSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  employee_number: z.string().nullable(),
  phone: z.string().nullable(),
  join_date: z.string().nullable(),
  resignation_date: z.string().nullable(),
  organization_id: z.uuid().nullable(),
  position_id: z.uuid().nullable(),
  title_id: z.uuid().nullable(),
  employment_type: employmentType,
  user_status: userStatus,
  profile_image: z.string().nullable(),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Employee = z.infer<typeof employeeSchema>;
export const accountSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: userStatus,
  permissions: z.array(z.string()),
});
export type Account = z.infer<typeof accountSchema>;
export const statusLabels: Record<z.infer<typeof userStatus>, string> = {
  REQUESTED: "승인 대기",
  ACTIVE: "재직",
  REJECTED: "가입 반려",
  SUSPENDED: "이용 정지",
  RESIGNED: "퇴사",
};
export function allowedTransitions(status: z.infer<typeof userStatus>) {
  const transitions = {
    REQUESTED: ["ACTIVE", "REJECTED"],
    ACTIVE: ["SUSPENDED", "RESIGNED"],
    SUSPENDED: ["ACTIVE", "RESIGNED"],
    REJECTED: ["REQUESTED"],
    RESIGNED: [],
  } as const;
  return transitions[status];
}
