import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";

const notificationSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  reference_type: z.string(),
  reference_id: z.uuid(),
  event_key: z.string(),
  read_at: z.string().nullable(),
  created_at: z.string(),
});

export async function notificationList() {
  const client = await serverClient();
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw databaseError(error);
  return notificationSchema.array().parse(data);
}

export async function notificationUnreadCount() {
  const client = await serverClient();
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw databaseError(error);
  return count ?? 0;
}
