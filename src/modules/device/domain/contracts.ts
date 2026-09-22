import { z } from "zod";

export const deviceCommands = [
  z.object({
    action: z.literal("device.register"),
    payload: z.object({
      asset_id: z.uuid(),
      device_id: z.union([z.literal(""), z.uuid()]).default(""),
      hostname: z.string().trim().min(1).max(253),
      serial_number: z.string().trim().min(1).max(160),
      mac_address: z.string().trim().min(11).max(64),
      os: z.string().trim().min(1).max(160),
    }),
  }),
  z.object({
    action: z.literal("device.status"),
    payload: z.object({ id: z.uuid(), version: z.number().int().positive(), active: z.boolean() }),
  }),
] as const;

export const heartbeatSchema = z.object({
  device_id: z.uuid(),
  device_token: z.string().min(32).max(256),
  hostname: z.string().trim().min(1).max(253).optional(),
  mac_address: z.string().trim().min(11).max(64).optional(),
  os: z.string().trim().min(1).max(160).optional(),
});
