import { z } from "zod";

export const settingCommandSchema=z.object({
  action:z.literal("setting.save"),
  payload:z.object({key:z.literal("project.allocation"),mode:z.enum(["WARN","BLOCK"]),version:z.number().int().positive()}),
});
