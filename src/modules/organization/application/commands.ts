import { z } from "zod";
import { shortText, optionalId } from "@/shared/validation/fields";
export const organizationCommands = [
  z.object({
    action: z.literal("organization.save"),
    payload: z
      .object({
        id: optionalId,
        name: shortText,
        organization_type: z.enum(["COMPANY", "DIVISION", "TEAM", "DEPARTMENT"]),
        parent_id: optionalId,
        leader_user_id: optionalId,
        sort_order: z.number().int().min(0).max(1000000),
        active: z.boolean(),
      })
      .strict(),
  }),
  z.object({
    action: z.literal("catalog.save"),
    payload: z
      .object({
        id: optionalId,
        catalog: z.enum(["positions", "titles"]),
        code: z.string().regex(/^[A-Z][A-Z0-9_]{1,60}$/),
        name: shortText,
        sort_order: z.number().int().min(0).max(1000000),
        active: z.boolean(),
      })
      .strict(),
  }),
] as const;
