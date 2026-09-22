import "server-only";
import {z} from "zod";
import {serverClient} from "@/shared/infrastructure/supabase/server";
import {databaseError} from "@/shared/domain/errors";
import type {WorkforceRepository} from "../application/commands";

const uuid=z.uuid();
export const profileSchema=z.object({user_id:uuid,birth_date:z.string().nullable(),career_start_date:z.string().nullable(),career_months_override:z.number().nullable(),career_override_reason:z.string().nullable(),summary:z.string(),profile_status:z.string(),version:z.number(),created_at:z.string(),updated_at:z.string()});
export const educationSchema=z.object({id:uuid,user_id:uuid,school_name:z.string(),degree:z.string(),major:z.string(),start_date:z.string().nullable(),end_date:z.string().nullable(),graduation_status:z.string(),highest_education:z.boolean(),sort_order:z.number(),active:z.boolean(),version:z.number()});
export const skillSchema=z.object({id:uuid,code:z.string(),name:z.string(),category:z.string(),active:z.boolean(),version:z.number()});
export const employeeSkillSchema=z.object({id:uuid,user_id:uuid,skill_id:uuid,level:z.string().nullable(),years_experience:z.coerce.number().nullable(),last_used_date:z.string().nullable(),memo:z.string(),active:z.boolean(),version:z.number()});
export const certificationSchema=z.object({id:uuid,user_id:uuid,certification_name:z.string(),issuer:z.string(),obtained_date:z.string().nullable(),expiry_date:z.string().nullable(),credential_id:z.string().nullable(),active:z.boolean(),version:z.number()});
export const experienceSchema=z.object({id:uuid,user_id:uuid,source_type:z.string(),project_assignment_id:uuid.nullable(),project_name:z.string().nullable(),customer_name:z.string().nullable(),category:z.string().nullable(),start_date:z.string().nullable(),end_date:z.string().nullable(),role:z.string().nullable(),responsibilities:z.string(),technologies:z.string(),sort_order:z.number(),active:z.boolean(),version:z.number()});
export const requirementSchema=z.object({id:uuid,project_id:uuid,role_name:z.string(),required_headcount:z.number(),planned_start_date:z.string(),planned_end_date:z.string(),allocation_rate:z.number(),description:z.string(),lifecycle_status:z.string(),version:z.number(),filled_count:z.number(),staffing_status:z.string()});
export const requirementSkillSchema=z.object({id:uuid,requirement_id:uuid,skill_id:uuid,preference:z.string(),target_level:z.string().nullable(),active:z.boolean(),version:z.number()});
export const fulfillmentSchema=z.object({id:uuid,requirement_id:uuid,project_assignment_id:uuid,active:z.boolean(),version:z.number()});
export const candidateSchema=z.object({user_id:uuid,name:z.string(),organization_id:uuid.nullable(),position_id:uuid.nullable(),career_months:z.number().nullable(),minimum_availability:z.number(),matched_required:z.number(),total_required:z.number(),can_read_profile:z.boolean(),skills:z.array(z.object({id:uuid,name:z.string(),level:z.string().nullable()}))});
export const matrixRowSchema=candidateSchema.omit({matched_required:true,total_required:true,can_read_profile:true});

export function workforceRepository():WorkforceRepository{return {async execute(command,requestId){const client=await serverClient();const {data,error}=await client.rpc("workforce_profile_command",{p_action:command.action,p_payload:command.payload,p_request_id:requestId});if(error)throw databaseError(error);return data}}}
export async function skillCatalog(){const client=await serverClient();const {data,error}=await client.from("skills").select("*").eq("active",true).order("name").limit(500);if(error)throw databaseError(error);return skillSchema.array().parse(data)}

export async function workforceProfile(userId:string){
 const client=await serverClient();const results=await Promise.all([
  client.from("workforce_profiles").select("*").eq("user_id",userId).maybeSingle(),
  client.from("workforce_educations").select("*").eq("user_id",userId).eq("active",true).order("sort_order").limit(100),
  client.from("employee_skills").select("*").eq("user_id",userId).eq("active",true).limit(200),
  client.from("workforce_certifications").select("*").eq("user_id",userId).eq("active",true).limit(100),
  client.from("workforce_project_experiences").select("*").eq("user_id",userId).eq("active",true).limit(500),
  client.rpc("workforce_profile_projects",{p_user_id:userId}),
 ]);
 for(const result of results)if(result.error)throw databaseError(result.error);
 const profile=results[0].data?profileSchema.parse(results[0].data):null;
 const educations=educationSchema.array().parse(results[1].data),employeeSkills=employeeSkillSchema.array().parse(results[2].data);
 const certifications=certificationSchema.array().parse(results[3].data),experiences=experienceSchema.array().parse(results[4].data);
 const assignments=z.array(z.object({id:uuid,project_id:uuid,user_id:uuid,project_name:z.string(),customer_name:z.string(),project_role:z.string(),planned_start_date:z.string(),planned_end_date:z.string(),allocation_rate:z.number(),status:z.string()})).parse(results[5].data);
 const assignmentMap=new Map(assignments.map(a=>[a.id,a]));
 const history=experiences.map(x=>{const a=x.project_assignment_id?assignmentMap.get(x.project_assignment_id):null;return {...x,display_name:a?a.project_name:x.project_name??"",display_customer:a?a.customer_name:x.customer_name??"",display_start:a?a.planned_start_date:x.start_date,display_end:a?a.planned_end_date:x.end_date,display_role:a?a.project_role:x.role??""}}).sort((a,b)=>(b.display_start??"").localeCompare(a.display_start??"")||a.sort_order-b.sort_order);
 return {profile,educations,employeeSkills,certifications,experiences:history,assignments};
}

export async function staffingForProject(projectId:string){const client=await serverClient();const overview=await client.rpc("project_staffing_overview",{p_project_id:projectId});if(overview.error)throw databaseError(overview.error);const requirements=requirementSchema.array().parse(overview.data);const ids=requirements.map(r=>r.id);if(!ids.length)return {requirements,skills:[],fulfillments:[]};const [skills,fulfillments]=await Promise.all([client.from("project_staffing_requirement_skills").select("*").in("requirement_id",ids).eq("active",true).limit(500),client.from("project_staffing_fulfillments").select("*").in("requirement_id",ids).eq("active",true).limit(500)]);if(skills.error)throw databaseError(skills.error);if(fulfillments.error)throw databaseError(fulfillments.error);return {requirements,skills:requirementSkillSchema.array().parse(skills.data),fulfillments:fulfillmentSchema.array().parse(fulfillments.data)}}
export async function staffingCandidates(input:{requirementId:string;organizationId?:string;positionId?:string;skillId?:string;minCareerMonths?:number;minAvailability?:number}){const client=await serverClient();const {data,error}=await client.rpc("project_staffing_candidates",{p_requirement_id:input.requirementId,p_organization_id:input.organizationId,p_position_id:input.positionId,p_skill_id:input.skillId,p_min_career_months:input.minCareerMonths??0,p_min_availability:input.minAvailability??0});if(error)throw databaseError(error);return candidateSchema.array().parse(data)}
export async function skillMatrix(input:{start:string;end:string;organizationId?:string;positionId?:string;skillId?:string;minCareerMonths?:number;minAvailability?:number}){const client=await serverClient();const {data,error}=await client.rpc("workforce_skill_matrix",{p_start:input.start,p_end:input.end,p_organization_id:input.organizationId,p_position_id:input.positionId,p_skill_id:input.skillId,p_min_career_months:input.minCareerMonths??0,p_min_availability:input.minAvailability??0});if(error)throw databaseError(error);return matrixRowSchema.array().parse(data)}
export const portfolioRowSchema=z.object({project_id:uuid,required_headcount:z.number(),filled_count:z.number(),open_requirements:z.number(),open_issues:z.number()});
export async function projectPortfolioStaffing(){const client=await serverClient();const {data,error}=await client.rpc("project_portfolio_staffing");if(error)throw databaseError(error);return portfolioRowSchema.array().parse(data)}
