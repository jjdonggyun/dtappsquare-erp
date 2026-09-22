import {z} from "zod";
import {currentAccount} from "@/shared/auth/account";
import {authorize} from "@/modules/rbac/domain/policy";
import {AppError,databaseError} from "@/shared/domain/errors";
import {failure,readMutation} from "@/shared/infrastructure/http";
import {serverClient} from "@/shared/infrastructure/supabase/server";
import {employeeById} from "@/modules/users/infrastructure/repository";
import {organizationCatalogs} from "@/modules/organization/infrastructure/repository";
import {workforceProfile,skillCatalog} from "@/modules/workforce-profile/infrastructure/repository";
import {buildWorkforceProfileExcel,type ProfileExport} from "@/modules/workforce-profile/application/profile-excel";
import {dateInTimeZone} from "@/shared/domain/date-time";
import {environment} from "@/shared/infrastructure/env";
const inputSchema=z.object({user_ids:z.array(z.uuid()).min(1).max(20),include_birth_date:z.boolean().default(false)});
export async function POST(request:Request){const requestId=request.headers.get("X-Idempotency-Key")??crypto.randomUUID();try{
 const [account,raw]=await Promise.all([currentAccount(),readMutation(request)]);authorize(account);
 const input=inputSchema.parse(raw);if(new Set(input.user_ids).size!==input.user_ids.length)throw new AppError("ValidationError");
 const client=await serverClient();
 const [catalogs,skills,...people]=await Promise.all([organizationCatalogs(),skillCatalog(),...input.user_ids.map(async id=>({employee:await employeeById(id),profile:await workforceProfile(id)}))]);
 const skillNames=new Map(skills.map(s=>[s.id,s.name]));
 const profiles:ProfileExport[]=people.map(({employee,profile})=>{
  if(!employee)throw new AppError("NotFound");
  const highest=profile.educations.find(x=>x.highest_education)??profile.educations[0];
  return {name:employee.name,organization:catalogs.organizations.find(o=>o.id===employee.organization_id)?.name??"—",birthDate:input.include_birth_date?profile.profile?.birth_date??null:null,
   careerStartDate:profile.profile?.career_start_date??null,careerMonthsOverride:profile.profile?.career_months_override??null,
   highestSchool:highest?.school_name??"—",major:highest?.major??"—",
   skills:profile.employeeSkills.map(s=>`${skillNames.get(s.skill_id)??""}${s.level?` ${s.level.toLowerCase()}`:""}`).filter(Boolean),
   experiences:profile.experiences.map(x=>({category:x.category??"",name:x.display_name,start:x.display_start,end:x.display_end,responsibilities:x.responsibilities,role:x.display_role}))};
 });
 const buffer=await buildWorkforceProfileExcel(profiles,dateInTimeZone(new Date(),environment().COMPANY_TIMEZONE));
 // One DB call validates every target and records the completed export atomically.
 const audited=await client.rpc("workforce_profile_export_audit",{p_user_ids:input.user_ids,p_include_birth_date:input.include_birth_date,p_request_id:requestId});
 if(audited.error)throw databaseError(audited.error);
 return new Response(new Uint8Array(buffer),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="DigitalSquare_WorkforceProfiles_${dateInTimeZone(new Date(),environment().COMPANY_TIMEZONE)}.xlsx"`,"Cache-Control":"private, no-store"}});
}catch(error){return failure(error,requestId)}}
