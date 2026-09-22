import { z } from "zod";

export const readNotificationCommand = z.object({
  action: z.literal("notification.read"),
  payload: z.object({ id: z.uuid() }),
});
