import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
export async function roleCatalogs() {
  const client = await serverClient();
  const results = await Promise.all([
    client.from("roles").select("*").order("code"),
    client.from("permissions").select("*").order("code"),
    client.from("role_permissions").select("*"),
    client.from("user_roles").select("*"),
  ]);
  for (const result of results) if (result.error) throw databaseError(result.error);
  return {
    roles: z
      .array(
        z.object({
          id: z.uuid(),
          code: z.string(),
          name: z.string(),
          active: z.boolean(),
          system: z.boolean(),
        }),
      )
      .parse(results[0].data),
    permissions: z
      .array(z.object({ id: z.uuid(), code: z.string(), description: z.string() }))
      .parse(results[1].data),
    mappings: z
      .array(z.object({ role_id: z.uuid(), permission_id: z.uuid() }))
      .parse(results[2].data),
    userRoles: z.array(z.object({ user_id: z.uuid(), role_id: z.uuid() })).parse(results[3].data),
  };
}
