import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {loadEnvFile} from "node:process";
import postgres from "postgres";
import {createClient,type SupabaseClient} from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import {buildWorkforceProfileExcel} from "../src/modules/workforce-profile/application/profile-excel";
import {parseLegacyWorkforceSheet} from "../src/modules/workforce-profile/application/legacy-excel";
loadEnvFile(".env.local");
const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,dbUrl=process.env.TEST_DATABASE_URL!;
if(!["127.0.0.1","localhost"].includes(new URL(url).hostname)||!["127.0.0.1","localhost"].includes(new URL(dbUrl).hostname))throw new Error("Local database required");
const sql=postgres(dbUrl,{max:1});const make=()=>createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
let employee:SupabaseClient,manager:SupabaseClient,admin:SupabaseClient,employeeId:string,adminId:string;
let skillId="",requirementId="",experienceId="",educationId="",certificationId="",employeeSkillId="",fulfillmentId="";
const requestIds:string[]=[];const projectId="50000000-0000-4000-8000-000000000001",assignmentId="51000000-0000-4000-8000-000000000001";
const run=(client:SupabaseClient,action:string,payload:Record<string,unknown>,requestId=crypto.randomUUID())=>{requestIds.push(requestId);return client.rpc("workforce_profile_command",{p_action:action,p_payload:payload,p_request_id:requestId})};
beforeAll(async()=>{employee=make();manager=make();admin=make();for(const [client,name] of [[employee,"employee"],[manager,"manager"],[admin,"admin"]] as const){const {error}=await client.auth.signInWithPassword({email:`${name}@digitalsquare.local`,password:process.env.SEED_PASSWORD!});if(error)throw error}employeeId=(await employee.auth.getUser()).data.user!.id;adminId=(await admin.auth.getUser()).data.user!.id});
afterAll(async()=>{
 const ids=[skillId,requirementId,experienceId,educationId,certificationId,employeeSkillId,fulfillmentId,employeeId].filter(Boolean);
 if(fulfillmentId)await sql`delete from public.project_staffing_fulfillments where id=${fulfillmentId}`;
 if(requirementId){await sql`delete from public.project_staffing_requirement_skills where requirement_id=${requirementId}`;await sql`delete from public.project_staffing_requirements where id=${requirementId}`}
 if(experienceId)await sql`delete from public.workforce_project_experiences where id=${experienceId}`;
 if(educationId)await sql`delete from public.workforce_educations where id=${educationId}`;
 if(certificationId)await sql`delete from public.workforce_certifications where id=${certificationId}`;
 if(employeeSkillId)await sql`delete from public.employee_skills where id=${employeeSkillId}`;
 if(skillId)await sql`delete from public.skills where id=${skillId}`;
 await sql`delete from public.workforce_profiles where user_id=${employeeId}`;
 for(const id of ids)await sql`delete from public.audit_logs where entity_id=${id}`;
 for(const requestId of requestIds){await sql`delete from public.workforce_command_receipts where request_id=${requestId}`;await sql`delete from public.audit_logs where request_id=${requestId}`}
 await sql.end();
});
describe("Phase 11 workforce profile and staffing",()=>{
 it("restricts profile scope and self mutation",async()=>{
  expect((await employee.rpc("workforce_profile_access",{p_user_id:employeeId})).data).toBe(true);
  expect((await employee.rpc("workforce_profile_access",{p_user_id:adminId})).data).toBe(false);
  expect((await manager.rpc("workforce_profile_access",{p_user_id:employeeId})).data).toBe(true);
  expect((await manager.rpc("workforce_profile_access",{p_user_id:adminId})).data).toBe(false);
  expect((await admin.rpc("workforce_profile_access",{p_user_id:employeeId})).data).toBe(true);
  expect((await manager.rpc("workforce_profile_projects",{p_user_id:employeeId})).data?.some((a:{id:string})=>a.id===assignmentId)).toBe(true);
  expect((await manager.rpc("workforce_profile_projects",{p_user_id:adminId})).error?.code).toBe("42501");
  expect((await run(employee,"profile.save",{user_id:adminId,summary:"other"})).error?.code).toBe("42501");
  expect((await run(employee,"profile.save",{user_id:employeeId,career_start_date:"2023-01-01",summary:"Synthetic summary",profile_status:"DRAFT"})).error).toBeNull();
  expect((await employee.from("workforce_profiles").update({summary:"Direct"}).eq("user_id",employeeId)).error?.code).toBe("42501");
  expect((await run(employee,"profile.save",{user_id:employeeId,version:1,birth_date:"2000-01-01",summary:"Attack"})).error).toBeNull();
  expect((await sql`select birth_date from public.workforce_profiles where user_id=${employeeId}`)[0].birth_date).toBeNull();
  expect((await run(admin,"profile.save",{user_id:employeeId,version:2,birth_date:"2000-01-01",summary:"Managed"})).error).toBeNull();
  const retryKey=crypto.randomUUID();expect((await run(employee,"profile.save",{user_id:employeeId,version:3,summary:"Self update"},retryKey)).error).toBeNull();
  expect((await run(employee,"profile.save",{user_id:employeeId,version:3,summary:"Self update"},retryKey)).error).toBeNull();
  expect((await run(employee,"profile.save",{user_id:employeeId,version:3,summary:"Changed payload"},retryKey)).error?.code).toBe("40001");
  expect((await sql`select birth_date from public.workforce_profiles where user_id=${employeeId}`)[0].birth_date.toISOString().slice(0,10)).toBe("2000-01-01");
  expect((await employee.from("workforce_profiles").select("user_id").eq("user_id",adminId)).data).toEqual([]);
  const education=await run(employee,"education.save",{user_id:employeeId,school_name:"Synthetic University",degree:"Bachelor",major:"Engineering",graduation_status:"GRADUATED",highest_education:true,active:true});expect(education.error).toBeNull();educationId=education.data.id;
  const certification=await run(employee,"certification.save",{user_id:employeeId,certification_name:"Synthetic Certificate",issuer:"Test",active:true});expect(certification.error).toBeNull();certificationId=certification.data.id;
  expect((await manager.from("workforce_educations").select("id").eq("id",educationId)).data).toHaveLength(1);
 });
 it("stores manual and internal history without copying project identity",async()=>{
  const created=await run(employee,"experience.save",{user_id:employeeId,source_type:"INTERNAL_PROJECT",project_assignment_id:assignmentId,responsibilities:"Synthetic development work",technologies:"TypeScript",active:true});expect(created.error).toBeNull();experienceId=created.data.id;
  const wrong=await run(employee,"experience.save",{user_id:employeeId,source_type:"INTERNAL_PROJECT",project_assignment_id:assignmentId,project_name:"copied",responsibilities:"Synthetic"});expect(wrong.error?.code).toBe("23514");
  const manual=await run(employee,"experience.save",{user_id:employeeId,source_type:"MANUAL_HISTORY",project_name:"Legacy sample",start_date:"2020-01-01",role:"Engineer",responsibilities:"Manual entry"});expect(manual.error).toBeNull();const manualId=manual.data.id;
  expect((await sql`select project_name,start_date,role from public.workforce_project_experiences where id=${experienceId}`)[0]).toMatchObject({project_name:null,start_date:null,role:null});
  await sql`delete from public.workforce_project_experiences where id=${manualId}`;await sql`delete from public.audit_logs where entity_id=${manualId}`;
 });
 it("links skills, capacity, requirement and an actual assignment",async()=>{
  const skill=await run(admin,"skill_catalog.save",{code:`TEST_${crypto.randomUUID().replace(/-/g,"").slice(0,12).toUpperCase()}`,name:`Synthetic Skill ${crypto.randomUUID().slice(0,8)}`,category:"BACKEND",active:true});expect(skill.error).toBeNull();skillId=skill.data.id;
  const owned=await run(employee,"employee_skill.save",{user_id:employeeId,skill_id:skillId,level:"ADVANCED",years_experience:2,active:true});expect(owned.error).toBeNull();employeeSkillId=owned.data.id;
  const requirement=await run(manager,"requirement.save",{project_id:projectId,role_name:"Synthetic Engineer",required_headcount:1,planned_start_date:"2026-10-01",planned_end_date:"2026-11-30",allocation_rate:50,lifecycle_status:"OPEN"});expect(requirement.error).toBeNull();requirementId=requirement.data.id;
  const needed=await run(manager,"requirement_skill.save",{requirement_id:requirementId,skill_id:skillId,preference:"REQUIRED",target_level:"INTERMEDIATE",active:true});expect(needed.error).toBeNull();
  const candidates=await manager.rpc("project_staffing_candidates",{p_requirement_id:requirementId,p_skill_id:skillId,p_min_availability:0});expect(candidates.error).toBeNull();expect(candidates.data.some((x:{user_id:string;matched_required:number;can_read_profile:boolean})=>x.user_id===employeeId&&x.matched_required===1&&x.can_read_profile)).toBe(true);
  const matrix=await manager.rpc("workforce_skill_matrix",{p_start:"2026-10-01",p_end:"2026-11-30",p_skill_id:skillId});expect(matrix.error).toBeNull();expect(matrix.data.map((x:{user_id:string})=>x.user_id)).toContain(employeeId);
  expect(matrix.data.map((x:{user_id:string})=>x.user_id)).not.toContain(adminId);
  const linked=await run(manager,"fulfillment.save",{requirement_id:requirementId,project_assignment_id:assignmentId,active:true});expect(linked.error).toBeNull();fulfillmentId=linked.data.id;
  const overview=await manager.rpc("project_staffing_overview",{p_project_id:projectId});expect(overview.error).toBeNull();expect(overview.data.find((x:{id:string})=>x.id===requirementId)).toMatchObject({filled_count:1,staffing_status:"FILLED"});
  const portfolio=await manager.rpc("project_portfolio_staffing");expect(portfolio.error).toBeNull();expect(portfolio.data.find((x:{project_id:string})=>x.project_id===projectId)).toMatchObject({required_headcount:1,filled_count:1});
 });
 it("audits exports and blocks out-of-scope targets",async()=>{
  const requestId=crypto.randomUUID();requestIds.push(requestId);
  expect((await employee.rpc("workforce_profile_export_audit",{p_user_ids:[adminId],p_include_birth_date:false,p_request_id:requestId})).error?.code).toBe("42501");
  const accepted=await employee.rpc("workforce_profile_export_audit",{p_user_ids:[employeeId],p_include_birth_date:false,p_request_id:requestId});expect(accepted.error).toBeNull();expect((await sql`select count(*)::integer n from public.audit_logs where request_id=${requestId} and action='EXPORT'`)[0].n).toBe(1);
 });
 it("renders the reference-style Excel and parses a legacy sheet",async()=>{
  const buffer=await buildWorkforceProfileExcel([{name:"Synthetic Person",organization:"Sample Team",birthDate:null,careerStartDate:"2023-01-01",careerMonthsOverride:null,highestSchool:"Sample University",major:"Computer Science",skills:["Sample Skill Advanced"],experiences:[{category:"",name:"Older",start:"2020-01-01",end:"2020-06-30",responsibilities:"Old work",role:"Engineer"},{category:"",name:"Newest",start:"2025-01-01",end:"2025-06-30",responsibilities:"New work",role:"Consultant"}]}],"2026-09-20");
  const book=new ExcelJS.Workbook();await book.xlsx.load(buffer as unknown as Parameters<typeof book.xlsx.load>[0]);const sheet=book.worksheets[0];expect(sheet.getCell("B2").value).toBe("Synthetic Person");expect(sheet.getCell("B4").value).toContain("Sample Skill");expect(sheet.getCell("B8").value).toBe("Newest");expect(sheet.getCell("B9").value).toBe("Older");const parsed=parseLegacyWorkforceSheet(sheet);expect(parsed.profile.entries).toHaveLength(2);
 });
});
