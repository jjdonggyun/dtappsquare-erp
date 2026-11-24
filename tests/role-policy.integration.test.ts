import { loadEnvFile } from "node:process";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

loadEnvFile(".env.local");
const dbUrl = process.env.TEST_DATABASE_URL!;
if (!["127.0.0.1", "localhost"].includes(new URL(dbUrl).hostname))
  throw new Error("Role policy integration tests require a local database.");
const sql = postgres(dbUrl, { max: 1 });
const rollback = new Error("ROLLBACK_ROLE_POLICY_TEST");

async function userId(email: string) {
  const [row] = await sql`select id from public.employees where email=${email}`;
  if (!row) throw new Error(`Seed account missing: ${email}`);
  return String(row.id);
}

async function asUser(tx: postgres.TransactionSql, id: string) {
  await tx.unsafe("set local role authenticated");
  await tx`select set_config('request.jwt.claim.sub',${id},true)`;
  const [identity] = await tx`select auth.uid() as id`;
  expect(identity.id).toBe(id);
}

async function rolledBack(callback: (tx: postgres.TransactionSql) => Promise<void>) {
  try {
    await sql.begin(async (tx) => { await callback(tx); throw rollback; });
  } catch (error) {
    if (error !== rollback) {
      if (error && typeof error === "object" && "where" in error)
        throw new Error(`${"message" in error ? String(error.message) : "Query failed"}\n${String(error.where)}`);
      throw error;
    }
  }
}

describe("business role and approval policy", () => {
  it("keeps Guest access to their profile while hiding ERP data", async () => {
    const employee = await userId("employee@digitalsquare.local");
    await rolledBack(async (tx) => {
      await tx`delete from public.user_roles where user_id=${employee}`;
      await tx`insert into public.user_roles(user_id,role_id)
        select ${employee},id from public.roles where code='GUEST'`;
      await asUser(tx, employee);
      const [context] = await tx`select public.account_context() as value`;
      expect(context.value.roles).toContain("GUEST");
      expect(context.value.permissions).not.toContain("PROJECT_READ_SELF");
      const [visible] = await tx`select
        (select count(*)::int from public.projects) projects,
        (select count(*)::int from public.customers) customers,
        (select count(*)::int from public.employees) employees`;
      expect(visible).toMatchObject({ projects: 0, customers: 0, employees: 1 });
    });
  });

  it("allows a Team Leader to activate a Member in their managed team", async () => {
    const employee = await userId("employee@digitalsquare.local");
    const manager = await userId("manager@digitalsquare.local");
    await rolledBack(async (tx) => {
      await tx`update public.employees set user_status='REQUESTED' where id=${employee}`;
      const [target] = await tx`select e.version,o.id organization_id from public.employees e
        join public.organizations o on o.id=e.organization_id where e.id=${employee}`;
      await asUser(tx, manager);
      const [result] = await tx`select public.management_command('employee.status',
        ${sql.json({ id: employee, version: target.version, status: "ACTIVE", organization_id: target.organization_id, role_code: "MEMBER" })}::jsonb,
        ${crypto.randomUUID()}) as value`;
      expect(result.value.user_status).toBe("ACTIVE");
      await tx.unsafe("set local role postgres");
      const roles = await tx`select r.code from public.user_roles ur join public.roles r on r.id=ur.role_id
        where ur.user_id=${employee}`;
      expect(roles.map((row) => row.code)).toContain("MEMBER");
    });
  });

  it("blocks a Team Leader from activating an account in another team", async () => {
    const employee = await userId("employee@digitalsquare.local");
    const manager = await userId("manager@digitalsquare.local");
    await rolledBack(async (tx) => {
      const [otherTeam] = await tx`select id from public.organizations where name='경영지원팀'`;
      await tx`update public.employees set user_status='REQUESTED',organization_id=${otherTeam.id} where id=${employee}`;
      const [target] = await tx`select version from public.employees where id=${employee}`;
      await asUser(tx, manager);
      const [directory] = await tx`select count(*)::int visible from public.employees where id=${employee}`;
      expect(directory.visible).toBe(0);
      await expect(tx`select public.management_command('employee.status',
        ${sql.json({ id: employee, version: target.version, status: "ACTIVE", organization_id: otherTeam.id, role_code: "MEMBER" })}::jsonb,
        ${crypto.randomUUID()})`).rejects.toMatchObject({ code: "42501" });
    });
  });

  it("inherits permissions and honors a user-specific denial", async () => {
    const admin = await userId("admin@digitalsquare.local");
    const employee = await userId("employee@digitalsquare.local");
    await rolledBack(async (tx) => {
      await asUser(tx, admin);
      const [changed] = await tx`select public.user_permission_command(
        ${employee},'PROJECT_READ_SELF','deny',null,${crypto.randomUUID()}) as result`;
      expect(changed.result.action).toBe("deny");
      await tx`select set_config('request.jwt.claim.sub',${employee},true)`;
      const [account] = await tx`select public.account_context() as context`;
      expect(account.context.roles).toContain("MEMBER");
      expect(account.context.permissions).toContain("LEAVE_REQUEST");
      expect(account.context.permissions).not.toContain("PROJECT_READ_SELF");
    });
  });

  it("routes member leave through team leader and final administrator", async () => {
    const employee = await userId("employee@digitalsquare.local");
    const manager = await userId("manager@digitalsquare.local");
    const admin = await userId("admin@digitalsquare.local");
    await rolledBack(async (tx) => {
      await asUser(tx, employee);
      await tx.unsafe("set local role postgres");
      const [policy] = await tx`select (private.policy_for_work_date(auth.uid(),'2031-01-06')).name as name`;
      expect(policy.name).toBeTruthy();
      const [duration] = await tx`select private.calculate_leave_duration(auth.uid(),'SPECIAL','2031-01-06','2031-01-06') as value`;
      expect(Number(duration.value)).toBeGreaterThan(0);
      await tx.unsafe("set local role authenticated");
      const [payloadCheck] = await tx`select ${sql.json({start_date:"2031-01-06"})}::jsonb as value`;
      expect(payloadCheck.value.start_date).toBe("2031-01-06");
      const [created] = await tx`select public.leave_approval_command('leave.create',
        ${sql.json({ leave_type: "SPECIAL", start_date: "2031-01-06", end_date: "2031-01-06", reason: "Role routing test" })}::jsonb,
        ${crypto.randomUUID()}) as result`;
      const [submitted] = await tx`select public.leave_approval_command('leave.submit',
        ${sql.json({ id: created.result.id, version: 1 })}::jsonb,
        ${crypto.randomUUID()}) as result`;
      const steps = await tx`select step_order,approver_id from public.approval_request_steps
        where approval_request_id=${submitted.result.approval_request_id} order by step_order`;
      expect(steps.map((step) => step.approver_id)).toEqual([manager, admin]);
    });
  });

  it("auto-approves Head leave and audits the bypass", async () => {
    const admin = await userId("admin@digitalsquare.local");
    await rolledBack(async (tx) => {
      await tx`insert into public.user_roles(user_id,role_id)
        select ${admin},id from public.roles where code='HEAD' on conflict do nothing`;
      await asUser(tx, admin);
      await tx.unsafe("set local role postgres");
      const [policy] = await tx`select (private.policy_for_work_date(auth.uid(),'2031-02-03')).name as name`;
      expect(policy.name).toBeTruthy();
      const [duration] = await tx`select private.calculate_leave_duration(auth.uid(),'SPECIAL','2031-02-03','2031-02-03') as value`;
      expect(Number(duration.value)).toBeGreaterThan(0);
      await tx.unsafe("set local role authenticated");
      const [created] = await tx`select public.leave_approval_command('leave.create',
        ${sql.json({ leave_type: "SPECIAL", start_date: "2031-02-03", end_date: "2031-02-03", reason: "Head bypass test" })}::jsonb,
        ${crypto.randomUUID()}) as result`;
      const [submitted] = await tx`select public.leave_approval_command('leave.submit',
        ${sql.json({ id: created.result.id, version: 1 })}::jsonb,
        ${crypto.randomUUID()}) as result`;
      const [request] = await tx`select status,route_snapshot from public.approval_requests
        where id=${submitted.result.approval_request_id}`;
      const [audit] = await tx`select action,after_data from public.audit_logs
        where entity_id=${created.result.id} and action='HEAD_BYPASS'`;
      expect(request.status).toBe("APPROVED");
      expect(request.route_snapshot[0].policy).toBe("HEAD_BYPASS");
      expect(audit.after_data.reason).toBe("AUTO_APPROVED_BY_POLICY");
    });
  });

  it("auto-approves Head quotations and contracts with an audit trail", async () => {
    const admin = await userId("admin@digitalsquare.local");
    await rolledBack(async (tx) => {
      await tx`insert into public.user_roles(user_id,role_id)
        select ${admin},id from public.roles where code='HEAD' on conflict do nothing`;
      const [customer] = await tx`insert into public.customers(customer_code,name,created_by,updated_by)
        values(${`HEADTEST${crypto.randomUUID().replaceAll("-", "").slice(0, 24).toUpperCase()}`},'Head approval test',${admin},${admin})
        returning id`;
      const [opportunity] = await tx`insert into public.opportunities(customer_id,sales_owner_id,title,created_by,updated_by)
        values(${customer.id},${admin},'Head approval test',${admin},${admin}) returning id`;
      await asUser(tx, admin);
      const [quotation] = await tx`select public.quotation_command('quotation.create',
        ${sql.json({ opportunity_id: opportunity.id, project_name: "Head test", quotation_date: "2031-03-01", valid_until: "2031-04-01", vat_rate: 10, expected_cost: 1000 })}::jsonb,
        ${crypto.randomUUID()}) as result`;
      await tx`select public.quotation_command('item.save',
        ${sql.json({ revision_id: quotation.result.revision_id, item_name: "Service", quantity: 1, unit_price: 2000 })}::jsonb,
        ${crypto.randomUUID()})`;
      const [revision] = await tx`select version from public.quotation_revisions where id=${quotation.result.revision_id}`;
      const [quoteSubmitted] = await tx`select public.quotation_command('quotation.submit',
        ${sql.json({ id: quotation.result.id, revision_version: revision.version })}::jsonb,
        ${crypto.randomUUID()}) as result`;
      const [quoteState] = await tx`select q.status,ar.status approval_status,ars.status step_status
        from public.quotations q join public.approval_requests ar on ar.id=${quoteSubmitted.result.approval_request_id}
        join public.approval_request_steps ars on ars.approval_request_id=ar.id where q.id=${quotation.result.id}`;
      expect(quoteState).toMatchObject({ status: "APPROVED", approval_status: "APPROVED", step_status: "APPROVED" });
      const [contract] = await tx`select public.contract_command('contract.create',
        ${sql.json({ quotation_revision_id: quotation.result.revision_id, contract_name: "Head test contract", contract_date: "2031-03-02", start_date: "2031-04-01", end_date: "2031-06-30", supply_amount: 2000, vat_rate: 10 })}::jsonb,
        ${crypto.randomUUID()}) as result`;
      const [contractRow] = await tx`select version from public.contracts where id=${contract.result.id}`;
      const [contractSubmitted] = await tx`select public.contract_command('contract.submit',
        ${sql.json({ id: contract.result.id, version: contractRow.version })}::jsonb,
        ${crypto.randomUUID()}) as result`;
      const [contractState] = await tx`select c.status,ar.status approval_status,ars.status step_status
        from public.contracts c join public.approval_requests ar on ar.id=${contractSubmitted.result.approval_request_id}
        join public.approval_request_steps ars on ars.approval_request_id=ar.id where c.id=${contract.result.id}`;
      expect(contractState).toMatchObject({ status: "APPROVED", approval_status: "APPROVED", step_status: "APPROVED" });
      const audits = await tx`select entity_type,after_data->>'reason' reason from public.audit_logs
        where action='HEAD_BYPASS' and entity_id in (${quotation.result.revision_id},${contract.result.id})`;
      expect(audits.map((row) => row.entity_type).sort()).toEqual(["contracts", "quotation_revisions"]);
      expect(audits.every((row) => row.reason === "AUTO_APPROVED_BY_POLICY")).toBe(true);
    });
  });

  it("auto-approves a Head expense and records the policy reason", async () => {
    const admin = await userId("admin@digitalsquare.local");
    await rolledBack(async (tx) => {
      await tx`insert into public.user_roles(user_id,role_id)
        select ${admin},id from public.roles where code='HEAD' on conflict do nothing`;
      const [project] = await tx`select id from public.projects order by id limit 1`;
      const [expenseType] = await tx`select id from public.expense_types where active order by id limit 1`;
      await asUser(tx, admin);
      const [created] = await tx`select public.expense_finance_command('expense.save',
        ${sql.json({ transaction_date: "2031-03-03", project_id: project.id, expense_type_id: expenseType.id, source_type: "TRANSFER", merchant: "Head test", purpose: "Policy verification", supply_amount: 1000, vat_amount: 100 })}::jsonb,
        ${crypto.randomUUID()}) as result`;
      const [expense] = await tx`select version from public.expenses where id=${created.result.id}`;
      await tx`select public.expense_finance_command('expense.submit',
        ${sql.json({ id: created.result.id, version: expense.version })}::jsonb,
        ${crypto.randomUUID()})`;
      const [approved] = await tx`select approval_status,reviewed_by from public.expenses where id=${created.result.id}`;
      expect(approved).toMatchObject({ approval_status: "APPROVED", reviewed_by: admin });
      const [audit] = await tx`select after_data->>'reason' reason from public.audit_logs
        where entity_id=${created.result.id} and action='HEAD_BYPASS'`;
      expect(audit.reason).toBe("AUTO_APPROVED_BY_POLICY");
    });
  });
});
