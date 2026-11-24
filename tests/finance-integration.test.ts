import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnvFile } from "node:process";
import postgres from "postgres";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

loadEnvFile(".env.local");
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!; const dbUrl = process.env.TEST_DATABASE_URL!;
if (!["127.0.0.1","localhost"].includes(new URL(apiUrl).hostname) || !["127.0.0.1","localhost"].includes(new URL(dbUrl).hostname)) throw new Error("Finance tests require local disposable services.");
const sql = postgres(dbUrl, { max: 1 });
const makeClient = () => createClient(apiUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
let admin: SupabaseClient, employee: SupabaseClient, adminId = "", managerId = "";
const ids = { customer: crypto.randomUUID(), opportunity: crypto.randomUUID(), quotation: crypto.randomUUID(), revision: crypto.randomUUID(), contract: crypto.randomUUID(), project: crypto.randomUUID() };
const requests: string[] = [];
async function run(action: string, payload: Record<string, unknown>) { const request = crypto.randomUUID(); requests.push(request); return admin.rpc("finance_command", { p_action: action, p_payload: payload, p_request_id: request }); }

beforeAll(async () => {
  admin = makeClient(); employee = makeClient();
  for (const [client,email] of [[admin,"admin@digitalsquare.local"],[employee,"employee@digitalsquare.local"]] as const) { const { error } = await client.auth.signInWithPassword({ email, password: process.env.SEED_PASSWORD! }); if (error) throw error; }
  adminId = (await admin.auth.getUser()).data.user!.id;
  managerId = (await sql`select id from public.employees where email='manager@digitalsquare.local'`)[0].id;
  const stamp = Date.now().toString().slice(-8);
  await sql`insert into public.customers(id,customer_code,name,business_registration_number,representative_name,address,business_type,business_item,billing_contact_name,billing_email,payment_terms,default_payment_terms,note,status,created_by,updated_by)
    values(${ids.customer},${`FIN${stamp}`},'재무 통합 테스트 고객','1234567890','김고객','서울시 중구 고객로 1','서비스업','정보서비스','재무팀','billing@example.com','월말','월말','','ACTIVE',${adminId},${adminId})`;
  await sql`insert into public.opportunities(id,customer_id,sales_owner_id,title,expected_project_name,expected_amount,probability,stage,created_by,updated_by)
    values(${ids.opportunity},${ids.customer},${adminId},'재무 테스트 영업기회','재무 테스트 프로젝트',10000000,100,'NEGOTIATION',${adminId},${adminId})`;
  await sql`insert into public.quotations(id,customer_id,opportunity_id,status,created_by,updated_by) values(${ids.quotation},${ids.customer},${ids.opportunity},'APPROVED',${adminId},${adminId})`;
  await sql`insert into public.quotation_revisions(id,quotation_id,revision_no,project_name,quotation_date,valid_until,vat_rate,supply_amount,vat_amount,total_amount,expected_cost,expected_profit,expected_profit_rate,status,created_by,updated_by)
    values(${ids.revision},${ids.quotation},1,'재무 테스트 프로젝트','2026-09-01','2026-10-31',10,10000000,1000000,11000000,6000000,4000000,40,'APPROVED',${adminId},${adminId})`;
  await sql`update public.quotations set current_revision_id=${ids.revision},approved_revision_id=${ids.revision} where id=${ids.quotation}`;
  await sql`insert into public.contracts(id,customer_id,opportunity_id,quotation_revision_id,contract_name,contract_date,start_date,end_date,signed_date,supply_amount,vat_rate,vat_amount,total_amount,status,created_by,updated_by)
    values(${ids.contract},${ids.customer},${ids.opportunity},${ids.revision},'재무 테스트 계약','2026-09-01','2026-09-01','2026-12-31','2026-09-01',10000000,10,1000000,11000000,'ACTIVE',${adminId},${adminId})`;
  await sql`insert into public.projects(id,project_code,project_name,customer_name,planned_start_date,planned_end_date,status,project_manager_id,created_by,customer_id,contract_id,opportunity_id,quotation_revision_id,sales_owner_id)
    values(${ids.project},${`FIN-PJT-${stamp}`},'재무 테스트 프로젝트','재무 통합 테스트 고객','2026-09-01','2026-12-31','IN_PROGRESS',${managerId},${adminId},${ids.customer},${ids.contract},${ids.opportunity},${ids.revision},${adminId})`;
});

afterAll(async () => {
  const entityIds = await sql`select id::text from public.payment_allocations union all select id::text from public.tax_invoices where billing_id in (select id from public.billings where project_id=${ids.project}) union all select id::text from public.payments where customer_id=${ids.customer} union all select id::text from public.billings where project_id=${ids.project} union all select id::text from public.billing_schedules where project_id=${ids.project} union all select id::text from public.company_bank_accounts where note='finance-integration-test'`;
  await sql`delete from public.payment_allocations where billing_id in (select id from public.billings where project_id=${ids.project})`;
  await sql`delete from public.tax_invoices where billing_id in (select id from public.billings where project_id=${ids.project})`;
  await sql`delete from public.payments where customer_id=${ids.customer}`;
  await sql`delete from public.billings where project_id=${ids.project}`; await sql`delete from public.billing_schedules where project_id=${ids.project}`;
  await sql`delete from public.company_bank_accounts where note='finance-integration-test'`; await sql`delete from public.company_tax_profiles where id='default'`;
  if (requests.length) await sql`delete from public.finance_command_receipts where request_id in ${sql(requests)}`;
  const allEntities = [...entityIds.map((row) => row.id), ...Object.values(ids), "default"];
  await sql`delete from public.audit_logs where entity_id in ${sql(allEntities)}`;
  await sql`delete from public.projects where id=${ids.project}`; await sql`delete from public.contracts where id=${ids.contract}`;
  await sql`update public.quotations set current_revision_id=null,approved_revision_id=null where id=${ids.quotation}`;
  await sql`delete from public.quotation_revisions where id=${ids.revision}`; await sql`delete from public.quotations where id=${ids.quotation}`;
  await sql`delete from public.opportunities where id=${ids.opportunity}`; await sql`delete from public.customers where id=${ids.customer}`;
  await sql.end();
});

describe("Phase 3 finance database workflow", () => {
  it("runs billing, tax issuance, partial payment, and full collection with enforced limits", async () => {
    expect((await run("company_tax_profile.save", { business_registration_number: "1112233333", company_name: "주식회사 디지털스퀘어", representative_name: "최대표", address: "울산시 남구 산업로 1", business_type: "정보통신업", business_item: "소프트웨어 개발", email: "finance@digitalsquare.local", phone: "052-000-0000" })).error).toBeNull();
    const bank = await run("bank_account.save", { bank_name: "기업은행", account_number: "123-456789-01-001", account_holder: "디지털스퀘어", purpose: "수금계좌", is_default: true, active: true, note: "finance-integration-test" }); expect(bank.error).toBeNull();
    const schedule = await run("schedule.save", { contract_id: ids.contract, project_id: ids.project, sequence_no: 1, title: "구축대금 1차", billing_condition: "착수", scheduled_date: "2026-09-30", supply_amount: 10000000, vat_rate: 10, note: "" }); expect(schedule.error).toBeNull();
    const [storedSchedule] = await sql`select vat_amount,total_amount from public.billing_schedules where id=${schedule.data.id}`; expect(Number(storedSchedule.vat_amount)).toBe(1000000); expect(Number(storedSchedule.total_amount)).toBe(11000000);
    const billing = await run("billing.create", { schedule_id: schedule.data.id, bank_account_id: bank.data.id, billing_date: "2026-09-27", due_date: "2026-10-31", note: "" }); expect(billing.error).toBeNull();
    let [billingRow] = await sql`select * from public.billings where id=${billing.data.id}`;
    expect((await run("billing.issue", { id: billing.data.id, version: billingRow.version })).error).toBeNull();
    const tax = await run("tax_invoice.create", { billing_id: billing.data.id, issue_date: "2026-09-27", supply_date: "2026-09-27", purpose: "CHARGE", note: "" }); expect(tax.error).toBeNull();
    let [taxRow] = await sql`select * from public.tax_invoices where id=${tax.data.id}`;
    const items = [{ date: "2026-09-27", name: "ERP 구축 용역", specification: "1식", quantity: 1, unitPrice: 10000000, supplyAmount: 10000000, vatAmount: 1000000, note: "" }];
    expect((await run("tax_invoice.save", { id: tax.data.id, version: taxRow.version, issue_date: "2026-09-27", supply_date: "2026-09-27", purpose: "CHARGE", recipient_name: "재무팀", recipient_email: "billing@example.com", items, note: "" })).error).toBeNull();
    taxRow = (await sql`select * from public.tax_invoices where id=${tax.data.id}`)[0]; expect((await run("tax_invoice.ready", { id: tax.data.id, version: taxRow.version })).error).toBeNull();
    taxRow = (await sql`select * from public.tax_invoices where id=${tax.data.id}`)[0]; expect((await run("tax_invoice.record_issue", { id: tax.data.id, version: taxRow.version, issue_channel: "HOMETAX", nts_approval_number: "123" })).error?.code).toBe("22023");
    expect((await run("tax_invoice.record_issue", { id: tax.data.id, version: taxRow.version, issue_channel: "HOMETAX", nts_approval_number: "202609271234567890123456", transmitted_at: nowIso() })).error).toBeNull();
    const payment1 = await run("payment.save", { customer_id: ids.customer, project_id: ids.project, bank_account_id: bank.data.id, received_date: "2026-10-15", amount: 4000000, payer_name: "테스트 고객", bank_reference: "1차", note: "" }); expect(payment1.error).toBeNull();
    expect((await run("payment.allocate", { payment_id: payment1.data.id, billing_id: billing.data.id, amount: 4000000 })).error).toBeNull();
    billingRow = (await sql`select status from public.billings where id=${billing.data.id}`)[0]; expect(billingRow.status).toBe("PARTIALLY_PAID");
    expect((await run("payment.allocate", { payment_id: payment1.data.id, billing_id: billing.data.id, amount: 1 })).error?.code).toBe("40001");
    const payment2 = await run("payment.save", { customer_id: ids.customer, project_id: ids.project, bank_account_id: bank.data.id, received_date: "2026-10-31", amount: 7000000, payer_name: "테스트 고객", bank_reference: "잔금", note: "" }); expect(payment2.error).toBeNull();
    expect((await run("payment.allocate", { payment_id: payment2.data.id, billing_id: billing.data.id, amount: 7000000 })).error).toBeNull();
    billingRow = (await sql`select status from public.billings where id=${billing.data.id}`)[0]; expect(billingRow.status).toBe("PAID");
    expect((await employee.from("billings").select("id").eq("id", billing.data.id)).data).toEqual([]);
  });
});

function nowIso() { return new Date().toISOString(); }
