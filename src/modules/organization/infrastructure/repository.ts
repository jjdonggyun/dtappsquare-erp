import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
import { organizationSchema } from "../domain/tree";
const catalogSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  sort_order: z.number(),
  active: z.boolean(),
});
export async function organizationCatalogs() {
  const client = await serverClient();
  const results = await Promise.all([
    client.from("organizations").select("*").order("sort_order"),
    client.from("positions").select("*").order("sort_order"),
    client.from("titles").select("*").order("sort_order"),
    client.rpc("employee_directory"),
  ]);
  for (const result of results) if (result.error) throw databaseError(result.error);
  return {
    organizations: organizationSchema.array().parse(results[0].data),
    positions: catalogSchema.array().parse(results[1].data),
    titles: catalogSchema.array().parse(results[2].data),
    directory: z
      .array(
        z.object({
          id: z.uuid(),
          name: z.string(),
          organization_id: z.uuid().nullable(),
          position_id: z.uuid().nullable(),
          title_id: z.uuid().nullable(),
        }),
      )
      .parse(results[3].data),
  };
}
