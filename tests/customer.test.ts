import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnvFile } from "node:process";
import postgres from "postgres";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { customerCommandSchema } from "../src/modules/customer/domain/contracts";

loadEnvFile(".env.local");
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const dbUrl = process.env.TEST_DATABASE_URL!;
if (
  !["127.0.0.1", "localhost"].includes(new URL(apiUrl).hostname) ||
  !["127.0.0.1", "localhost"].includes(new URL(dbUrl).hostname)
)
  throw new Error("Customer integration tests require a disposable local database.");

const sql = postgres(dbUrl, { max: 1 });
const makeClient = () =>
  createClient(apiUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

let admin: SupabaseClient;
let manager: SupabaseClient;
let employee: SupabaseClient;
let adminId = "";
let customerId = "";
let contactId = "";
const requestIds: string[] = [];

const payload = {
  customer_code: `T${Date.now()}`,
  name: `통합 테스트 고객 ${Date.now()}`,
  business_registration_number: "123-45-67890",
  representative_name: "테스트 대표",
  address: "서울시 테스트구",
  business_type: "서비스",
  business_item: "소프트웨어",
  billing_contact_name: "정산 담당",
  billing_email: "billing@example.com",
  payment_terms: "검수 후 30일",
  default_payment_terms: "월말 마감",
  note: "통합 테스트",
  status: "ACTIVE",
};

function run(client: SupabaseClient, action: string, body: Record<string, unknown>, requestId = crypto.randomUUID()) {
  requestIds.push(requestId);
  return client.rpc("customer_command", {
    p_action: action,
    p_payload: body,
    p_request_id: requestId,
  });
}

beforeAll(async () => {
  admin = makeClient();
  manager = makeClient();
  employee = makeClient();
  for (const [client, name] of [
    [admin, "admin"],
    [manager, "manager"],
    [employee, "employee"],
  ] as const) {
    const { error } = await client.auth.signInWithPassword({
      email: `${name}@digitalsquare.local`,
      password: process.env.SEED_PASSWORD!,
    });
    if (error) throw error;
  }
  adminId = (await admin.auth.getUser()).data.user!.id;
});

afterAll(async () => {
  if (contactId) await sql`delete from public.customer_contacts where id=${contactId}`;
  if (customerId) {
    await sql`delete from public.projects where customer_id=${customerId} and project_code like 'CUSTOMER-TEST-%'`;
    await sql`delete from public.customers where id=${customerId}`;
  }
  for (const id of [contactId, customerId].filter(Boolean))
    await sql`delete from public.audit_logs where entity_id=${id}`;
  for (const requestId of requestIds)
    await sql`delete from public.customer_command_receipts where request_id=${requestId}`;
  await sql.end();
});

describe("Phase 12 customer management", () => {
  it("validates customer and contact commands", () => {
    expect(customerCommandSchema.parse({ action: "customer.save", payload })).toMatchObject({
      action: "customer.save",
      payload: { customer_code: payload.customer_code },
    });
    expect(() =>
      customerCommandSchema.parse({
        action: "customer.save",
        payload: { ...payload, business_registration_number: "123" },
      }),
    ).toThrow();
  });

  it("creates a customer idempotently and enforces read/write scope", async () => {
    const requestId = crypto.randomUUID();
    const created = await run(admin, "customer.save", payload, requestId);
    expect(created.error).toBeNull();
    customerId = created.data.id;
    const retry = await run(admin, "customer.save", payload, requestId);
    expect(retry.error).toBeNull();
    expect(retry.data.id).toBe(customerId);
    expect((await run(admin, "customer.save", { ...payload, name: "변조된 재시도" }, requestId)).error?.code).toBe("40001");

    expect((await manager.from("customers").select("id").eq("id", customerId)).data).toEqual([{ id: customerId }]);
    expect((await employee.from("customers").select("id").eq("id", customerId)).data).toEqual([]);
    expect((await run(employee, "customer.save", { ...payload, customer_code: `${payload.customer_code}X` })).error?.code).toBe("42501");
    expect((await admin.from("customers").insert({ customer_code: `DIRECT_${Date.now()}`, name: "직접 입력", created_by: adminId, updated_by: adminId })).error?.code).toBe("42501");
  });

  it("updates versioned data, stores a primary contact, and audits both", async () => {
    const updated = await run(admin, "customer.save", {
      ...payload,
      id: customerId,
      version: 1,
      payment_terms: "검수 후 45일",
    });
    expect(updated.error).toBeNull();
    expect((await run(admin, "customer.save", { ...payload, id: customerId, version: 1 })).error?.code).toBe("40001");

    const contact = await run(admin, "contact.save", {
      customer_id: customerId,
      name: "고객 담당자",
      department: "IT",
      position: "팀장",
      phone: "02-0000-0000",
      email: "contact@example.com",
      contact_type: "PROJECT",
      is_primary: true,
      active: true,
    });
    expect(contact.error).toBeNull();
    contactId = contact.data.id;
    expect((await manager.from("customer_contacts").select("name,is_primary").eq("id", contactId)).data).toEqual([
      { name: "고객 담당자", is_primary: true },
    ]);
    const audit = await sql`select entity_type,request_id from public.audit_logs where entity_id in (${customerId},${contactId}) order by created_at`;
    expect(audit.some((row) => row.entity_type === "customers" && row.request_id)).toBe(true);
    expect(audit.some((row) => row.entity_type === "customer_contacts" && row.request_id)).toBe(true);
  });

  it("preserves legacy project names and archives without hard deletion", async () => {
    const before = await sql`select customer_id from public.projects where id='50000000-0000-4000-8000-000000000001'`;
    expect(before[0].customer_id).toBeNull();
    const archived = await run(admin, "customer.archive", { id: customerId, version: 2 });
    expect(archived.error).toBeNull();
    const [customer] = await sql`select status,archived_at from public.customers where id=${customerId}`;
    expect(customer.status).toBe("ARCHIVED");
    expect(customer.archived_at).not.toBeNull();
    expect((await sql`select active from public.customer_contacts where id=${contactId}`)[0].active).toBe(false);
  });
});
