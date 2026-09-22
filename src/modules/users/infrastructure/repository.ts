import "server-only";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
import { employeeSchema } from "../domain/contracts";
export async function employeeList(
  options: { status?: string; page?: number; search?: string; organizationId?: string } = {},
) {
  const client = await serverClient();
  const page = Math.max(1, options.page ?? 1);
  let query = client
    .from("employees")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 25, page * 25 - 1);
  if (options.status) query = query.eq("user_status", options.status);
  if (options.organizationId) query = query.eq("organization_id", options.organizationId);
  if (options.search) query = query.ilike("name", `%${options.search.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, error, count } = await query;
  if (error) throw databaseError(error);
  return { rows: employeeSchema.array().parse(data), count: count ?? 0 };
}
export async function employeeById(id: string) {
  const client = await serverClient();
  const { data, error } = await client.from("employees").select("*").eq("id", id).maybeSingle();
  if (error) throw databaseError(error);
  return data ? employeeSchema.parse(data) : null;
}
