import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnvFile } from "node:process";
import postgres from "postgres";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

loadEnvFile(".env.local");
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const dbUrl = process.env.TEST_DATABASE_URL!;
if (!["127.0.0.1", "localhost"].includes(new URL(apiUrl).hostname) || !["127.0.0.1", "localhost"].includes(new URL(dbUrl).hostname))
  throw new Error("Phase 4 integration tests require local disposable services.");
const sql = postgres(dbUrl, { max: 1 });
const makeClient = () => createClient(apiUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
let admin: SupabaseClient; let employee: SupabaseClient; let adminId = ""; let managerId = ""; let employeeId = "";
const ids = Object.fromEntries(["customer","opportunity","quotation","revision","contract","project","assignment","rate","work","document1","document2","inspection","schedule","billing","tax","payment","allocation"].map((key) => [key, crypto.randomUUID()])) as Record<string,string>;
let expenseId = ""; const requests: string[] = [];
async function run(action: string, payload: Record<string, unknown>) { const request = crypto.randomUUID(); requests.push(request); return admin.rpc("expense_finance_command", { p_action: action, p_payload: payload, p_request_id: request }); }

beforeAll(async () => {
  admin = makeClient(); employee = makeClient();
  for (const [client,email] of [[admin,"admin@digitalsquare.local"],[employee,"employee@digitalsquare.local"]] as const) {
    const { error } = await client.auth.signInWithPassword({ email, password: process.env.SEED_PASSWORD! }); if (error) throw error;
  }
  adminId = (await admin.auth.getUser()).data.user!.id; employeeId = (await employee.auth.getUser()).data.user!.id;
  managerId = (await sql`select id from public.employees where email='manager@digitalsquare.local'`)[0].id;
  const stamp = Date.now().toString().slice(-8);
  await sql`insert into public.customers(id,customer_code,name,business_registration_number,representative_name,address,business_type,business_item,billing_contact_name,billing_email,payment_terms,default_payment_terms,note,status,created_by,updated_by)
    values(${ids.customer},${`P4${stamp}`},'Phase 4 고객','1234567890','김고객','서울시 중구','서비스업','정보서비스','재무팀','billing@example.com','완료 후 지급','완료 후 지급','','ACTIVE',${adminId},${adminId})`;
  await sql`insert into public.opportunities(id,customer_id,sales_owner_id,title,expected_project_name,expected_amount,probability,stage,created_by,updated_by)
    values(${ids.opportunity},${ids.customer},${adminId},'Phase 4 영업기회','Phase 4 프로젝트',10000000,100,'NEGOTIATION',${adminId},${adminId})`;
  await sql`insert into public.quotations(id,customer_id,opportunity_id,status,created_by,updated_by) values(${ids.quotation},${ids.customer},${ids.opportunity},'APPROVED',${adminId},${adminId})`;
  await sql`insert into public.quotation_revisions(id,quotation_id,revision_no,project_name,quotation_date,valid_until,vat_rate,supply_amount,vat_amount,total_amount,expected_cost,expected_profit,expected_profit_rate,status,created_by,updated_by)
    values(${ids.revision},${ids.quotation},1,'Phase 4 프로젝트','2026-09-01','2026-10-31',10,10000000,1000000,11000000,5000000,5000000,50,'APPROVED',${adminId},${adminId})`;
  await sql`update public.quotations set current_revision_id=${ids.revision},approved_revision_id=${ids.revision} where id=${ids.quotation}`;
  await sql`insert into public.contracts(id,customer_id,opportunity_id,quotation_revision_id,contract_name,contract_date,start_date,end_date,signed_date,supply_amount,vat_rate,vat_amount,total_amount,status,created_by,updated_by)
    values(${ids.contract},${ids.customer},${ids.opportunity},${ids.revision},'Phase 4 계약','2026-09-01','2026-09-01','2026-09-30','2026-09-01',10000000,10,1000000,11000000,'ACTIVE',${adminId},${adminId})`;
  await sql`insert into public.projects(id,project_code,project_name,customer_name,planned_start_date,planned_end_date,actual_start_date,status,project_manager_id,created_by,customer_id,contract_id,opportunity_id,quotation_revision_id,sales_owner_id)
    values(${ids.project},${`P4-PJT-${stamp}`},'Phase 4 프로젝트','Phase 4 고객','2026-09-01','2026-09-30','2026-09-01','IN_PROGRESS',${managerId},${adminId},${ids.customer},${ids.contract},${ids.opportunity},${ids.revision},${adminId})`;
  await sql`insert into public.project_assignments(id,project_id,user_id,project_role,planned_start_date,planned_end_date,actual_start_date,actual_end_date,allocation_rate,status,memo,assigned_by,planned_mm)
    values(${ids.assignment},${ids.project},${employeeId},'Developer','2026-09-01','2026-09-30','2026-09-01','2026-09-27',100,'ENDED','',${managerId},1)`;
  await sql`insert into public.project_assignment_rates(id,assignment_id,snapshot_no,planned_mm,monthly_cost_rate,monthly_billing_rate,reason,created_by,created_at)
    values(${ids.rate},${ids.assignment},1,1,4800000,8000000,'Phase 4 test',${adminId},'2026-09-01')`;
  await sql`insert into public.daily_work_logs(id,user_id,work_date,work_category,project_id,title,description,work_minutes,status)
    values(${ids.work},${employeeId},'2026-09-27','PROJECT',${ids.project},'마감 작업','',60,'DONE')`;
  for (const [id,category,title] of [[ids.document1,'COMPLETION_REPORT','완료 보고서'],[ids.document2,'INSPECTION','검수 확인서']] as const) {
    await sql`insert into public.documents(id,title,category,file_name,storage_key,mime_type,size_bytes,sha256,uploaded_by) values(${id},${title},${category},${`${title}.pdf`},${`${ids.project}/${id}/${title}.pdf`},'application/pdf',100,${id.replaceAll('-','').padEnd(64,'a').slice(0,64)},${adminId})`;
    await sql`insert into public.project_document_links(project_id,document_id) values(${ids.project},${id})`;
  }
  await sql`insert into public.inspections(id,project_id,document_id,inspection_type,title,completed_date,customer_contact_name,customer_contact_email,status,result,note,created_by,updated_by)
    values(${ids.inspection},${ids.project},${ids.document2},'ACCEPTANCE','최종 검수','2026-09-27','고객 담당자','customer@example.com','COMPLETED','PASSED','',${adminId},${adminId})`;
  await sql`insert into public.billing_schedules(id,contract_id,project_id,sequence_no,title,scheduled_date,supply_amount,vat_rate,vat_amount,total_amount,status,created_by,updated_by)
    values(${ids.schedule},${ids.contract},${ids.project},1,'완료 대금','2026-09-27',10000000,10,1000000,11000000,'BILLED',${adminId},${adminId})`;
  await sql`insert into public.billings(id,schedule_id,customer_id,project_id,contract_id,title,billing_date,due_date,supply_amount,vat_rate,vat_amount,total_amount,status,issued_at,created_by,updated_by)
    values(${ids.billing},${ids.schedule},${ids.customer},${ids.project},${ids.contract},'완료 대금','2026-09-27','2026-09-27',10000000,10,1000000,11000000,'PAID',now(),${adminId},${adminId})`;
  await sql`insert into public.tax_invoices(id,billing_id,issue_date,supply_date,purpose,status,issue_channel,nts_approval_number,supplier_registration_number,supplier_name,supplier_representative_name,supplier_address,supplier_business_type,supplier_business_item,supplier_email,buyer_registration_number,buyer_name,buyer_representative_name,buyer_address,buyer_business_type,buyer_business_item,recipient_name,recipient_email,supply_amount,vat_amount,total_amount,items,note,issued_at,transmitted_at,created_by,updated_by)
    values(${ids.tax},${ids.billing},'2026-09-27','2026-09-27','CHARGE','ISSUED','HOMETAX','202609271234567890123455','1112233333','디지털스퀘어','최대표','울산시','정보통신업','소프트웨어','finance@example.com','1234567890','Phase 4 고객','김고객','서울시','서비스업','정보서비스','재무팀','billing@example.com',10000000,1000000,11000000,${sql.json([{date:'2026-09-27',name:'완료 대금',specification:'1식',quantity:1,unitPrice:10000000,supplyAmount:10000000,vatAmount:1000000,note:''}])},'',now(),now(),${adminId},${adminId})`;
  await sql`insert into public.payments(id,customer_id,project_id,received_date,amount,payer_name,status,created_by,updated_by) values(${ids.payment},${ids.customer},${ids.project},'2026-09-27',11000000,'Phase 4 고객','CONFIRMED',${adminId},${adminId})`;
  await sql`insert into public.payment_allocations(id,payment_id,billing_id,amount,created_by) values(${ids.allocation},${ids.payment},${ids.billing},11000000,${adminId})`;
});

afterAll(async () => {
  if (!adminId) { await sql.end(); return; }
  await sql`select set_config('app.project_closing_command','on',false)`;
  await sql`update public.project_closings set status='REOPENED',reopened_at=coalesce(reopened_at,now()),reopened_by=coalesce(reopened_by,${adminId}),reopen_reason=case when reopen_reason='' then 'test cleanup' else reopen_reason end where project_id=${ids.project} and status='CLOSED'`;
  await sql`update public.projects set closed_at=null,closed_by=null,closing_snapshot=null,status='IN_PROGRESS',actual_end_date=null where id=${ids.project}`;
  await sql`delete from public.payment_allocations where id=${ids.allocation}`; await sql`delete from public.tax_invoices where id=${ids.tax}`; await sql`delete from public.payments where id=${ids.payment}`;
  await sql`delete from public.billings where id=${ids.billing}`; await sql`delete from public.billing_schedules where id=${ids.schedule}`; await sql`delete from public.inspections where id=${ids.inspection}`;
  if (expenseId) await sql`delete from public.expenses where id=${expenseId}`;
  await sql`delete from public.project_document_links where project_id=${ids.project}`; await sql`delete from public.documents where id in (${ids.document1},${ids.document2})`;
  await sql`delete from public.project_closings where project_id=${ids.project}`; await sql`delete from public.daily_work_logs where id=${ids.work}`;
  await sql`delete from public.project_assignment_rates where id=${ids.rate}`; await sql`delete from public.project_assignments where id=${ids.assignment}`;
  if (requests.length) await sql`delete from public.expense_finance_command_receipts where request_id in ${sql(requests)}`;
  await sql`delete from public.audit_logs where entity_id in ${sql([...Object.values(ids),expenseId].filter(Boolean))}`;
  await sql`delete from public.projects where id=${ids.project}`; await sql`delete from public.contracts where id=${ids.contract}`;
  await sql`update public.quotations set current_revision_id=null,approved_revision_id=null where id=${ids.quotation}`;
  await sql`delete from public.quotation_revisions where id=${ids.revision}`; await sql`delete from public.quotations where id=${ids.quotation}`; await sql`delete from public.opportunities where id=${ids.opportunity}`; await sql`delete from public.customers where id=${ids.customer}`;
  await sql.end();
});

describe("Phase 4 expense to project closing database workflow", () => {
  it("approves expenses, calculates P&L, closes, locks, and reopens a project", async () => {
    const expenseType = (await sql`select id from public.expense_types where code='MEAL'`)[0].id;
    const created = await run("expense.save", { transaction_date: "2026-09-27", project_id: ids.project, corporate_card_id: "", expense_type_id: expenseType, vendor_id: "", source_type: "TRANSFER", merchant: "테스트 식당", purpose: "완료 회의", supply_amount: 100000, vat_amount: 10000, memo: "" });
    expect(created.error).toBeNull(); expenseId = created.data.id;
    let expense = (await sql`select * from public.expenses where id=${expenseId}`)[0];
    expect((await run("expense.submit", { id: expenseId, version: expense.version })).error).toBeNull();
    expense = (await sql`select * from public.expenses where id=${expenseId}`)[0];
    expect((await run("expense.approve", { id: expenseId, version: expense.version, mark_paid: true, payment_reference: "TEST-PAY" })).error).toBeNull();

    const summary = await admin.rpc("project_financial_summary", { p_project_id: ids.project, p_as_of: "2026-09-27" });
    expect(summary.error).toBeNull();
    expect(summary.data).toMatchObject({ contract_supply_amount: 10000000, received_amount: 11000000, outstanding_amount: 0, labor_cost: 30000, expense_cost: 100000, total_cost: 130000, gross_profit: 9870000 });
    expect((await employee.rpc("project_financial_summary", { p_project_id: ids.project, p_as_of: "2026-09-27" })).error?.code).toBe("42501");
    const check = await admin.rpc("project_closing_check", { p_project_id: ids.project, p_as_of: "2026-09-27" });
    expect(check.error).toBeNull(); expect(check.data.can_close).toBe(true);

    const version = (await sql`select version from public.projects where id=${ids.project}`)[0].version;
    expect((await run("project.close", { project_id: ids.project, version, as_of_date: "2026-09-27", note: "Phase 4 통합 테스트 마감" })).error).toBeNull();
    expect((await sql`select status,closed_at,closing_snapshot from public.projects where id=${ids.project}`)[0]).toMatchObject({ status: "COMPLETED" });
    const locked = await run("expense.save", { transaction_date: "2026-09-27", project_id: ids.project, corporate_card_id: "", expense_type_id: expenseType, vendor_id: "", source_type: "TRANSFER", merchant: "잠금 테스트", purpose: "차단", supply_amount: 1, vat_amount: 0, memo: "" });
    expect(locked.error?.code).toBe("40001");

    const closedVersion = (await sql`select version from public.projects where id=${ids.project}`)[0].version;
    expect((await run("project.reopen", { project_id: ids.project, version: closedVersion, reason: "추가 비용 정산을 위한 테스트 재개방" })).error).toBeNull();
    expect((await sql`select status,closed_at from public.projects where id=${ids.project}`)[0]).toMatchObject({ status: "IN_PROGRESS", closed_at: null });
  });
});
