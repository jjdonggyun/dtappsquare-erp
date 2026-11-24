import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnvFile } from "node:process";
import postgres from "postgres";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { contractCommandSchema } from "../src/modules/contract/domain/contracts";

loadEnvFile(".env.local");
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const dbUrl = process.env.TEST_DATABASE_URL!;
if (
  !["127.0.0.1", "localhost"].includes(new URL(apiUrl).hostname) ||
  !["127.0.0.1", "localhost"].includes(new URL(dbUrl).hostname)
)
  throw new Error("Contract integration tests require a disposable local database.");

const sql = postgres(dbUrl, { max: 1 });
const makeClient = () =>
  createClient(apiUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

let admin: SupabaseClient;
let manager: SupabaseClient;
let employee: SupabaseClient;
let adminId = "";
let managerId = "";
let customerId = "";
let opportunityId = "";
let quotationId = "";
let revisionId = "";
let quotationApprovalId = "";
let contractId = "";
let contractApprovalId = "";
let projectId = "";
const customerRequestIds: string[] = [];
const salesRequestIds: string[] = [];
const quotationRequestIds: string[] = [];
const contractRequestIds: string[] = [];

function runQuotation(client: SupabaseClient, action: string, payload: Record<string, unknown>) {
  const requestId = crypto.randomUUID();
  quotationRequestIds.push(requestId);
  return client.rpc("quotation_command", { p_action: action, p_payload: payload, p_request_id: requestId });
}

function runContract(
  client: SupabaseClient,
  action: string,
  payload: Record<string, unknown>,
  requestId = crypto.randomUUID(),
) {
  contractRequestIds.push(requestId);
  return client.rpc("contract_command", { p_action: action, p_payload: payload, p_request_id: requestId });
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
  managerId = (await manager.auth.getUser()).data.user!.id;

  const customerRequestId = crypto.randomUUID();
  customerRequestIds.push(customerRequestId);
  const customer = await admin.rpc("customer_command", {
    p_action: "customer.save",
    p_payload: {
      customer_code: `CONTRACTTEST${Date.now()}`,
      name: `계약 테스트 고객 ${Date.now()}`,
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
      title: "계약 전환 테스트 영업기회",
      expected_project_name: "계약 기반 프로젝트",
      expected_amount: 88_000_000,
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
  const referenceIds = [quotationId, quotationApprovalId, contractId, contractApprovalId, projectId].filter(Boolean);
  if (referenceIds.length) {
    const notifications = await sql`select id from public.notifications where reference_id in ${sql(referenceIds)}`;
    for (const notification of notifications)
      await sql`delete from public.notification_outbox where notification_id=${notification.id}`;
    await sql`delete from public.notifications where reference_id in ${sql(referenceIds)}`;
  }

  const approvalIds = [quotationApprovalId, contractApprovalId].filter(Boolean);
  const subjectIds: string[] = [];
  if (approvalIds.length) {
    const subjects = await sql`select approval_subject_id from public.approval_requests where id in ${sql(approvalIds)}`;
    subjectIds.push(...subjects.map((row) => row.approval_subject_id));
    await sql`delete from public.approval_request_steps where approval_request_id in ${sql(approvalIds)}`;
    await sql`delete from public.approval_requests where id in ${sql(approvalIds)}`;
  }

  if (projectId) {
    await sql`delete from public.audit_logs where entity_id=${projectId}`;
    await sql`delete from public.projects where id=${projectId}`;
  }
  if (contractId) {
    const amendments = await sql`select id from public.contract_amendments where contract_id=${contractId}`;
    for (const amendment of amendments)
      await sql`delete from public.audit_logs where entity_id=${amendment.id}`;
    await sql`delete from public.audit_logs where entity_id=${contractId}`;
    await sql`delete from public.contract_amendments where contract_id=${contractId}`;
    await sql`delete from public.contracts where id=${contractId}`;
  }
  if (quotationId)
    await sql`update public.quotations set current_revision_id=null,approved_revision_id=null where id=${quotationId}`;
  if (revisionId) {
    const items = await sql`select id from public.quotation_items where revision_id=${revisionId}`;
    for (const item of items) await sql`delete from public.audit_logs where entity_id=${item.id}`;
    await sql`delete from public.audit_logs where entity_id=${revisionId}`;
    await sql`delete from public.quotation_items where revision_id=${revisionId}`;
    await sql`delete from public.quotation_revisions where id=${revisionId}`;
  }
  if (quotationId) {
    await sql`delete from public.audit_logs where entity_id=${quotationId}`;
    await sql`delete from public.quotations where id=${quotationId}`;
  }
  for (const subjectId of subjectIds) await sql`delete from public.approval_subjects where id=${subjectId}`;
  for (const requestId of contractRequestIds)
    await sql`delete from public.contract_command_receipts where request_id=${requestId}`;
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

describe("Phase 12 contract approval and project conversion", () => {
  it("validates contract periods and project codes", () => {
    expect(() =>
      contractCommandSchema.parse({
        action: "contract.create",
        payload: {
          quotation_revision_id: crypto.randomUUID(),
          contract_name: "테스트 계약",
          purchase_order_number: "",
          contract_date: "2026-09-27",
          start_date: "2027-01-01",
          end_date: "2026-12-31",
          supply_amount: 1,
          vat_rate: 10,
          payment_terms: "",
          warranty_terms: "",
          note: "",
        },
      }),
    ).toThrow();
    expect(() =>
      contractCommandSchema.parse({
        action: "contract.create_project",
        payload: { id: crypto.randomUUID(), project_code: "공백 코드", project_manager_id: crypto.randomUUID(), description: "" },
      }),
    ).toThrow();
  });

  it("converts an approved quotation into an approved and signed contract, then creates one linked project", async () => {
    const quotation = await runQuotation(admin, "quotation.create", {
      opportunity_id: opportunityId,
      project_name: "계약 기반 프로젝트",
      quotation_date: "2026-09-27",
      valid_until: "2026-10-27",
      vat_rate: 10,
      expected_cost: 55_000_000,
      note: "계약 테스트",
    });
    expect(quotation.error).toBeNull();
    quotationId = quotation.data.id;
    revisionId = quotation.data.revision_id;

    const item = await runQuotation(admin, "item.save", {
      revision_id: revisionId,
      item_name: "ERP 구축 용역",
      role_name: "컨설턴트",
      headcount: 2,
      man_month: 6,
      period_start: "2026-11-01",
      period_end: "2027-03-31",
      quantity: 6,
      unit_price: 10_000_000,
      note: "",
      sort_order: 1,
    });
    expect(item.error).toBeNull();
    const [revision] = await sql`select version from public.quotation_revisions where id=${revisionId}`;
    const submittedQuotation = await runQuotation(admin, "quotation.submit", {
      id: quotationId,
      revision_version: revision.version,
    });
    expect(submittedQuotation.error).toBeNull();
    quotationApprovalId = submittedQuotation.data.approval_request_id;
    expect(
      (await runQuotation(manager, "approval.decide", {
        id: quotationApprovalId,
        version: 1,
        decision: "APPROVED",
        comment: "견적 승인",
      })).error,
    ).toBeNull();

    const created = await runContract(admin, "contract.create", {
      quotation_revision_id: revisionId,
      contract_name: "ERP 구축 본계약",
      purchase_order_number: "PO-2026-001",
      contract_date: "2026-09-27",
      start_date: "2026-11-01",
      end_date: "2027-03-31",
      supply_amount: 60_000_000,
      vat_rate: 10,
      payment_terms: "월말 정산",
      warranty_terms: "검수 후 12개월",
      note: "초안",
    });
    expect(created.error).toBeNull();
    contractId = created.data.id;
    let [contract] = await sql`select * from public.contracts where id=${contractId}`;
    expect(Number(contract.vat_amount)).toBe(6_000_000);
    expect(Number(contract.total_amount)).toBe(66_000_000);
    expect((await sql`select count(*)::int n from public.contract_amendments where contract_id=${contractId}`)[0].n).toBe(1);
    expect((await manager.from("contracts").select("id").eq("id", contractId)).data).toEqual([{ id: contractId }]);
    expect((await employee.from("contracts").select("id").eq("id", contractId)).data).toEqual([]);

    const saved = await runContract(admin, "contract.save", {
      id: contractId,
      version: contract.version,
      contract_name: "ERP 구축 본계약",
      purchase_order_number: "PO-2026-001",
      contract_date: "2026-09-27",
      start_date: "2026-11-01",
      end_date: "2027-03-31",
      supply_amount: 62_000_000,
      vat_rate: 10,
      payment_terms: "월말 정산",
      warranty_terms: "검수 후 12개월",
      note: "금액 조정",
      change_reason: "협상 결과 반영",
    });
    expect(saved.error).toBeNull();
    contract = (await sql`select * from public.contracts where id=${contractId}`)[0];
    expect(Number(contract.total_amount)).toBe(68_200_000);
    expect(contract.current_amendment_no).toBe(1);

    const submitted = await runContract(admin, "contract.submit", { id: contractId, version: contract.version });
    expect(submitted.error).toBeNull();
    contractApprovalId = submitted.data.approval_request_id;
    expect(
      (await manager.from("approval_request_steps").select("approver_id,status").eq("approval_request_id", contractApprovalId)).data,
    ).toEqual([{ approver_id: managerId, status: "PENDING" }]);
    expect(
      (await runContract(manager, "approval.decide", {
        id: contractApprovalId,
        version: 1,
        decision: "APPROVED",
        comment: "계약 조건 확인",
      })).error,
    ).toBeNull();

    contract = (await sql`select * from public.contracts where id=${contractId}`)[0];
    expect(contract.status).toBe("APPROVED");
    expect((await runContract(admin, "contract.sign", { id: contractId, version: contract.version, signed_date: "2026-10-01" })).error).toBeNull();
    contract = (await sql`select * from public.contracts where id=${contractId}`)[0];
    expect(contract.status).toBe("SIGNED");

    const projectRequestId = crypto.randomUUID();
    const projectPayload = {
      id: contractId,
      project_code: `ct-${Date.now()}`,
      project_manager_id: managerId,
      description: "계약 자동 전환 프로젝트",
    };
    const project = await runContract(admin, "contract.create_project", projectPayload, projectRequestId);
    expect(project.error).toBeNull();
    projectId = project.data.project_id;
    const retry = await runContract(admin, "contract.create_project", projectPayload, projectRequestId);
    expect(retry.error).toBeNull();
    expect(retry.data.project_id).toBe(projectId);

    const [storedProject] = await sql`
      select customer_id,contract_id,opportunity_id,quotation_revision_id,sales_owner_id,project_manager_id,status
      from public.projects where id=${projectId}`;
    expect(storedProject).toMatchObject({
      customer_id: customerId,
      contract_id: contractId,
      opportunity_id: opportunityId,
      quotation_revision_id: revisionId,
      sales_owner_id: adminId,
      project_manager_id: managerId,
      status: "PLANNING",
    });
    expect((await sql`select status from public.contracts where id=${contractId}`)[0].status).toBe("ACTIVE");
    expect((await sql`select count(*)::int n from public.projects where contract_id=${contractId}`)[0].n).toBe(1);
    expect(
      (await employee.rpc("contract_command", {
        p_action: "contract.create_project",
        p_payload: { id: contractId, project_code: "DENIED", project_manager_id: managerId, description: "" },
        p_request_id: crypto.randomUUID(),
      })).error?.code,
    ).toBe("42501");
  });
});
