import "server-only";
import { z } from "zod";
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  APP_URL: z.url(),
  COMPANY_TIMEZONE: z.string().default("Asia/Seoul"),
});
export function environment() {
  return schema.parse(process.env);
}
export function configured() {
  return schema.safeParse(process.env).success;
}
