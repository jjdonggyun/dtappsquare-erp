import { z } from "zod";
import { shortText, optionalId } from "@/shared/validation/fields";
export const roleCommands = [
  z.object({
    action: z.literal("role.save"),
    payload: z
      .object({
        id: optionalId,
        code: z.string().regex(/^[A-Z][A-Z0-9_]{1,60}$/),
        name: shortText,
        active: z.boolean(),
        permission_ids: z.array(z.uuid()).max(100),
      })
      .strict(),
  }),
  z.object({
    action: z.literal("role.assign"),
    payload: z.object({ id: z.uuid(), role_ids: z.array(z.uuid()).min(1).max(30) }).strict(),
  }),
] as const;
