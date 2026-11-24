import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnvFile } from "node:process";
import postgres from "postgres";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { projectHubCommandSchema } from "../src/modules/project-hub/domain/contracts";

loadEnvFile(".env.local");
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const dbUrl = process.env.TEST_DATABASE_URL!;
if (
  !["127.0.0.1", "localhost"].includes(new URL(apiUrl).hostname) ||
  !["127.0.0.1", "localhost"].includes(new URL(dbUrl).hostname)
)
  throw new Error("Project hub integration tests require a disposable local database.");

const sql = postgres(dbUrl, { max: 1 });
const makeClient = () =>
  createClient(apiUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

let admin: SupabaseClient;
let manager: SupabaseClient;
let employee: SupabaseClient;
let managerId = "";
let employeeId = "";
let projectId = "";
let assignmentId = "";
let costRateId = "";
let documentId = "";
let previousDocumentId = "";
let inspectionId = "";
let milestoneId = "";
const commandRequestIds: string[] = [];

function runHub(
  client: SupabaseClient,
  action: string,
  payload: Record<string, unknown>,
  requestId = crypto.randomUUID(),
) {
  commandRequestIds.push(requestId);
  return client.rpc("project_hub_command", {
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
  managerId = (await manager.auth.getUser()).data.user!.id;
  employeeId = (await employee.auth.getUser()).data.user!.id;

  const project = await manager.rpc("project_resource_command", {
    p_action: "project.save",
    p_payload: {
      project_code: `HUB-${Date.now()}`,
      project_name: "Phase 2 프로젝트 허브 통합 테스트",
      customer_name: "테스트 고객",
      description: "project hub integration",
      planned_start_date: "2026-10-01",
      planned_end_date: "2026-12-31",
      actual_start_date: "",
      actual_end_date: "",
      status: "SCHEDULED",
      project_manager_id: managerId,
    },
    p_request_id: crypto.randomUUID(),
  });
  if (project.error) throw project.error;
  projectId = project.data.id;

  const assignment = await manager.rpc("project_resource_command", {
    p_action: "project_assignment.save",
    p_payload: {
      project_id: projectId,
      user_id: employeeId,
      project_role: "Developer",
      planned_start_date: "2026-10-01",
      planned_end_date: "2026-12-31",
      actual_start_date: "",
      actual_end_date: "",
      allocation_rate: 50,
      status: "CONFIRMED",
      memo: "project hub integration",
    },
    p_request_id: crypto.randomUUID(),
  });
  if (assignment.error) throw assignment.error;
  assignmentId = assignment.data.id;
});

afterAll(async () => {
  if (assignmentId) {
    const notifications =
      await sql`select id from public.notifications where reference_id=${assignmentId}`;
    for (const notification of notifications) {
      await sql`delete from public.email_delivery_attempts where outbox_id in (
        select id from public.notification_outbox where notification_id=${notification.id}
      )`;
      await sql`delete from public.notification_outbox where notification_id=${notification.id}`;
    }
    await sql`delete from public.notifications where reference_id=${assignmentId}`;
  }
  if (inspectionId) await sql`delete from public.inspections where id=${inspectionId}`;
  for (const id of [documentId, previousDocumentId].filter(Boolean))
    await sql`delete from public.project_document_links where document_id=${id}`;
  if (documentId) await sql`delete from public.documents where id=${documentId}`;
  if (previousDocumentId) await sql`delete from public.documents where id=${previousDocumentId}`;
  if (assignmentId)
    await sql`delete from public.project_assignment_rates where assignment_id=${assignmentId}`;
  if (costRateId) await sql`delete from public.employee_cost_rates where id=${costRateId}`;
  if (milestoneId) await sql`delete from public.project_milestones where id=${milestoneId}`;
  if (assignmentId) await sql`delete from public.project_assignments where id=${assignmentId}`;
  for (const entityId of [
    inspectionId,
    documentId,
    previousDocumentId,
    assignmentId,
    costRateId,
    milestoneId,
    projectId,
  ].filter(Boolean))
    await sql`delete from public.audit_logs where entity_id=${entityId}`;
  if (projectId) await sql`delete from public.projects where id=${projectId}`;
  for (const requestId of commandRequestIds)
    await sql`delete from public.project_hub_command_receipts where request_id=${requestId}`;
  await sql.end();
});

describe("Phase 2 project hub, rate snapshots, documents, and inspections", () => {
  it("validates completed inspections and project document metadata", () => {
    expect(() =>
      projectHubCommandSchema.parse({
        action: "inspection.save",
        payload: {
          project_id: crypto.randomUUID(),
          milestone_id: "",
          document_id: "",
          inspection_type: "ACCEPTANCE",
          title: "완료 검수",
          requested_date: "2026-10-01",
          scheduled_date: "2026-10-02",
          completed_date: "",
          customer_contact_name: "",
          customer_contact_email: "",
          status: "COMPLETED",
          result: "PASSED",
          note: "",
        },
      }),
    ).toThrow();
    expect(() =>
      projectHubCommandSchema.parse({
        action: "document.register",
        payload: {
          project_id: crypto.randomUUID(),
          title: "잘못된 문서",
          category: "DELIVERABLE",
          file_name: "test.pdf",
          storage_key: "too-short",
          mime_type: "application/pdf",
          size_bytes: 1,
          sha256: "invalid",
        },
      }),
    ).toThrow();
  });

  it("keeps employee cost rates private and assignment rates as immutable snapshots", async () => {
    const createdCostRate = await runHub(admin, "employee.cost_rate.save", {
      user_id: employeeId,
      effective_from: "2026-10-01",
      effective_to: "2026-12-31",
      monthly_cost_rate: 5_000_000,
      note: "Phase 2 기준 원가",
    });
    expect(createdCostRate.error).toBeNull();
    costRateId = createdCostRate.data.id;

    expect(
      (
        await runHub(manager, "employee.cost_rate.save", {
          user_id: employeeId,
          effective_from: "2027-01-01",
          effective_to: "2027-03-31",
          monthly_cost_rate: 5_500_000,
          note: "권한 없음",
        })
      ).error?.code,
    ).toBe("42501");
    expect(
      (await employee.from("employee_cost_rates").select("id").eq("id", costRateId)).data,
    ).toEqual([]);

    const first = await runHub(manager, "assignment.rate.snapshot", {
      assignment_id: assignmentId,
      planned_mm: 2.5,
      monthly_cost_rate: 5_000_000,
      monthly_billing_rate: 8_000_000,
      source_employee_cost_rate_id: costRateId,
      reason: "최초 계획",
    });
    expect(first.error).toBeNull();
    expect(first.data.snapshot_no).toBe(1);

    const secondRequestId = crypto.randomUUID();
    const secondPayload = {
      assignment_id: assignmentId,
      planned_mm: 3,
      monthly_cost_rate: 5_000_000,
      monthly_billing_rate: 8_500_000,
      source_employee_cost_rate_id: costRateId,
      reason: "범위 변경",
    };
    const second = await runHub(
      manager,
      "assignment.rate.snapshot",
      secondPayload,
      secondRequestId,
    );
    expect(second.error).toBeNull();
    expect(second.data.snapshot_no).toBe(2);
    const retry = await runHub(manager, "assignment.rate.snapshot", secondPayload, secondRequestId);
    expect(retry.error).toBeNull();
    expect(retry.data).toEqual(second.data);

    const snapshots = await sql`
      select snapshot_no,planned_mm,monthly_billing_rate
      from public.project_assignment_rates where assignment_id=${assignmentId} order by snapshot_no`;
    expect(snapshots).toMatchObject([
      { snapshot_no: 1, planned_mm: "2.50", monthly_billing_rate: "8000000.00" },
      { snapshot_no: 2, planned_mm: "3.00", monthly_billing_rate: "8500000.00" },
    ]);
    expect(
      (await sql`select planned_mm from public.project_assignments where id=${assignmentId}`)[0]
        .planned_mm,
    ).toBe("3.00");
    expect(
      (
        await employee
          .from("project_assignment_rates")
          .select("id")
          .eq("assignment_id", assignmentId)
      ).data,
    ).toEqual([]);
  });

  it("versions project documents, applies RLS, and rejects direct writes", async () => {
    const registered = await runHub(manager, "document.register", {
      project_id: projectId,
      title: "통합 테스트 산출물",
      category: "DELIVERABLE",
      file_name: "deliverable.pdf",
      storage_key: `${projectId}/${crypto.randomUUID()}/deliverable.pdf`,
      mime_type: "application/pdf",
      size_bytes: 1024,
      sha256: "a".repeat(64),
    });
    expect(registered.error).toBeNull();
    previousDocumentId = registered.data.id;

    const replacement = await runHub(manager, "document.register", {
      id: previousDocumentId,
      project_id: projectId,
      title: "통합 테스트 산출물",
      category: "COMPLETION_REPORT",
      file_name: "deliverable-v2.pdf",
      storage_key: `${projectId}/${crypto.randomUUID()}/deliverable-v2.pdf`,
      mime_type: "application/pdf",
      size_bytes: 2048,
      sha256: "c".repeat(64),
    });
    expect(replacement.error).toBeNull();
    documentId = replacement.data.id;

    expect(
      (
        await employee
          .from("documents")
          .select("id,title,document_version,archived_at")
          .in("id", [previousDocumentId, documentId])
          .order("document_version")
      ).data,
    ).toMatchObject([
      { id: previousDocumentId, title: "통합 테스트 산출물", document_version: 1 },
      { id: documentId, title: "통합 테스트 산출물", document_version: 2, archived_at: null },
    ]);
    expect(
      (await sql`select archived_at from public.documents where id=${previousDocumentId}`)[0]
        .archived_at,
    ).toBeTruthy();
    const directWrite = await employee.from("documents").insert({
      title: "우회 등록",
      category: "OTHER",
      file_name: "bypass.pdf",
      storage_key: `${projectId}/${crypto.randomUUID()}/bypass.pdf`,
      mime_type: "application/pdf",
      size_bytes: 1,
      sha256: "b".repeat(64),
      uploaded_by: employeeId,
    });
    expect(directWrite.error?.code).toBe("42501");
  });

  it("links inspections to milestones and evidence with optimistic locking", async () => {
    const milestone = await manager.rpc("project_resource_command", {
      p_action: "project_milestone.save",
      p_payload: {
        project_id: projectId,
        name: "UAT",
        planned_date: "2026-12-10",
        completed_date: "",
        status: "PLANNED",
        description: "고객 인수 테스트",
      },
      p_request_id: crypto.randomUUID(),
    });
    expect(milestone.error).toBeNull();
    milestoneId = milestone.data.id;

    const base = {
      project_id: projectId,
      milestone_id: milestoneId,
      document_id: documentId,
      inspection_type: "ACCEPTANCE",
      title: "고객 UAT 검수",
      requested_date: "2026-12-01",
      scheduled_date: "2026-12-10",
      completed_date: "",
      customer_contact_name: "고객 담당자",
      customer_contact_email: "customer@example.com",
      status: "SCHEDULED",
      result: "PENDING",
      note: "UAT 기준 확인",
    };
    const created = await runHub(manager, "inspection.save", base);
    expect(created.error).toBeNull();
    inspectionId = created.data.id;
    expect(
      (await employee.from("inspections").select("id,status").eq("id", inspectionId)).data,
    ).toEqual([{ id: inspectionId, status: "SCHEDULED" }]);

    const completed = await runHub(manager, "inspection.save", {
      ...base,
      id: inspectionId,
      version: 1,
      completed_date: "2026-12-10",
      status: "COMPLETED",
      result: "PASSED",
      note: "최종 통과",
    });
    expect(completed.error).toBeNull();
    expect(
      (await sql`select status,result,version from public.inspections where id=${inspectionId}`)[0],
    ).toMatchObject({
      status: "COMPLETED",
      result: "PASSED",
      version: 2,
    });

    const stale = await runHub(manager, "inspection.save", {
      ...base,
      id: inspectionId,
      version: 1,
    });
    expect(stale.error?.code).toBe("40001");

    expect((await runHub(manager, "document.archive", { id: documentId })).error).toBeNull();
    expect(
      (await sql`select archived_at from public.documents where id=${documentId}`)[0].archived_at,
    ).toBeTruthy();
  });
});
