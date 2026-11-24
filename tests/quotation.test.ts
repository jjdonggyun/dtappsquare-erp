import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnvFile } from "node:process";
import postgres from "postgres";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { quotationCommandSchema } from "../src/modules/quotation/domain/contracts";

loadEnvFile(".env.local");
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const dbUrl = process.env.TEST_DATABASE_URL!;
if (
  !["127.0.0.1", "localhost"].includes(new URL(apiUrl).hostname) ||
  !["127.0.0.1", "localhost"].includes(new URL(dbUrl).hostname)
)
  throw new Error("Quotation integration tests require a disposable local database.");

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
let quotationId = "";
let revision1Id = "";
let revision2Id = "";
let approvalId = "";
const customerRequestIds: string[] = [];
const salesRequestIds: string[] = [];
const quotationRequestIds: string[] = [];

function runQuotation(
  client: SupabaseClient,
  action: string,
  payload: Record<string, unknown>,
  requestId = crypto.randomUUID(),
) {
  quotationRequestIds.push(requestId);
  return client.rpc("quotation_command", {
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

  const customerRequestId = crypto.randomUUID();
  customerRequestIds.push(customerRequestId);
  const customer = await admin.rpc("customer_command", {
    p_action: "customer.save",
    p_payload: {
      customer_code: `QUOTETEST${Date.now()}`,
      name: `견적 테스트 고객 ${Date.now()}`,
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
    p_request_id: customerRequestId,
  });
  if (customer.error) throw customer.error;
  customerId = customer.data.id;

  const salesRequestId = crypto.randomUUID();
  salesRequestIds.push(salesRequestId);
  const opportunity = await admin.rpc("sales_command", {
    p_action: "opportunity.save",
    p_payload: {
      customer_id: customerId,
      sales_owner_id: adminId,
      title: "견적 테스트 영업기회",
      expected_project_name: "견적 기반 프로젝트",
      expected_amount: 100_000_000,
      probability: 50,
      expected_start_date: "2026-11-01",
      expected_end_date: "2027-03-31",
      proposal_due_date: "2026-10-15",
      competitor: "",
      note: "",
    },
    p_request_id: salesRequestId,
  });
  if (opportunity.error) throw opportunity.error;
  opportunityId = opportunity.data.id;
});

afterAll(async () => {
  if (quotationId || approvalId) {
    const notifications = await sql`
      select id from public.notifications
      where reference_id in (${quotationId || null},${approvalId || null})`;
    for (const notification of notifications)
      await sql`delete from public.notification_outbox where notification_id=${notification.id}`;
    await sql`delete from public.notifications where reference_id in (${quotationId || null},${approvalId || null})`;
  }
  const revisionIds = [revision1Id, revision2Id].filter(Boolean);
  const itemRows = revisionIds.length
    ? await sql`select id from public.quotation_items where revision_id in (${revision1Id || null},${revision2Id || null})`
    : [];
  for (const id of [quotationId, ...revisionIds, ...itemRows.map((row) => row.id)].filter(Boolean))
    await sql`delete from public.audit_logs where entity_id=${id}`;
  let subjectId: string | null = null;
  if (approvalId) {
    const rows = await sql`select approval_subject_id from public.approval_requests where id=${approvalId}`;
    subjectId = rows[0]?.approval_subject_id ?? null;
    await sql`delete from public.approval_request_steps where approval_request_id=${approvalId}`;
    await sql`delete from public.approval_requests where id=${approvalId}`;
  }
  if (quotationId)
    await sql`update public.quotations set current_revision_id=null,approved_revision_id=null where id=${quotationId}`;
  for (const revisionId of revisionIds)
    await sql`delete from public.quotation_items where revision_id=${revisionId}`;
  for (const revisionId of revisionIds)
    await sql`delete from public.quotation_revisions where id=${revisionId}`;
  if (subjectId) await sql`delete from public.approval_subjects where id=${subjectId}`;
  if (quotationId) await sql`delete from public.quotations where id=${quotationId}`;
  for (const requestId of quotationRequestIds)
    await sql`delete from public.quotation_command_receipts where request_id=${requestId}`;
  if (opportunityId) {
    await sql`delete from public.audit_logs where entity_id=${opportunityId}`;
    await sql`delete from public.opportunities where id=${opportunityId}`;
  }
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

describe("Phase 12 quotation revision and approval", () => {
  it("validates quotation dates and detail amounts", () => {
    expect(
      quotationCommandSchema.parse({
        action: "quotation.create",
        payload: {
          opportunity_id: opportunityId,
          project_name: "ERP 구축",
          quotation_date: "2026-09-26",
          valid_until: "2026-10-26",
          vat_rate: 10,
          expected_cost: 50_000_000,
          note: "",
        },
      }),
    ).toMatchObject({ action: "quotation.create" });
    expect(() =>
      quotationCommandSchema.parse({
        action: "item.save",
        payload: {
          revision_id: crypto.randomUUID(),
          item_name: "개발",
          role_name: "Developer",
          headcount: 1,
          man_month: 1,
          period_start: "",
          period_end: "",
          quantity: 0,
          unit_price: 1,
          note: "",
          sort_order: 1,
        },
      }),
    ).toThrow();
  });

  it("creates a quotation, calculates totals, and preserves revisions", async () => {
    const created = await runQuotation(admin, "quotation.create", {
      opportunity_id: opportunityId,
      project_name: "ERP 구축",
      quotation_date: "2026-09-26",
      valid_until: "2026-10-26",
      vat_rate: 10,
      expected_cost: 50_000_000,
      note: "V1",
    });
    expect(created.error).toBeNull();
    quotationId = created.data.id;
    revision1Id = created.data.revision_id;

    const item = await runQuotation(admin, "item.save", {
      revision_id: revision1Id,
      item_name: "개발 용역",
      role_name: "Developer",
      headcount: 2,
      man_month: 4,
      period_start: "2026-11-01",
      period_end: "2027-02-28",
      quantity: 4,
      unit_price: 12_000_000,
      note: "",
      sort_order: 1,
    });
    expect(item.error).toBeNull();
    const [v1] = await sql`select supply_amount,vat_amount,total_amount,expected_profit,version from public.quotation_revisions where id=${revision1Id}`;
    expect(Number(v1.supply_amount)).toBe(48_000_000);
    expect(Number(v1.vat_amount)).toBe(4_800_000);
    expect(Number(v1.total_amount)).toBe(52_800_000);
    expect(Number(v1.expected_profit)).toBe(-2_000_000);

    const next = await runQuotation(admin, "revision.create", { id: quotationId });
    expect(next.error).toBeNull();
    revision2Id = next.data.revision_id;
    const revisions = await sql`select revision_no,status,total_amount from public.quotation_revisions where quotation_id=${quotationId} order by revision_no`;
    expect(revisions.map((revision) => revision.status)).toEqual(["SUPERSEDED", "DRAFT"]);
    expect(Number(revisions[1].total_amount)).toBe(52_800_000);
    expect((await sql`select count(*)::int n from public.quotation_items where revision_id=${revision2Id} and active`)[0].n).toBe(1);
    expect((await employee.from("quotations").select("id").eq("id", quotationId)).data).toEqual([]);
    expect((await manager.from("quotations").select("id").eq("id", quotationId)).data).toEqual([{ id: quotationId }]);
  });

  it("submits the current revision to the generic approval inbox and approves it", async () => {
    const [revision] = await sql`select version from public.quotation_revisions where id=${revision2Id}`;
    const submitted = await runQuotation(admin, "quotation.submit", {
      id: quotationId,
      revision_version: revision.version,
    });
    expect(submitted.error).toBeNull();
    approvalId = submitted.data.approval_request_id;
    const managerId = (await manager.auth.getUser()).data.user!.id;
    expect(
      (
        await manager
          .from("approval_request_steps")
          .select("approver_id,status")
          .eq("approval_request_id", approvalId)
      ).data,
    ).toEqual([{ approver_id: managerId, status: "PENDING" }]);

    const approved = await runQuotation(manager, "approval.decide", {
      id: approvalId,
      version: 1,
      decision: "APPROVED",
      comment: "금액 및 이익률 검토 완료",
    });
    expect(approved.error).toBeNull();
    const [quote] = await sql`select status,approved_revision_id from public.quotations where id=${quotationId}`;
    expect(quote.status).toBe("APPROVED");
    expect(quote.approved_revision_id).toBe(revision2Id);
    expect((await sql`select status from public.quotation_revisions where id=${revision2Id}`)[0].status).toBe("APPROVED");
    expect(
      (
        await runQuotation(admin, "item.save", {
          revision_id: revision2Id,
          item_name: "승인 후 변경",
          role_name: "",
          headcount: 1,
          man_month: 1,
          period_start: "",
          period_end: "",
          quantity: 1,
          unit_price: 1,
          note: "",
          sort_order: 2,
        })
      ).error?.code,
    ).toBe("40001");
  });
});

