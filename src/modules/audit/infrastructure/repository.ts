import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
export async function auditList(options: { page?: number; entityType?: string; action?: string } = {}) {
  const client = await serverClient();
  const page = Math.max(1, options.page ?? 1);
  let query = client
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id");
  if (options.entityType) query = query.eq("entity_type", options.entityType);
  if (options.action) query = query.eq("action", options.action);
  const { data, error, count } = await query.range((page - 1) * 30, page * 30 - 1);
  if (error) throw databaseError(error);
  return {
    count: count ?? 0,
    rows: z
      .array(
        z.object({
          id: z.uuid(),
          actor_user_id: z.uuid().nullable(),
          action: z.string(),
          entity_type: z.string(),
          entity_id: z.string(),
          before_data: z.unknown(),
          after_data: z.unknown(),
          ip_address: z.unknown().nullable(),
          request_id: z.string().nullable(),
          created_at: z.string(),
        }),
      )
      .parse(data),
  };
}
