import "server-only";

import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
export async function dashboardCounts() {
  const client = await serverClient();
  const queries = await Promise.all([
    client
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("user_status", "ACTIVE"),
    client
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("user_status", "REQUESTED"),
    client.from("organizations").select("id", { count: "exact", head: true }).eq("active", true),
    client.from("roles").select("id", { count: "exact", head: true }).eq("active", true),
  ]);
  for (const query of queries) if (query.error) throw databaseError(query.error);
  return {
    active: queries[0].count ?? 0,
    requested: queries[1].count ?? 0,
    organizations: queries[2].count ?? 0,
    roles: queries[3].count ?? 0,
  };
}
