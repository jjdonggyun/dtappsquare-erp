import "server-only";
import { z } from "zod";
import { serverClient } from "@/shared/infrastructure/supabase/server";
import { databaseError } from "@/shared/domain/errors";

export const projectSchema=z.object({
  id:z.uuid(),project_code:z.string(),project_name:z.string(),customer_name:z.string(),description:z.string().nullable(),
  planned_start_date:z.string(),planned_end_date:z.string(),actual_start_date:z.string().nullable(),actual_end_date:z.string().nullable(),
  status:z.string(),project_manager_id:z.uuid(),version:z.number().int(),archived_at:z.string().nullable(),created_at:z.string(),updated_at:z.string(),
  actual_progress:z.number().nullable(),
});
export const projectAssignmentSchema=z.object({
  id:z.uuid(),project_id:z.uuid(),user_id:z.uuid(),project_role:z.string(),planned_start_date:z.string(),planned_end_date:z.string(),
  actual_start_date:z.string().nullable(),actual_end_date:z.string().nullable(),allocation_rate:z.number(),status:z.string(),memo:z.string().nullable(),
  assigned_by:z.uuid(),version:z.number().int(),created_at:z.string(),updated_at:z.string(),
});
export async function projectCatalog(){const client=await serverClient();
  const projects:z.infer<typeof projectSchema>[]=[];const assignments:z.infer<typeof projectAssignmentSchema>[]=[];
  for(let from=0;;from+=1000){const page=await client.from("projects").select("*").order("id").range(from,from+999);
    if(page.error)throw databaseError(page.error);projects.push(...projectSchema.array().parse(page.data));if((page.data?.length??0)<1000)break;}
  for(let from=0;;from+=1000){const page=await client.from("project_assignments").select("*").order("id").range(from,from+999);
    if(page.error)throw databaseError(page.error);assignments.push(...projectAssignmentSchema.array().parse(page.data));if((page.data?.length??0)<1000)break;}
  projects.sort((a,b)=>b.planned_start_date.localeCompare(a.planned_start_date));
  return {projects,assignments};
}
export async function projectDetail(id:string){const client=await serverClient();const [project,assignments]=await Promise.all([
  client.from("projects").select("*").eq("id",id).maybeSingle(),
  client.from("project_assignments").select("*").eq("project_id",id).order("planned_start_date").limit(1000),
]);if(project.error)throw databaseError(project.error);if(assignments.error)throw databaseError(assignments.error);
  return project.data?{project:projectSchema.parse(project.data),assignments:projectAssignmentSchema.array().parse(assignments.data)}:null;
}

export const taskSchema=z.object({id:z.uuid(),project_id:z.uuid(),parent_id:z.uuid().nullable(),title:z.string(),assignee_id:z.uuid().nullable(),status:z.string(),priority:z.string(),planned_start_date:z.string(),planned_end_date:z.string(),actual_start_date:z.string().nullable(),actual_end_date:z.string().nullable(),progress:z.number(),description:z.string().nullable(),version:z.number(),created_at:z.string(),updated_at:z.string()});
export async function projectTasksForProjects(ids:string[]){if(!ids.length)return [];const client=await serverClient();const {data,error}=await client.from("project_tasks").select("*").in("project_id",ids).order("title").limit(1000);if(error)throw databaseError(error);return taskSchema.array().parse(data)}
export const milestoneSchema=z.object({id:z.uuid(),project_id:z.uuid(),name:z.string(),planned_date:z.string(),completed_date:z.string().nullable(),status:z.string(),description:z.string().nullable(),version:z.number(),created_at:z.string(),updated_at:z.string()});
export const issueSchema=z.object({id:z.uuid(),project_id:z.uuid(),kind:z.string(),title:z.string(),description:z.string(),assignee_id:z.uuid().nullable(),priority:z.string(),status:z.string(),target_date:z.string().nullable(),resolved_date:z.string().nullable(),version:z.number(),created_at:z.string(),updated_at:z.string()});
export async function projectPlanning(id:string){
  const client=await serverClient();
  const [tasks,milestones,issues]=await Promise.all([
    client.from("project_tasks").select("*").eq("project_id",id).order("planned_start_date").limit(1000),
    client.from("project_milestones").select("*").eq("project_id",id).order("planned_date").limit(300),
    client.from("project_issues").select("*").eq("project_id",id).order("created_at",{ascending:false}).limit(1000),
  ]);
  for(const result of [tasks,milestones,issues]) if(result.error) throw databaseError(result.error);
  return {tasks:taskSchema.array().parse(tasks.data),milestones:milestoneSchema.array().parse(milestones.data),issues:issueSchema.array().parse(issues.data)};
}

export async function resourcePeriod(start:string,end:string,granularity:"week"|"month"="month"){
  const client=await serverClient();
  const [capacity,leave]=await Promise.all([
    client.rpc("resource_capacity",{p_start:start,p_end:end,p_granularity:granularity}),
    client.rpc("resource_leave_windows",{p_start:start,p_end:end}),
  ]);
  if(capacity.error)throw databaseError(capacity.error);
  if(leave.error)throw databaseError(leave.error);
  const allocations=[];let from=0;
  // PostgREST's default 1,000-row cap would silently omit large planning periods.
  for(;;){
    const page=await client.from("project_assignments").select("*")
      .lte("planned_start_date",end).gte("planned_end_date",start).order("id").range(from,from+999);
    if(page.error)throw databaseError(page.error);
    allocations.push(...projectAssignmentSchema.array().parse(page.data));
    if((page.data?.length??0)<1000)break;
    from+=1000;
  }
  return {capacity:capacity.data,leave:leave.data,allocations};
}
