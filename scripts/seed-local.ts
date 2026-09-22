import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const databaseUrl = process.env.TEST_DATABASE_URL!;
if (
  !url ||
  !databaseUrl ||
  !["127.0.0.1", "localhost"].includes(new URL(url).hostname) ||
  !["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname)
)
  throw new Error("Local seed requires loopback Supabase and PostgreSQL URLs.");
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 12)
  throw new Error("Set SEED_PASSWORD (12+ characters) in .env.local.");
const auth = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sql = postgres(databaseUrl, { max: 1 });
const users = [
  {
    email: "admin@digitalsquare.local",
    name: "Admin",
    number: "DS-001",
    role: "ADMIN",
    org: "10000000-0000-4000-8000-000000000005",
  },
  {
    email: "manager@digitalsquare.local",
    name: "Team Manager",
    number: "DS-002",
    role: "TEAM_MANAGER",
    org: "10000000-0000-4000-8000-000000000004",
  },
  {
    email: "employee@digitalsquare.local",
    name: "Employee",
    number: "DS-003",
    role: "EMPLOYEE",
    org: "10000000-0000-4000-8000-000000000004",
  },
];
let seedAdminId: string | undefined;
let seedManagerId: string | undefined;
let seedEmployeeId: string | undefined;
try {
  for (const user of users) {
    const existing = await sql`select id from public.employees where email=${user.email}`;
    let id = existing[0]?.id as string | undefined;
    if (!id) {
      const { data, error } = await auth.auth.admin.createUser({
        email: user.email,
        password,
        email_confirm: true,
        user_metadata: { name: user.name },
      });
      if (error) throw error;
      id = data.user.id;
    }
    if (user.role === "ADMIN") seedAdminId = id;
    if (user.role === "TEAM_MANAGER") seedManagerId = id;
    if (user.role === "EMPLOYEE") seedEmployeeId = id;
    await sql.begin(async (tx) => {
      await tx`update public.employees set employee_number=${user.number},join_date='2026-01-01',organization_id=${user.org},user_status='ACTIVE',position_id=(select id from public.positions where code='STAFF') where id=${id!}`;
      await tx`insert into public.user_roles(user_id,role_id) select ${id!},id from public.roles where code in (${user.role},'EMPLOYEE') on conflict do nothing`;
      const policyId =
        user.role === "EMPLOYEE"
          ? "30000000-0000-4000-8000-000000000002"
          : "30000000-0000-4000-8000-000000000001";
      await tx`insert into public.user_work_policy_assignments(user_id,work_policy_id,effective_from,assigned_by)
        select ${id!},${policyId},'2026-01-01',${seedAdminId ?? id!}
        where not exists(select 1 from public.user_work_policy_assignments where user_id=${id!})`;
      await tx`insert into public.leave_balance_entries(user_id,leave_type,amount,entry_type,event_key,memo,created_by)
        values(${id!},'ANNUAL',15,'GRANT',${`seed:${id}:annual:2026`},'2026 개발환경 연차 부여',${seedAdminId ?? id!})
        on conflict(event_key) do nothing`;
      if (user.role === "TEAM_MANAGER")
        await tx`update public.organizations set leader_user_id=${id!} where id=${user.org}`;
    });
  }
  if (!seedAdminId || !seedManagerId || !seedEmployeeId)
    throw new Error("Seed identities were not resolved.");
  const adminSeedId = seedAdminId;
  const managerSeedId = seedManagerId;
  const employeeSeedId = seedEmployeeId;
  await sql.begin(async (tx) => {
    await tx`insert into public.user_roles(user_id,role_id,granted_by)
      select ${managerSeedId},id,${adminSeedId} from public.roles where code='PROJECT_MANAGER'
      on conflict do nothing`;
    await tx`insert into public.projects(
      id,project_code,project_name,customer_name,description,planned_start_date,planned_end_date,
      actual_start_date,status,project_manager_id,created_by
    ) values
      ('50000000-0000-4000-8000-000000000001','DS-PJT-001','디지털 업무혁신 플랫폼','Digital Square','사내 업무 통합 프로젝트','2026-01-01','2026-12-31','2026-01-15','IN_PROGRESS',${managerSeedId},${adminSeedId}),
      ('50000000-0000-4000-8000-000000000002','DS-PJT-002','고객 포털 고도화','Sample Customer','고객 서비스 포털 개편','2026-10-01','2027-03-31',null,'SCHEDULED',${managerSeedId},${adminSeedId})
      on conflict(id) do nothing`;
    await tx`insert into public.project_assignments(
      id,project_id,user_id,project_role,planned_start_date,planned_end_date,actual_start_date,
      allocation_rate,status,memo,assigned_by
    ) values
      ('51000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',${employeeSeedId},'Frontend Developer','2026-01-15','2026-12-31','2026-01-15',50,'IN_PROGRESS','개발환경 현재 투입',${managerSeedId}),
      ('51000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002',${employeeSeedId},'Technical Lead','2026-10-01','2027-03-31',null,50,'CONFIRMED','개발환경 예정 투입',${managerSeedId})
      on conflict(id) do nothing`;
  });
  console.log(
    "Local Admin, Team Manager and Employee accounts are ready. Password remains in .env.local.",
  );
} finally {
  await sql.end();
}
