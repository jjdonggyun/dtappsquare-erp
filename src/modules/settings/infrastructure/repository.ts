import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
export async function companySettings(){const client=await serverClient();const {data,error}=await client.from("company_settings").select("*").order("key");if(error)throw databaseError(error);return z.array(z.object({key:z.string(),value:z.record(z.string(),z.unknown()),version:z.number().int(),updated_at:z.string()})).parse(data)}
