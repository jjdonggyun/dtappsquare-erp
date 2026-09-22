import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { loadEnvFile } from "node:process";
import postgres from "postgres";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const dbUrl = process.env.TEST_DATABASE_URL!;
if (
  !["127.0.0.1", "localhost"].includes(new URL(url).hostname) ||
  !["127.0.0.1", "localhost"].includes(new URL(dbUrl).hostname)
)
  throw new Error("Integration tests require a disposable local database.");
const sql = postgres(dbUrl, { max: 1 });
const clients: SupabaseClient[] = [];
const client = () => {
  const c = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  clients.push(c);
  return c;
};
let admin: SupabaseClient;
let employee: SupabaseClient;
let manager: SupabaseClient;
let requested: SupabaseClient;
let service: SupabaseClient;
let requestedId: string;
let adminId: string;
let employeeId: string;
let managerId: string;
let originalAttendanceSetting: unknown;
const testIds: string[] = [];
const createdOrganizations: string[] = [];
const createdPolicies: string[] = [];
const phase3EntityIds: string[] = [];
const phase4AssetIds: string[] = [];
const phase4AssignmentIds: string[] = [];
const phase4DeviceIds: string[] = [];
const phase5ProjectIds: string[] = [];
const phase5AssignmentIds: string[] = [];
const planningIds: {table:"project_tasks"|"project_milestones"|"project_issues";id:string}[] = [];
const command = (c: SupabaseClient, action: string, payload: unknown) =>
  c.rpc("management_command", {
    p_action: action,
    p_payload: payload,
    p_request_id: crypto.randomUUID(),
  });
async function profile(id: string) {
  return (await sql`select * from public.employees where id=${id}`)[0];
}
beforeAll(async () => {
  originalAttendanceSetting=(await sql`select value from public.company_settings where key='attendance.verification'`)[0]?.value;
  await sql`update public.company_settings set value='{"mode":"OFF"}'::jsonb where key='attendance.verification'`;
  admin = client();
  employee = client();
  manager = client();
  requested = client();
  service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const [c, email] of [
    [admin, "admin"],
    [employee, "employee"],
    [manager, "manager"],
  ] as const) {
    const { error } = await c.auth.signInWithPassword({
      email: `${email}@digitalsquare.local`,
      password: process.env.SEED_PASSWORD!,
    });
    if (error) throw error;
  }
  adminId = (await admin.auth.getUser()).data.user!.id;
  employeeId = (await employee.auth.getUser()).data.user!.id;
  managerId = (await manager.auth.getUser()).data.user!.id;
  const { data, error } = await requested.auth.signUp({
    email: `test-${crypto.randomUUID()}@digitalsquare.local`,
    password: process.env.SEED_PASSWORD!,
    options: { data: { name: "Integration Requested", user_status: "ACTIVE", role: "ADMIN" } },
  });
  if (error) throw error;
  requestedId = data.user!.id;
  testIds.push(requestedId);
  expect(data.session).toBeNull();
  expect(
    (
      await requested.auth.signInWithPassword({
        email: data.user!.email!,
        password: process.env.SEED_PASSWORD!,
      })
    ).error,
  ).not.toBeNull();
  const mailpit = process.env.TEST_MAILPIT_URL ?? "http://127.0.0.1:55324";
  if (!["localhost", "127.0.0.1"].includes(new URL(mailpit).hostname))
    throw new Error("Mailpit must be local.");
  let mailId: string | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    const inbox = (await (await fetch(`${mailpit}/api/v1/messages`)).json()) as {
      messages: { ID: string; To: { Address: string }[] }[];
    };
    mailId = inbox.messages.find((message) =>
      message.To.some((to) => to.Address === data.user!.email),
    )?.ID;
    if (mailId) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!mailId) throw new Error("Signup confirmation was not delivered to Mailpit.");
  const mail = (await (await fetch(`${mailpit}/api/v1/message/${mailId}`)).json()) as {
    HTML: string;
  };
  const confirmation = mail.HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1]?.replaceAll(
    "&amp;",
    "&",
  );
  if (!confirmation || !["localhost", "127.0.0.1"].includes(new URL(confirmation).hostname))
    throw new Error("Expected a local Auth confirmation URL.");
  const confirmed = await fetch(confirmation, { redirect: "manual" });
  expect([302, 303]).toContain(confirmed.status);
  const login = await requested.auth.signInWithPassword({
    email: data.user!.email!,
    password: process.env.SEED_PASSWORD!,
  });
  if (login.error) throw login.error;
});
afterAll(async () => {
  // Cleanup only IDs created by this suite; application history deletion remains denied.
  for (const {table,id} of planningIds.reverse()) {
    await sql`delete from public.audit_logs where entity_id=${id}`;
    await sql`delete from ${sql(table)} where id=${id}`;
  }
  for (const assignmentId of phase5AssignmentIds) {
    await sql`delete from public.email_delivery_attempts where outbox_id in (
      select o.id from public.notification_outbox o join public.notifications n on n.id=o.notification_id where n.reference_id=${assignmentId}
    )`;
    await sql`delete from public.notification_outbox where notification_id in (select id from public.notifications where reference_id=${assignmentId})`;
    await sql`delete from public.notifications where reference_id=${assignmentId}`;
  }
  for (const id of phase5AssignmentIds) await sql`delete from public.project_assignments where id=${id}`;
  for (const id of [...phase5AssignmentIds,...phase5ProjectIds])
    await sql`delete from public.audit_logs where entity_id=${id}`;
  for (const id of phase5ProjectIds) await sql`delete from public.projects where id=${id}`;
  for (const assignmentId of phase4AssignmentIds) {
    await sql`delete from public.email_delivery_attempts where outbox_id in (
      select o.id from public.notification_outbox o join public.notifications n on n.id=o.notification_id where n.reference_id=${assignmentId}
    )`;
    await sql`delete from public.notification_outbox where notification_id in (select id from public.notifications where reference_id=${assignmentId})`;
    await sql`delete from public.notifications where reference_id=${assignmentId}`;
  }
  for (const id of phase4DeviceIds) await sql`delete from public.registered_devices where id=${id}`;
  for (const id of phase4AssignmentIds) await sql`delete from public.asset_assignments where id=${id}`;
  for (const id of [...phase4DeviceIds,...phase4AssignmentIds,...phase4AssetIds])
    await sql`delete from public.audit_logs where entity_id=${id}`;
  for (const id of phase4AssetIds) await sql`delete from public.assets where id=${id}`;
  for (const id of createdOrganizations) await sql`delete from public.organizations where id=${id}`;
  for (const referenceId of phase3EntityIds) {
    await sql`delete from public.email_delivery_attempts where outbox_id in (
      select o.id from public.notification_outbox o join public.notifications n on n.id=o.notification_id where n.reference_id=${referenceId}
    )`;
    await sql`delete from public.notification_outbox where notification_id in (select id from public.notifications where reference_id=${referenceId})`;
    await sql`delete from public.notifications where reference_id=${referenceId}`;
  }
  for (const id of testIds) {
    await sql`delete from public.email_delivery_attempts where outbox_id in (select id from public.notification_outbox where recipient_user_id=${id})`;
    await sql`delete from public.notification_outbox where recipient_user_id=${id}`;
    await sql`delete from public.notifications where user_id=${id}`;
    await sql`delete from public.approval_request_steps where approval_request_id in (select id from public.approval_requests where requester_id=${id})`;
    await sql`delete from public.approval_requests where requester_id=${id}`;
    await sql`delete from public.leave_balance_entries where user_id=${id}`;
    await sql`delete from public.leave_requests where user_id=${id}`;
    for (const referenceId of phase3EntityIds)
      await sql`delete from public.approval_subjects where reference_id=${referenceId}`;
    await sql`delete from public.attendance_corrections where attendance_summary_id in (select id from public.attendance_daily_summaries where user_id=${id})`;
    await sql`delete from public.attendance_daily_summaries where user_id=${id}`;
    await sql`delete from public.attendance_events where user_id=${id}`;
    await sql`delete from public.user_work_policy_assignments where user_id=${id}`;
    await sql`delete from public.user_roles where user_id=${id}`;
    await sql`delete from public.audit_logs where actor_user_id=${id} or entity_id=${id}`;
    await sql`delete from public.employees where id=${id}`;
    await sql`delete from auth.users where id=${id}`;
  }
  for (const entityId of phase3EntityIds)
    await sql`delete from public.audit_logs where entity_id=${entityId}`;
  for (const id of createdPolicies) {
    await sql`delete from public.audit_logs where entity_id=${id}`;
    await sql`delete from public.work_policies where id=${id}`;
  }
  if(originalAttendanceSetting)await sql`update public.company_settings set value=${sql.json(originalAttendanceSetting as Parameters<typeof sql.json>[0])} where key='attendance.verification'`;
  await sql.end();
});
describe("real Supabase Auth, PostgreSQL RLS and RPC", () => {
  it("signup creates REQUESTED despite forged metadata", async () => {
    expect((await profile(requestedId)).user_status).toBe("REQUESTED");
    const { data, error } = await requested.rpc("account_context");
    expect(error).toBeNull();
    expect(data.permissions).toEqual([]);
  });
  it("REQUESTED cannot read business data", async () => {
    const { data, error } = await requested.from("employees").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await command(requested, "organization.save", {})).error?.code).toBe("42501");
  });
  it("anonymous caller cannot run management RPC", async () => {
    expect((await command(client(), "role.assign", {})).error).not.toBeNull();
  });
  it("employee cannot read others, mutate directly, or call admin commands", async () => {
    expect((await employee.from("employees").select("id").eq("id", adminId)).data).toEqual([]);
    expect(
      (await employee.from("employees").update({ user_status: "ACTIVE" }).eq("id", employeeId))
        .error?.code,
    ).toBe("42501");
    expect(
      (await command(employee, "role.assign", { id: employeeId, role_ids: [] })).error?.code,
    ).toBe("42501");
  });
  it("team leader sees own team but not HR", async () => {
    const { data, error } = await manager.from("employees").select("id");
    expect(error).toBeNull();
    expect(data?.map((r) => r.id)).toContain(employeeId);
    expect(data?.map((r) => r.id)).not.toContain(adminId);
  });
  it("public directory does not return private HR fields", async () => {
    const { data, error } = await employee.rpc("employee_directory");
    expect(error).toBeNull();
    expect(data[0]).not.toHaveProperty("phone");
    expect(data[0]).not.toHaveProperty("email");
  });
  it("admin approves REQUESTED to ACTIVE with baseline role and audit", async () => {
    const p = await profile(requestedId);
    const result = await command(admin, "employee.status", {
      id: requestedId,
      version: p.version,
      status: "ACTIVE",
      employee_number: `T-${Date.now()}`,
      join_date: "2026-01-01",
      organization_id: "10000000-0000-4000-8000-000000000004",
    });
    expect(result.error).toBeNull();
    expect((await profile(requestedId)).user_status).toBe("ACTIVE");
    const { data } = await requested.rpc("account_context");
    expect(data.permissions).toContain("PROFILE_READ_SELF");
    const logs =
      await sql`select * from public.audit_logs where entity_id=${requestedId} and action='UPDATE' order by created_at desc limit 1`;
    expect(logs[0].actor_user_id).toBe(adminId);
    expect(logs[0].before_data.user_status).toBe("REQUESTED");
    expect(logs[0].after_data.user_status).toBe("ACTIVE");
  });
  it("stale approval cannot execute twice", async () => {
    const p = await profile(requestedId);
    expect(
      (
        await command(admin, "employee.status", {
          id: requestedId,
          version: p.version - 1,
          status: "SUSPENDED",
        })
      ).error?.code,
    ).toBe("40001");
  });
  it("profile update cannot change protected fields via direct RPC", async () => {
    const p = await profile(requestedId);
    const { error } = await command(requested, "profile.update", {
      version: p.version,
      phone: "010-1234-5678",
      user_status: "ADMIN",
      employee_number: "HACK",
    });
    expect(error).toBeNull();
    expect((await profile(requestedId)).employee_number).not.toBe("HACK");
  });
  it("suspension takes effect without token refresh", async () => {
    let p = await profile(requestedId);
    expect(
      (
        await command(admin, "employee.status", {
          id: requestedId,
          version: p.version,
          status: "SUSPENDED",
        })
      ).error,
    ).toBeNull();
    expect((await requested.from("employees").select("id")).data).toEqual([]);
    p = await profile(requestedId);
    expect(
      (
        await command(admin, "employee.status", {
          id: requestedId,
          version: p.version,
          status: "ACTIVE",
        })
      ).error,
    ).toBeNull();
  });
  it("protects the final active ADMIN and rolls back role deletions", async () => {
    const { error } = await command(admin, "role.assign", { id: adminId, role_ids: [] });
    expect(error?.code).toBe("40001");
    expect((await admin.rpc("account_context")).data.permissions).toContain("RBAC_MANAGE");
  });
  it("rejects organization cycles", async () => {
    const { error } = await command(admin, "organization.save", {
      id: "10000000-0000-4000-8000-000000000002",
      name: "개발본부",
      organization_type: "DIVISION",
      parent_id: "10000000-0000-4000-8000-000000000004",
      leader_user_id: "",
      sort_order: 10,
      active: true,
    });
    expect(error?.code).toBe("40001");
  });
  it("creates and moves an organization with an audit", async () => {
    const { data, error } = await command(admin, "organization.save", {
      name: "Integration team",
      organization_type: "TEAM",
      parent_id: "10000000-0000-4000-8000-000000000002",
      leader_user_id: managerId,
      sort_order: 90,
      active: true,
    });
    expect(error).toBeNull();
    createdOrganizations.push(data.id);
    const move = await command(admin, "organization.save", {
      ...data,
      parent_id: "10000000-0000-4000-8000-000000000001",
    });
    expect(move.error).toBeNull();
    expect(
      (await sql`select id from public.audit_logs where entity_id=${data.id} and action='UPDATE'`)
        .length,
    ).toBe(1);
  });
  it("rejects disabling an occupied organization", async () => {
    const { error } = await command(admin, "organization.save", {
      id: "10000000-0000-4000-8000-000000000004",
      name: "Web팀",
      organization_type: "TEAM",
      parent_id: "10000000-0000-4000-8000-000000000002",
      sort_order: 20,
      active: false,
    });
    expect(error?.code).toBe("40001");
  });
  it("audit history is immutable through REST", async () => {
    expect((await admin.from("audit_logs").delete().eq("entity_id", requestedId)).error?.code).toBe(
      "42501",
    );
    expect((await employee.from("audit_logs").select("id")).data).toEqual([]);
  });
  it("preserves work-policy history and the original lateness decision", async () => {
    const code = `HISTORY_${Date.now()}`;
    const createPolicy = async (grace: number) => {
      const { data, error } = await admin.rpc("workforce_command", {
        p_action: "work_policy.create",
        p_payload: {
          code,
          name: `History ${grace}`,
          check_in_time: "09:00",
          check_out_time: "18:00",
          break_start: "12:00",
          break_end: "13:00",
          late_grace_minutes: grace,
          timezone: "Asia/Seoul",
          working_days: [1, 2, 3, 4, 5],
        },
        p_request_id: crypto.randomUUID(),
      });
      expect(error).toBeNull();
      createdPolicies.push(data.id);
      return data.id as string;
    };
    const first = await createPolicy(5);
    const second = await createPolicy(10);
    expect(
      (
        await admin.rpc("workforce_command", {
          p_action: "work_policy.assign",
          p_payload: {
            user_id: requestedId,
            work_policy_id: first,
            effective_from: "2026-01-01",
            effective_to: "2026-07-01",
          },
          p_request_id: crypto.randomUUID(),
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await admin.rpc("workforce_command", {
          p_action: "work_policy.assign",
          p_payload: {
            user_id: requestedId,
            work_policy_id: second,
            effective_from: "2026-07-01",
            effective_to: "",
          },
          p_request_id: crypto.randomUUID(),
        })
      ).error,
    ).toBeNull();
    await sql`insert into public.attendance_events(user_id,work_policy_id,work_date,event_type,occurred_at,verification_type,verification_status,idempotency_key)
      values(${requestedId},${first},'2026-06-15','CHECK_IN','2026-06-15 09:06 Asia/Seoul','WEB','VERIFIED',${crypto.randomUUID()})`;
    const [summary] =
      await sql`select (private.calculate_attendance_summary(${requestedId},'2026-06-15')).*`;
    expect(summary.attendance_status).toBe("LATE");
    expect(summary.policy_snapshot.version).toBe(1);
    const [versions] = await sql`select
      (private.policy_for_work_date(${requestedId},'2026-06-15')).version as old_version,
      (private.policy_for_work_date(${requestedId},'2026-08-15')).version as new_version`;
    expect(versions).toMatchObject({ old_version: 1, new_version: 2 });
    await expect(
      sql`update public.work_policies set late_grace_minutes=20 where id=${first}`,
    ).rejects.toMatchObject({ code: "40001" });
  });
  it("records idempotent attendance events and enforces RLS", async () => {
    const requestId = crypto.randomUUID();
    const first = await requested.rpc("attendance_command", {
      p_action: "attendance.check_in",
      p_payload: {},
      p_request_id: requestId,
    });
    expect(first.error).toBeNull();
    const duplicate = await requested.rpc("attendance_command", {
      p_action: "attendance.check_in",
      p_payload: {},
      p_request_id: requestId,
    });
    expect(duplicate.error).toBeNull();
    const [count] =
      await sql`select count(*)::integer as count from public.attendance_events where user_id=${requestedId} and idempotency_key=${requestId}`;
    expect(count.count).toBe(1);
    expect(
      (await employee.from("attendance_daily_summaries").select("id").eq("user_id", requestedId))
        .data,
    ).toEqual([]);
    expect(
      (await manager.from("attendance_daily_summaries").select("id").eq("user_id", requestedId))
        .data?.length,
    ).toBeGreaterThan(0);
    expect((await employee.from("attendance_events").insert({})).error?.code).toBe("42501");
  });
  it("keeps correction history and audits the administrator", async () => {
    const { error } = await admin.rpc("workforce_command", {
      p_action: "attendance.correct",
      p_payload: {
        user_id: requestedId,
        work_date: "2026-06-15",
        check_in_time: "09:00",
        check_out_time: "18:00",
        reason: "통합 테스트 관리자 보정",
      },
      p_request_id: crypto.randomUUID(),
    });
    expect(error).toBeNull();
    const [summary] =
      await sql`select attendance_status,worked_minutes from public.attendance_daily_summaries where user_id=${requestedId} and work_date='2026-06-15'`;
    expect(summary).toMatchObject({ attendance_status: "NORMAL", worked_minutes: 480 });
    const [correction] =
      await sql`select id from public.attendance_corrections where attendance_summary_id=(select id from public.attendance_daily_summaries where user_id=${requestedId} and work_date='2026-06-15')`;
    expect(correction.id).toBeTruthy();
    const [audit] =
      await sql`select actor_user_id from public.audit_logs where entity_type='attendance_corrections' and entity_id=${correction.id}`;
    expect(audit.actor_user_id).toBe(adminId);
  });
  it("creates a generic approval route and finalizes leave atomically", async () => {
    const grant = await admin.rpc("leave_approval_command", {
      p_action: "leave.balance.adjust",
      p_payload: {
        user_id: requestedId,
        leave_type: "ANNUAL",
        amount: 3,
        entry_type: "GRANT",
        memo: "통합 테스트 부여",
      },
      p_request_id: crypto.randomUUID(),
    });
    expect(grant.error).toBeNull();
    const created = await requested.rpc("leave_approval_command", {
      p_action: "leave.create",
      p_payload: {
        leave_type: "ANNUAL",
        start_date: "2026-10-05",
        end_date: "2026-10-05",
        reason: "통합 테스트 휴가",
      },
      p_request_id: crypto.randomUUID(),
    });
    expect(created.error).toBeNull();
    phase3EntityIds.push(created.data.id);
    const [draft] = await sql`select * from public.leave_requests where id=${created.data.id}`;
    expect(draft).toMatchObject({ status: "DRAFT", duration: "1.00" });
    const submitted = await requested.rpc("leave_approval_command", {
      p_action: "leave.submit",
      p_payload: { id: draft.id, version: draft.version },
      p_request_id: crypto.randomUUID(),
    });
    expect(submitted.error).toBeNull();
    phase3EntityIds.push(submitted.data.approval_request_id);
    const [request] = await sql`select * from public.approval_requests where id=${submitted.data.approval_request_id}`;
    const steps = await sql`select * from public.approval_request_steps where approval_request_id=${request.id} order by step_order`;
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ approver_id: managerId, status: "PENDING" });
    expect(request.route_snapshot[0].approver_id).toBe(managerId);
    const hiddenLeave = await employee.from("leave_requests").select("id").eq("id", draft.id);
    expect(hiddenLeave.error).toBeNull();
    expect(hiddenLeave.data).toEqual([]);
    expect(
      (
        await employee.rpc("leave_approval_command", {
          p_action: "approval.decide",
          p_payload: { id: request.id, version: request.version, decision: "APPROVED", comment: "" },
          p_request_id: crypto.randomUUID(),
        })
      ).error?.code,
    ).toBe("42501");
    const approved = await manager.rpc("leave_approval_command", {
      p_action: "approval.decide",
      p_payload: { id: request.id, version: request.version, decision: "APPROVED", comment: "승인" },
      p_request_id: crypto.randomUUID(),
    });
    expect(approved.error).toBeNull();
    const [finalLeave] = await sql`select status from public.leave_requests where id=${draft.id}`;
    const [finalApproval] = await sql`select status,version from public.approval_requests where id=${request.id}`;
    const [balance] = await sql`select sum(amount)::numeric as amount from public.leave_balance_entries where user_id=${requestedId} and leave_type='ANNUAL'`;
    const [attendance] = await sql`select attendance_status from public.attendance_daily_summaries where user_id=${requestedId} and work_date='2026-10-05'`;
    expect(finalLeave.status).toBe("APPROVED");
    expect(finalApproval.status).toBe("APPROVED");
    expect(balance.amount).toBe("2.00");
    expect(attendance.attendance_status).toBe("VACATION");
    expect(
      (
        await manager.rpc("leave_approval_command", {
          p_action: "approval.decide",
          p_payload: { id: request.id, version: request.version, decision: "APPROVED", comment: "duplicate" },
          p_request_id: crypto.randomUUID(),
        })
      ).error?.code,
    ).toBe("40001");
    const notifications = await sql`select type from public.notifications where reference_id in (${draft.id},${request.id})`;
    expect(notifications.map((row) => row.type)).toEqual(expect.arrayContaining(["LEAVE_APPROVAL_REQUEST", "LEAVE_APPROVED"]));
  });
  it("rejects leave, releases the reservation, and keeps email failure outside the business transaction", async () => {
    const created = await requested.rpc("leave_approval_command", {
      p_action: "leave.create",
      p_payload: { leave_type: "ANNUAL", start_date: "2026-10-06", end_date: "2026-10-06", reason: "반려 흐름 테스트" },
      p_request_id: crypto.randomUUID(),
    });
    expect(created.error).toBeNull();
    phase3EntityIds.push(created.data.id);
    const [draft] = await sql`select * from public.leave_requests where id=${created.data.id}`;
    const submitted = await requested.rpc("leave_approval_command", {
      p_action: "leave.submit",
      p_payload: { id: draft.id, version: draft.version },
      p_request_id: crypto.randomUUID(),
    });
    expect(submitted.error).toBeNull();
    phase3EntityIds.push(submitted.data.approval_request_id);
    const [request] = await sql`select * from public.approval_requests where id=${submitted.data.approval_request_id}`;
    expect(
      (
        await manager.rpc("leave_approval_command", {
          p_action: "approval.decide",
          p_payload: { id: request.id, version: request.version, decision: "REJECTED", comment: "일정 조정 필요" },
          p_request_id: crypto.randomUUID(),
        })
      ).error,
    ).toBeNull();
    const [rejected] = await sql`select status from public.leave_requests where id=${draft.id}`;
    const [balance] = await sql`select sum(amount)::numeric as amount from public.leave_balance_entries where user_id=${requestedId} and leave_type='ANNUAL'`;
    expect(rejected.status).toBe("REJECTED");
    expect(balance.amount).toBe("2.00");

    expect((await employee.rpc("claim_notification_outbox")).error?.code).toBe("42501");
    const claimed = await service.rpc("claim_notification_outbox");
    expect(claimed.error).toBeNull();
    expect(claimed.data?.length).toBe(1);
    const job = claimed.data![0];
    const completion = await service.rpc("complete_notification_outbox", {
      p_id: job.id,
      p_success: false,
      p_provider: "TEST",
      p_provider_message_id: undefined,
      p_error_code: "PROVIDER_UNAVAILABLE",
    });
    expect(completion.error).toBeNull();
    const [attempt] = await sql`select status,error_code from public.email_delivery_attempts where outbox_id=${job.id}`;
    expect(attempt).toMatchObject({ status: "FAILED", error_code: "PROVIDER_UNAVAILABLE" });
    expect((await sql`select status from public.leave_requests where id=${draft.id}`)[0].status).toBe("REJECTED");
  });
  it("creates, assigns and returns an asset while preserving assignment history", async () => {
    const assetCode = `T-LT-${Date.now()}`;
    const created = await admin.rpc("asset_device_command", {
      p_action: "asset.save",
      p_payload: {
        asset_code: assetCode,
        asset_type: "LAPTOP",
        manufacturer: "Test",
        model: "IntegrationBook",
        serial_number: `SERIAL-${Date.now()}`,
        purchase_date: "2026-01-01",
        warranty_end_date: "2029-01-01",
        status: "AVAILABLE",
        memo: "integration asset",
      },
      p_request_id: crypto.randomUUID(),
    });
    expect(created.error).toBeNull();
    phase4AssetIds.push(created.data.id);
    expect(
      (
        await employee.rpc("asset_device_command", {
          p_action: "asset.save",
          p_payload: { asset_code: "DENIED", asset_type: "LAPTOP", status: "AVAILABLE" },
          p_request_id: crypto.randomUUID(),
        })
      ).error?.code,
    ).toBe("42501");
    const assigned = await admin.rpc("asset_device_command", {
      p_action: "asset.assign",
      p_payload: { asset_id: created.data.id, user_id: requestedId, assigned_at: "", memo: "테스트 지급" },
      p_request_id: crypto.randomUUID(),
    });
    expect(assigned.error).toBeNull();
    phase4AssignmentIds.push(assigned.data.id);
    expect((await sql`select status from public.assets where id=${created.data.id}`)[0].status).toBe("ASSIGNED");
    expect((await requested.from("assets").select("id").eq("id", created.data.id)).data).toHaveLength(1);
    expect((await requested.from("asset_assignments").select("id").eq("id", assigned.data.id)).data).toHaveLength(1);
    expect((await employee.from("assets").select("id").eq("id", created.data.id)).data).toEqual([]);
    expect(
      (
        await admin.rpc("asset_device_command", {
          p_action: "asset.assign",
          p_payload: { asset_id: created.data.id, user_id: employeeId, assigned_at: "", memo: "중복" },
          p_request_id: crypto.randomUUID(),
        })
      ).error?.code,
    ).toBe("40001");
    const returned = await admin.rpc("asset_device_command", {
      p_action: "asset.return",
      p_payload: { assignment_id: assigned.data.id, returned_at: "", return_condition: "정상", memo: "반납 완료" },
      p_request_id: crypto.randomUUID(),
    });
    expect(returned.error).toBeNull();
    const [history] = await sql`select returned_at,return_condition from public.asset_assignments where id=${assigned.data.id}`;
    expect(history.returned_at).toBeTruthy();
    expect(history.return_condition).toBe("정상");
    expect((await sql`select status from public.assets where id=${created.data.id}`)[0].status).toBe("RETURNED");
    const audits = await sql`select action,actor_user_id from public.audit_logs where entity_id=${assigned.data.id} order by created_at`;
    expect(audits.map((row) => row.action)).toEqual(["INSERT", "UPDATE"]);
    expect(audits.every((row) => row.actor_user_id === adminId)).toBe(true);
    expect((await sql`select type from public.notifications where reference_id=${assigned.data.id}`).map((row) => row.type)).toEqual(
      expect.arrayContaining(["ASSET_ASSIGNED", "ASSET_RETURNED"]),
    );
  });
  it("authenticates device-agent heartbeat with a one-way token hash", async () => {
    const assetId = phase4AssetIds[0];
    const token = "integration-device-token-00000000000000000000";
    const registered = await admin.rpc("asset_device_command", {
      p_action: "device.register",
      p_payload: {
        asset_id: assetId,
        device_id: crypto.randomUUID(),
        hostname: "integration-laptop",
        serial_number: `DEVICE-${Date.now()}`,
        mac_address: "00:11:22:33:44:55",
        os: "Windows 11",
        device_token: token,
      },
      p_request_id: crypto.randomUUID(),
    });
    expect(registered.error).toBeNull();
    phase4DeviceIds.push(registered.data.id);
    expect(
      (
        await employee.rpc("device_agent_heartbeat", {
          p_device_id: registered.data.device_id,
          p_device_token: token,
          p_payload: {},
        })
      ).error?.code,
    ).toBe("42501");
    expect(
      (
        await service.rpc("device_agent_heartbeat", {
          p_device_id: registered.data.device_id,
          p_device_token: "wrong-token-000000000000000000000000",
          p_payload: {},
        })
      ).error?.code,
    ).toBe("28000");
    const heartbeat = await service.rpc("device_agent_heartbeat", {
      p_device_id: registered.data.device_id,
      p_device_token: token,
      p_payload: { hostname: "integration-laptop-2", os: "Windows 11 25H2" },
    });
    expect(heartbeat.error).toBeNull();
    const [device] = await sql`select hostname,os,last_seen_at,device_token_hash from public.registered_devices where id=${registered.data.id}`;
    expect(device).toMatchObject({ hostname: "integration-laptop-2", os: "Windows 11 25H2" });
    expect(device.last_seen_at).toBeTruthy();
    expect(String(device.device_token_hash)).not.toContain(token);
  });
  it("manages project assignments and returns a non-blocking over-allocation warning", async () => {
    const createProject = async (suffix: string) => {
      const result = await manager.rpc("project_resource_command", {
        p_action: "project.save",
        p_payload: {
          project_code: `T-PJT-${suffix}-${Date.now()}`,
          project_name: `Integration Project ${suffix}`,
          customer_name: "Test Customer",
          description: "integration",
          planned_start_date: "2026-11-01",
          planned_end_date: "2027-01-31",
          actual_start_date: "",
          actual_end_date: "",
          status: "SCHEDULED",
          project_manager_id: managerId,
        },
        p_request_id: crypto.randomUUID(),
      });
      expect(result.error).toBeNull();
      phase5ProjectIds.push(result.data.id);
      return result.data.id as string;
    };
    const firstProject = await createProject("A");
    const secondProject = await createProject("B");
    expect(
      (
        await employee.rpc("project_resource_command", {
          p_action: "project.save",
          p_payload: {},
          p_request_id: crypto.randomUUID(),
        })
      ).error?.code,
    ).toBe("42501");
    const assign = async (projectId: string, allocationRate: number) => {
      const result = await manager.rpc("project_resource_command", {
        p_action: "project_assignment.save",
        p_payload: {
          project_id: projectId,
          user_id: requestedId,
          project_role: "Developer",
          planned_start_date: "2026-11-01",
          planned_end_date: "2027-01-31",
          actual_start_date: "",
          actual_end_date: "",
          allocation_rate: allocationRate,
          status: "CONFIRMED",
          memo: "integration assignment",
        },
        p_request_id: crypto.randomUUID(),
      });
      expect(result.error).toBeNull();
      phase5AssignmentIds.push(result.data.id);
      return result.data;
    };
    expect((await assign(firstProject, 60)).peak_allocation).toBe(60);
    const over = await assign(secondProject, 50);
    expect(over).toMatchObject({ peak_allocation: 110, over_allocated: true });
    expect((await requested.from("projects").select("id").in("id", [firstProject, secondProject])).data).toHaveLength(2);
    expect((await employee.from("projects").select("id").in("id", [firstProject, secondProject])).data).toEqual([]);
    const [assignment] = await sql`select * from public.project_assignments where id=${phase5AssignmentIds[0]}`;
    const ended = await manager.rpc("project_resource_command", {
      p_action: "project_assignment.save",
      p_payload: {
        id: assignment.id,
        version: assignment.version,
        project_id: assignment.project_id,
        user_id: assignment.user_id,
        project_role: assignment.project_role,
        planned_start_date: assignment.planned_start_date,
        planned_end_date: assignment.planned_end_date,
        actual_start_date: "2026-11-01",
        actual_end_date: "2026-12-15",
        allocation_rate: 60,
        status: "ENDED",
        memo: "철수",
      },
      p_request_id: crypto.randomUUID(),
    });
    expect(ended.error).toBeNull();
    expect((await sql`select status from public.project_assignments where id=${assignment.id}`)[0].status).toBe("ENDED");
    expect((await sql`select type from public.notifications where reference_id=${phase5AssignmentIds[1]}`)[0].type).toBe("PROJECT_ASSIGNED");
    expect((await sql`select actor_user_id from public.audit_logs where entity_id=${assignment.id} order by created_at desc limit 1`)[0].actor_user_id).toBe(managerId);
  });
  it("persists batch staffing, WBS, milestones, issues and capacity", async () => {
    const projectId=phase5ProjectIds[0];
    const call=async(action:string,payload:Record<string,unknown>)=>manager.rpc("project_resource_command",{
      p_action:action,p_payload:payload,p_request_id:crypto.randomUUID(),
    });
    const batch=await call("project_assignment.batch",{
      project_id:projectId,user_ids:[employeeId,requestedId],project_role:"QA",
      planned_start_date:"2026-12-01",planned_end_date:"2026-12-31",allocation_rate:20,
      status:"PLANNED",actual_start_date:"",actual_end_date:"",memo:"batch",
    });
    expect(batch.error).toBeNull();expect(batch.data.results).toHaveLength(2);
    for(const result of batch.data.results)phase5AssignmentIds.push(result.id);
    expect(typeof batch.data.over_allocated).toBe("boolean");
    const base={project_id:projectId,planned_start_date:"2026-12-01",planned_end_date:"2026-12-31",
      actual_start_date:"",actual_end_date:"",description:"integration"};
    const parent=await call("project_task.save",{...base,title:"Development",parent_id:"",assignee_id:employeeId,
      status:"IN_PROGRESS",priority:"HIGH",progress:0});
    expect(parent.error).toBeNull();planningIds.push({table:"project_tasks",id:parent.data.id});
    const child=await call("project_task.save",{...base,title:"Backend",parent_id:parent.data.id,assignee_id:employeeId,
      status:"IN_PROGRESS",priority:"MEDIUM",progress:45});
    expect(child.error).toBeNull();planningIds.push({table:"project_tasks",id:child.data.id});
    const milestone=await call("project_milestone.save",{project_id:projectId,name:"UAT",planned_date:"2026-12-20",
      completed_date:"",status:"PLANNED",description:"acceptance"});
    expect(milestone.error).toBeNull();planningIds.push({table:"project_milestones",id:milestone.data.id});
    const issue=await call("project_issue.save",{project_id:projectId,kind:"RISK",title:"Dependency",
      description:"external",assignee_id:employeeId,priority:"HIGH",status:"OPEN",target_date:"2026-12-25",resolved_date:""});
    expect(issue.error).toBeNull();planningIds.push({table:"project_issues",id:issue.data.id});
    const [taskRow]=await sql`select version from public.project_tasks where id=${child.data.id}`;
    const taskUpdate=await call("project_task.save",{...base,id:child.data.id,version:taskRow.version,title:"Backend",
      parent_id:parent.data.id,assignee_id:employeeId,status:"DONE",priority:"MEDIUM",progress:100});
    expect(taskUpdate.error).toBeNull();
    expect((await sql`select progress from public.project_tasks where id=${child.data.id}`)[0].progress).toBe("100.00");
    const [issueRow]=await sql`select version from public.project_issues where id=${issue.data.id}`;
    const issueUpdate=await call("project_issue.save",{project_id:projectId,id:issue.data.id,version:issueRow.version,
      kind:"RISK",title:"Dependency",description:"resolved",assignee_id:employeeId,priority:"HIGH",
      status:"RESOLVED",target_date:"2026-12-25",resolved_date:"2026-12-24"});
    expect(issueUpdate.error).toBeNull();
    const [project]=await sql`select version from public.projects where id=${projectId}`;
    const progress=await call("project.progress",{project_id:projectId,version:project.version,actual_progress:45});
    expect(progress.error).toBeNull();
    const capacity=await manager.rpc("resource_capacity",{p_start:"2026-12-01",p_end:"2026-12-31",p_granularity:"range"});
    expect(capacity.error).toBeNull();
    expect(capacity.data.find((row:{user_id:string})=>row.user_id===employeeId).peak_allocation).toBeGreaterThanOrEqual(20);
    expect((await manager.from("project_tasks").select("id").eq("project_id",projectId)).data).toHaveLength(2);
    expect((await employee.from("project_issues").select("id").eq("project_id",projectId)).data?.length).toBeGreaterThanOrEqual(0);
  });
  it("switches allocation enforcement from warning to transaction blocking", async () => {
    const [setting] = await sql`select * from public.company_settings where key='project.allocation'`;
    expect((await employee.from("company_settings").select("key")).data).toEqual([]);
    const blockedMode = await admin.rpc("system_setting_command", {
      p_key: "project.allocation",
      p_value: { mode: "BLOCK" },
      p_version: setting.version,
      p_request_id: crypto.randomUUID(),
    });
    expect(blockedMode.error).toBeNull();
    const blocked = await manager.rpc("project_resource_command", {
      p_action: "project_assignment.save",
      p_payload: {
        project_id: phase5ProjectIds[0],
        user_id: requestedId,
        project_role: "Reviewer",
        planned_start_date: "2026-11-01",
        planned_end_date: "2027-01-31",
        actual_start_date: "",
        actual_end_date: "",
        allocation_rate: 60,
        status: "CONFIRMED",
        memo: "must be blocked",
      },
      p_request_id: crypto.randomUUID(),
    });
    expect(blocked.error?.code).toBe("40001");
    const [blockedSetting] = await sql`select version from public.company_settings where key='project.allocation'`;
    const warningMode = await admin.rpc("system_setting_command", {
      p_key: "project.allocation",
      p_value: { mode: "WARN" },
      p_version: blockedSetting.version,
      p_request_id: crypto.randomUUID(),
    });
    expect(warningMode.error).toBeNull();
    const [current] = await sql`select * from public.company_settings where key='project.allocation'`;
    expect(
      (
        await admin.rpc("system_setting_command", {
          p_key: "project.allocation",
          p_value: { mode: "WARN" },
          p_version: current.version,
          p_request_id: crypto.randomUUID(),
        })
      ).error,
    ).toBeNull();
    const [audit] = await sql`select actor_user_id from public.audit_logs where entity_type='company_settings' and entity_id='project.allocation' order by created_at desc limit 1`;
    expect(audit.actor_user_id).toBe(adminId);
  });
  it("every public business table has RLS and no anonymous function execute", async () => {
    const tables =
      await sql`select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`;
    expect(tables.every((t) => t.relrowsecurity)).toBe(true);
    const fns =
      await sql`select n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and has_function_privilege('anon',p.oid,'EXECUTE')`;
    expect(fns).toHaveLength(0);
  });
});
