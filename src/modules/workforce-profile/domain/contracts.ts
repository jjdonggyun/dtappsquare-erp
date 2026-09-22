import {z} from "zod";

const id=z.uuid();
const optionalId=z.union([z.literal(""),id]).optional();
const optionalDate=z.union([z.literal(""),z.iso.date()]).default("");
const version=z.number().int().positive().optional();
const active=z.boolean().default(true);
const level=z.enum(["BASIC","INTERMEDIATE","ADVANCED","EXPERT"]);
const optionalLevel=z.union([z.literal(""),level]).default("");
export const skillLevels=["BASIC","INTERMEDIATE","ADVANCED","EXPERT"] as const;
export const skillLevelLabels={BASIC:"기초",INTERMEDIATE:"중급",ADVANCED:"고급",EXPERT:"전문가"};

export const workforceCommands=z.discriminatedUnion("action",[
 z.object({action:z.literal("profile.save"),payload:z.object({
  user_id:id,version,birth_date:optionalDate,career_start_date:optionalDate,
  summary:z.string().trim().max(4000).default(""),profile_status:z.enum(["DRAFT","READY"]).default("DRAFT"),
  career_months_override:z.union([z.literal(""),z.coerce.number().int().min(0).max(720)]).optional(),
  career_override_reason:z.string().trim().max(500).optional(),
 })}),
 z.object({action:z.literal("education.save"),payload:z.object({
  id:optionalId,version,user_id:id,school_name:z.string().trim().min(1).max(200),degree:z.string().trim().max(100).default(""),
  major:z.string().trim().max(150).default(""),start_date:optionalDate,end_date:optionalDate,
  graduation_status:z.enum(["ENROLLED","GRADUATED","COMPLETED","WITHDRAWN"]).default("GRADUATED"),
  highest_education:z.boolean().default(false),sort_order:z.number().int().min(0).default(0),active,
 })}),
 z.object({action:z.literal("skill_catalog.save"),payload:z.object({
  id:optionalId,version,code:z.string().trim().min(2).max(61).regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  name:z.string().trim().min(1).max(120),category:z.string().trim().min(1).max(80),active,
 })}),
 z.object({action:z.literal("employee_skill.save"),payload:z.object({
  id:optionalId,version,user_id:id,skill_id:id,level:optionalLevel,
  years_experience:z.union([z.literal(""),z.coerce.number().min(0).max(60)]).default(""),
  last_used_date:optionalDate,memo:z.string().trim().max(1000).default(""),active,
 })}),
 z.object({action:z.literal("certification.save"),payload:z.object({
  id:optionalId,version,user_id:id,certification_name:z.string().trim().min(1).max(180),
  issuer:z.string().trim().max(150).default(""),obtained_date:optionalDate,expiry_date:optionalDate,
  credential_id:z.string().trim().max(150).default(""),active,
 })}),
 z.object({action:z.literal("experience.save"),payload:z.object({
  id:optionalId,version,user_id:id,source_type:z.enum(["INTERNAL_PROJECT","MANUAL_HISTORY"]),
  project_assignment_id:optionalId,project_name:z.string().trim().max(200).default(""),
  customer_name:z.string().trim().max(200).default(""),category:z.string().trim().max(100).default(""),
  start_date:optionalDate,end_date:optionalDate,role:z.string().trim().max(120).default(""),
  responsibilities:z.string().trim().min(2).max(6000),technologies:z.string().trim().max(2000).default(""),
  sort_order:z.number().int().min(0).default(0),active,
 })}),
 z.object({action:z.literal("requirement.save"),payload:z.object({
  id:optionalId,version,project_id:id,role_name:z.string().trim().min(2).max(120),
  required_headcount:z.number().int().min(1).max(100),planned_start_date:z.iso.date(),planned_end_date:z.iso.date(),
  allocation_rate:z.number().min(0).max(100),description:z.string().trim().max(4000).default(""),
  lifecycle_status:z.enum(["OPEN","CLOSED"]).default("OPEN"),
 })}),
 z.object({action:z.literal("requirement_skill.save"),payload:z.object({
  id:optionalId,version,requirement_id:id,skill_id:id,preference:z.enum(["REQUIRED","PREFERRED"]),
  target_level:optionalLevel,active,
 })}),
 z.object({action:z.literal("fulfillment.save"),payload:z.object({
  id:optionalId,version,requirement_id:id,project_assignment_id:id,active,
 })}),
]);
export type WorkforceCommand=z.infer<typeof workforceCommands>;

/** Display only. The source of truth is a date or a documented legacy override. */
export function careerMonths(startDate:string|null,override:number|null,today:string){
 if(override!==null)return override;
 if(!startDate||startDate>today)return null;
 const [sy,sm,sd]=startDate.split("-").map(Number),[ty,tm,td]=today.split("-").map(Number);
 return Math.max(0,(ty-sy)*12+tm-sm-(td<sd?1:0));
}
export function careerLabel(months:number|null){return months===null?"미등록":`${Math.floor(months/12)}년${months%12?` ${months%12}개월`:""}`}
