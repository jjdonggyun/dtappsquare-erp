import { z } from "zod";
export const shortText = z.string().trim().min(1).max(80);
export const optionalId = z.union([z.uuid(), z.literal("")]).optional();
