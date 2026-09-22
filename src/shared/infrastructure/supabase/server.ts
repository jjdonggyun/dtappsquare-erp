import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { environment } from "../env";
import type { Database } from "./database.types";
export async function serverClient() {
  const env = environment();
  const jar = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll(values) {
          try {
            values.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            /* Server Components are read-only; proxy persists refreshed cookies. */
          }
        },
      },
    },
  );
}
