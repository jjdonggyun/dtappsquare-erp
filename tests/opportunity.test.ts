import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnvFile } from "node:process";
import postgres from "postgres";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { salesCommandSchema } from "../src/modules/sales/domain/contracts";

loadEnvFile(".env.local");
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const dbUrl = process.env.TEST_DATABASE_URL!;
if (
  !["127.0.0.1", "localhost"].includes(new URL(apiUrl).hostname) ||
  !["127.0.0.1", "localhost"].includes(new URL(dbUrl).hostname)
)
  throw new Error("Opportunity integration tests require a disposable local database.");

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
let opportunityId = "";
let lostOpportunityId = "";
const salesRequestIds: string[] = [];
const customerRequestIds: string[] = [];

const opportunityPayload = {
  customer_id: "",
  sales_owner_id: "",
  title: `통합 테스트 영업기회 ${Date.now()}`,
  expected_project_name: "차세대 ERP 구축",
  expected_amount: 100_000_000,
  probability: 25,
  expected_start_date: "2026-11-01",
  expected_end_date: "2027-03-31",
  proposal_due_date: "2026-10-15",
  competitor: "테스트 경쟁사",
  note: "영업기회 통합 테스트",
};

function runSales(
  client: SupabaseClient,
  action: string,
  payload: Record<string, unknown>,
  requestId = crypto.randomUUID(),
) {
  salesRequestIds.push(requestId);
  return client.rpc("sales_command", {
    p_action: action,
    p_payload: payload,
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
  const requestId = crypto.randomUUID();
  customerRequestIds.push(requestId);
  const customer = await admin.rpc("customer_command", {
    p_action: "customer.save",
    p_payload: {
      customer_code: `OPPTEST${Date.now()}`,
      name: `영업기회 테스트 고객 ${Date.now()}`,
      business_registration_number: "",
      representative_name: "",
      address: "",
      business_type: "",
      business_item: "",
      billing_contact_name: "",
      billing_email: "",
      payment_terms: "",
      default_payment_terms: "",
      note: "",
      status: "ACTIVE",
    },
    p_request_id: requestId,
  });
  if (customer.error) throw customer.error;
  customerId = customer.data.id;
  opportunityPayload.customer_id = customerId;
  opportunityPayload.sales_owner_id = adminId;
});

afterAll(async () => {
  for (const id of [opportunityId, lostOpportunityId].filter(Boolean))
    await sql`delete from public.audit_logs where entity_id=${id}`;
  for (const id of [opportunityId, lostOpportunityId].filter(Boolean))
    await sql`delete from public.opportunities where id=${id}`;
  for (const requestId of salesRequestIds)
    await sql`delete from public.sales_command_receipts where request_id=${requestId}`;
  if (customerId) {
    await sql`delete from public.audit_logs where entity_id=${customerId}`;
    await sql`delete from public.customers where id=${customerId}`;
  }
  for (const requestId of customerRequestIds)
    await sql`delete from public.customer_command_receipts where request_id=${requestId}`;
  await sql.end();
});

describe("Phase 12 opportunity management", () => {
  it("validates amount, probability, and expected dates", () => {
    expect(
      salesCommandSchema.parse({ action: "opportunity.save", payload: opportunityPayload }),
    ).toMatchObject({ action: "opportunity.save", payload: { probability: 25 } });
    expect(() =>
      salesCommandSchema.parse({
        action: "opportunity.save",
        payload: { ...opportunityPayload, probability: 101 },
      }),
    ).toThrow();
    expect(() =>
      salesCommandSchema.parse({
        action: "opportunity.save",
        payload: {
          ...opportunityPayload,
          expected_start_date: "2027-01-01",
          expected_end_date: "2026-01-01",
        },
      }),
    ).toThrow();
  });

  it("creates an idempotent opportunity and derives expected revenue", async () => {
    const requestId = crypto.randomUUID();
    const created = await runSales(admin, "opportunity.save", opportunityPayload, requestId);
    expect(created.error).toBeNull();
    opportunityId = created.data.id;
    const retry = await runSales(admin, "opportunity.save", opportunityPayload, requestId);
    expect(retry.error).toBeNull();
    expect(retry.data.id).toBe(opportunityId);
    expect(
      (await runSales(admin, "opportunity.save", { ...opportunityPayload, title: "변조" }, requestId))
        .error?.code,
    ).toBe("40001");

    const [stored] = await sql`
      select stage,expected_amount,probability,expected_revenue
      from public.opportunities where id=${opportunityId}`;
    expect(stored.stage).toBe("LEAD");
    expect(Number(stored.expected_revenue)).toBe(25_000_000);
    expect((await manager.from("opportunities").select("id").eq("id", opportunityId)).data).toEqual([
      { id: opportunityId },
    ]);
    expect((await employee.from("opportunities").select("id").eq("id", opportunityId)).data).toEqual([]);
    expect(
      (
        await employee.rpc("sales_command", {
          p_action: "opportunity.save",
          p_payload: opportunityPayload,
          p_request_id: crypto.randomUUID(),
        })
      ).error?.code,
    ).toBe("42501");
    expect(
      (
        await admin.from("opportunities").insert({
          customer_id: customerId,
          sales_owner_id: adminId,
          title: "직접 입력",
          created_by: adminId,
          updated_by: adminId,
        })
      ).error?.code,
    ).toBe("42501");
  });

  it("enforces version checks and the sales stage state machine", async () => {
    const invalid = await runSales(admin, "opportunity.transition", {
      id: opportunityId,
      version: 1,
      to_stage: "WON",
      lost_reason: "",
    });
    expect(invalid.error?.code).toBe("40001");

    for (const [version, toStage] of [
      [1, "PROPOSAL"],
      [2, "QUOTATION"],
      [3, "NEGOTIATION"],
      [4, "WON"],
    ] as const) {
      const result = await runSales(admin, "opportunity.transition", {
        id: opportunityId,
        version,
        to_stage: toStage,
        lost_reason: "",
      });
      expect(result.error).toBeNull();
    }
    const [won] = await sql`select stage,probability,closed_at,version from public.opportunities where id=${opportunityId}`;
    expect(won.stage).toBe("WON");
    expect(Number(won.probability)).toBe(100);
    expect(won.closed_at).not.toBeNull();
    expect(
      (
        await runSales(admin, "opportunity.save", {
          ...opportunityPayload,
          id: opportunityId,
          version: 5,
        })
      ).error?.code,
    ).toBe("40001");
  });

  it("requires a lost reason, archives without hard deletion, and audits changes", async () => {
    const created = await runSales(admin, "opportunity.save", {
      ...opportunityPayload,
      title: "실주 및 보관 테스트",
    });
    expect(created.error).toBeNull();
    lostOpportunityId = created.data.id;
    expect(
      (
        await runSales(admin, "opportunity.transition", {
          id: lostOpportunityId,
          version: 1,
          to_stage: "LOST",
          lost_reason: "",
        })
      ).error?.code,
    ).toBe("22023");
    const lost = await runSales(admin, "opportunity.transition", {
      id: lostOpportunityId,
      version: 1,
      to_stage: "LOST",
      lost_reason: "가격 경쟁력 부족",
    });
    expect(lost.error).toBeNull();
    const archived = await runSales(admin, "opportunity.archive", {
      id: lostOpportunityId,
      version: 2,
    });
    expect(archived.error).toBeNull();
    const [stored] = await sql`select stage,archived_at from public.opportunities where id=${lostOpportunityId}`;
    expect(stored.stage).toBe("ARCHIVED");
    expect(stored.archived_at).not.toBeNull();
    const audit = await sql`
      select request_id from public.audit_logs
      where entity_type='opportunities' and entity_id in (${opportunityId},${lostOpportunityId})`;
    expect(audit.length).toBeGreaterThanOrEqual(7);
    expect(audit.every((row) => row.request_id)).toBe(true);
  });
});
