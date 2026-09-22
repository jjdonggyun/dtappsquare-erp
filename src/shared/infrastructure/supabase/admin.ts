import "server-only";
import { createClient } from "@supabase/supabase-js";
import { environment } from "../env";
import { AppError } from "@/shared/domain/errors";
import type { Database } from "./database.types";
export function provisioningClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new AppError("InternalError");
  return createClient<Database>(environment().NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
