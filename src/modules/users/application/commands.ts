import { z } from "zod";
import { userStatus, employmentType } from "../domain/contracts";
const text = z.string().trim().min(1).max(80);
const optionalId = z.union([z.uuid(), z.literal("")]).optional();
const date = z.iso.date();
const phone = z.string().trim().max(40).optional();
const personFields = {
  name: text,
  employee_number: z.string().trim().min(1).max(40),
  phone,
  join_date: date,
  organization_id: z.uuid(),
  position_id: optionalId,
  title_id: optionalId,
  employment_type: employmentType,
};
export const employeeCommands = [
  z.object({
    action: z.literal("employee.update"),
    payload: z
      .object({ id: z.uuid(), version: z.number().int().positive(), ...personFields })
      .strict(),
  }),
  z.object({
    action: z.literal("employee.status"),
    payload: z
      .object({
        id: z.uuid(),
        version: z.number().int().positive(),
        status: userStatus,
        employee_number: z.string().trim().max(40).optional(),
        join_date: date.optional(),
        organization_id: optionalId,
        resignation_date: date.optional(),
      })
      .strict(),
  }),
  z.object({
    action: z.literal("profile.update"),
    payload: z
      .object({
        version: z.number().int().positive(),
        phone,
        profile_image: z
          .union([z.url().startsWith("https://").max(2000), z.literal("")])
          .optional(),
      })
      .strict(),
  }),
] as const;
export const createEmployeeSchema = z
  .object({ email: z.email().max(254), password: z.string().min(12).max(128), ...personFields })
  .strict();
