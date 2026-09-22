import assert from "node:assert/strict";
import { createServerClient } from "@supabase/ssr";
import postgres from "postgres";
const base = process.env.APP_URL!;
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("HTTP verification is local only.");
const headers = { "Content-Type": "application/json", Origin: new URL(base).origin };
async function session(email: string) {
  const jar = new Map<string, string>();
  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (values) => values.forEach(({ name, value }) => jar.set(name, value)),
      },
    },
  );
  const { error } = await auth.auth.signInWithPassword({
    email,
    password: process.env.SEED_PASSWORD!,
  });
  if (error) throw error;
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}
const employeeCookie = await session("employee@digitalsquare.local");
const adminCookie = await session("admin@digitalsquare.local");
let passed = 0;
async function check(path: string, init: RequestInit, expected: number) {
  const response = await fetch(`${base}${path}`, { ...init, redirect: "manual" });
  assert.equal(response.status, expected, `${path}: expected ${expected}, got ${response.status}`);
  passed++;
  return response;
}
await check("/api/admin/users", {}, 401);
const denied = await check("/api/admin/users", { headers: { Cookie: employeeCookie } }, 403);
assert.equal((await denied.json()).error.code, "Forbidden");
await check("/api/admin/users", { headers: { Cookie: adminCookie } }, 200);
await check(
  "/api/management",
  {
    method: "POST",
    headers: { ...headers, Cookie: employeeCookie },
    body: JSON.stringify({
      action: "role.assign",
      payload: {
        id: "20000000-0000-4000-8000-000000000001",
        role_ids: ["20000000-0000-4000-8000-000000000001"],
      },
    }),
  },
  403,
);
await check(
  "/api/management",
  {
    method: "POST",
    headers: { ...headers, Cookie: adminCookie, Origin: "https://attacker.invalid" },
    body: "{}",
  },
  403,
);
await check(
  "/api/management",
  { method: "POST", headers: { ...headers, Cookie: adminCookie }, body: "{" },
  400,
);
await check(
  "/api/management",
  {
    method: "POST",
    headers: { ...headers, Cookie: adminCookie },
    body: JSON.stringify({
      action: "profile.update",
      payload: { version: 1, user_status: "ACTIVE" },
    }),
  },
  400,
);
const dashboard = await check("/dashboard", { headers: { Cookie: employeeCookie } }, 200);
assert.ok((await dashboard.text()).includes("Employee"));
const dbUrl = process.env.TEST_DATABASE_URL!;
if (!["localhost", "127.0.0.1"].includes(new URL(dbUrl).hostname))
  throw new Error("Test DB must be local.");
const sql = postgres(dbUrl, { max: 1 });
const email = `http-${crypto.randomUUID()}@digitalsquare.local`;
try {
  const created = await check(
    "/api/admin/users",
    {
      method: "POST",
      headers: { ...headers, Cookie: adminCookie },
      body: JSON.stringify({
        email,
        password: process.env.SEED_PASSWORD,
        name: "HTTP verification",
        employee_number: `HTTP-${Date.now()}`,
        join_date: "2026-01-01",
        organization_id: "10000000-0000-4000-8000-000000000004",
        employment_type: "FULL_TIME",
        position_id: "",
        title_id: "",
        phone: "",
      }),
    },
    201,
  );
  const { data } = await created.json();
  const rows = await sql`select user_status from public.employees where id=${data.id}`;
  assert.equal(rows[0].user_status, "ACTIVE");
} finally {
  const rows = await sql`select id from public.employees where email=${email}`;
  for (const row of rows) {
    await sql`delete from public.email_delivery_attempts where outbox_id in (
      select id from public.notification_outbox where recipient_user_id=${row.id}
    )`;
    await sql`delete from public.notification_outbox where recipient_user_id=${row.id}`;
    await sql`delete from public.notifications where user_id=${row.id}`;
    await sql`delete from public.user_roles where user_id=${row.id}`;
    await sql`delete from public.audit_logs where actor_user_id=${row.id} or entity_id=${row.id}`;
    await sql`delete from public.employees where id=${row.id}`;
    await sql`delete from auth.users where id=${row.id}`;
  }
  await sql.end();
}
console.log(
  `${passed} production HTTP checks passed (Auth cookie, admin boundary, CSRF, validation, dashboard).`,
);
