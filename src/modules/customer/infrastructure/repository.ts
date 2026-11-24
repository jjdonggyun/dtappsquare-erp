import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";
import type { CustomerCommandRepository } from "../application/commands";

export const customerSchema = z.object({
  id: z.uuid(),
  customer_code: z.string(),
  name: z.string(),
  business_registration_number: z.string().nullable(),
  representative_name: z.string().nullable(),
  address: z.string(),
  business_type: z.string(),
  business_item: z.string(),
  billing_contact_name: z.string(),
  billing_email: z.string().nullable(),
  payment_terms: z.string(),
  default_payment_terms: z.string(),
  note: z.string(),
  status: z.string(),
  archived_at: z.string().nullable(),
  created_by: z.uuid(),
  updated_by: z.uuid(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const customerContactSchema = z.object({
  id: z.uuid(),
  customer_id: z.uuid(),
  name: z.string(),
  department: z.string(),
  position: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  contact_type: z.string(),
  is_primary: z.boolean(),
  active: z.boolean(),
  created_by: z.uuid(),
  updated_by: z.uuid(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

const relatedProjectSchema = z.object({
  id: z.uuid(),
  project_code: z.string(),
  project_name: z.string(),
  customer_id: z.uuid().nullable(),
  customer_name: z.string(),
  status: z.string(),
  planned_start_date: z.string(),
  planned_end_date: z.string(),
});

export function customerCommandRepository(): CustomerCommandRepository {
  return {
    async execute(command, requestId) {
      const client = await serverClient();
      const { data, error } = await client.rpc("customer_command", {
        p_action: command.action,
        p_payload: command.payload,
        p_request_id: requestId,
      });
      if (error) throw databaseError(error);
      return data;
    },
  };
}

export async function customerList(options: {
  page?: number;
  search?: string;
  status?: string;
} = {}) {
  const client = await serverClient();
  const page = Math.max(1, options.page ?? 1);
  const size = 30;
  let query = client
    .from("customers")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .order("id");
  if (options.status) query = query.eq("status", options.status);
  if (options.search) {
    const search = options.search.replace(/[%_,().]/g, " ").trim().slice(0, 80);
    if (search) {
      const filters = [`name.ilike.%${search}%`, `customer_code.ilike.%${search}%`];
      const registration = search.replace(/\D/g, "");
      if (registration) filters.push(`business_registration_number.ilike.%${registration}%`);
      query = query.or(filters.join(","));
    }
  }
  const { data, error, count } = await query.range((page - 1) * size, page * size - 1);
  if (error) throw databaseError(error);
  return { rows: customerSchema.array().parse(data), count: count ?? 0, page, size };
}

export async function customerDetail(id: string) {
  const client = await serverClient();
  const customerResult = await client.from("customers").select("*").eq("id", id).maybeSingle();
  if (customerResult.error) throw databaseError(customerResult.error);
  if (!customerResult.data) return null;
  const customer = customerSchema.parse(customerResult.data);
  const [contacts, linkedProjects, legacyProjects] = await Promise.all([
    client.from("customer_contacts").select("*").eq("customer_id", id).order("active", { ascending: false }).order("is_primary", { ascending: false }).order("name"),
    client.from("projects").select("id,project_code,project_name,customer_id,customer_name,status,planned_start_date,planned_end_date").eq("customer_id", id).order("planned_start_date", { ascending: false }),
    client.from("projects").select("id,project_code,project_name,customer_id,customer_name,status,planned_start_date,planned_end_date").is("customer_id", null).ilike("customer_name", customer.name).order("planned_start_date", { ascending: false }),
  ]);
  for (const result of [contacts, linkedProjects, legacyProjects])
    if (result.error) throw databaseError(result.error);
  const projects = [
    ...relatedProjectSchema.array().parse(linkedProjects.data),
    ...relatedProjectSchema.array().parse(legacyProjects.data),
  ];
  return {
    customer,
    contacts: customerContactSchema.array().parse(contacts.data),
    projects: [...new Map(projects.map((project) => [project.id, project])).values()],
  };
}
