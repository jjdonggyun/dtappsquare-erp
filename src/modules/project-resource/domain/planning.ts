export type ResourcePerson = { id:string; name:string; organization_id:string|null; position_id:string|null };
export type ResourceProject = { id:string; project_name:string; planned_end_date:string; status:string };
export type ResourceAssignment = {
  id:string; project_id:string; user_id:string; planned_start_date:string; planned_end_date:string;
  allocation_rate:number; status:string;
};

export type ResourceState = "WAITING"|"SCHEDULED"|"IN_PROGRESS"|"ENDING_SOON"|"OVER_ALLOCATED";

export function buildResourcePlan(
  people:ResourcePerson[],projects:ResourceProject[],assignments:ResourceAssignment[],asOf:string,
) {
  const projectById=new Map(projects.map(project=>[project.id,project]));
  const endingBoundary=new Date(`${asOf}T00:00:00Z`);
  endingBoundary.setUTCDate(endingBoundary.getUTCDate()+30);
  const endingDate=endingBoundary.toISOString().slice(0,10);
  return people.map(person=>{
    const userAssignments=assignments.filter(row=>row.user_id===person.id&&!(["ENDED","CANCELED","ON_HOLD"].includes(row.status)));
    const current=userAssignments.filter(row=>row.status==="IN_PROGRESS"&&row.planned_start_date<=asOf&&row.planned_end_date>=asOf);
    const upcoming=userAssignments.filter(row=>["PLANNED","CONFIRMED"].includes(row.status)&&row.planned_start_date>asOf).sort((a,b)=>a.planned_start_date.localeCompare(b.planned_start_date));
    const currentAllocation=current.reduce((sum,row)=>sum+row.allocation_rate,0);
    const next=upcoming[0];
    const plannedAllocation=next?userAssignments.filter(row=>row.planned_start_date<=next.planned_start_date&&row.planned_end_date>=next.planned_start_date).reduce((sum,row)=>sum+row.allocation_rate,0):0;
    const endingSoon=current.some(row=>row.planned_end_date<=endingDate||((projectById.get(row.project_id)?.planned_end_date??"9999-12-31")<=endingDate));
    const state:ResourceState=currentAllocation>100?"OVER_ALLOCATED":current.length?(endingSoon?"ENDING_SOON":"IN_PROGRESS"):next?"SCHEDULED":"WAITING";
    return {person,current,currentProjects:current.map(row=>projectById.get(row.project_id)).filter(Boolean),next,nextProject:next?projectById.get(next.project_id):undefined,currentAllocation,plannedAllocation,state};
  });
}

export const resourceStateLabels:Record<ResourceState,string>={
  WAITING:"대기인력",SCHEDULED:"투입예정",IN_PROGRESS:"투입중",ENDING_SOON:"철수예정",OVER_ALLOCATED:"투입률 초과",
};
