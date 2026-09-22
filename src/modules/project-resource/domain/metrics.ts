import type { ResourceAssignment } from "./planning";

const DAY=86400000;
export function dateNumber(value:string){return Date.parse(`${value}T00:00:00Z`)/DAY}
export function dateString(day:number){return new Date(day*DAY).toISOString().slice(0,10)}
export function addDays(date:string,days:number){return dateString(dateNumber(date)+days)}
export function activeAssignment(row:ResourceAssignment){return ["PLANNED","CONFIRMED","IN_PROGRESS"].includes(row.status)}
export function allocationAt(rows:ResourceAssignment[],day:string){return rows.filter(row=>activeAssignment(row)&&row.planned_start_date<=day&&row.planned_end_date>=day).reduce((sum,row)=>sum+row.allocation_rate,0)}
export function capacityDuring(rows:ResourceAssignment[],start:string,end:string){
  const first=dateNumber(start),last=dateNumber(end);
  if(!Number.isFinite(first)||!Number.isFinite(last)||last<first)return {average:0,peak:0,minimumAvailability:100,overStart:"",overEnd:""};
  const events=new Map<number,number>();
  for(const row of rows){
    if(!activeAssignment(row))continue;
    const left=Math.max(first,dateNumber(row.planned_start_date)),right=Math.min(last,dateNumber(row.planned_end_date));
    if(left>right)continue;
    events.set(left,(events.get(left)??0)+row.allocation_rate);
    events.set(right+1,(events.get(right+1)??0)-row.allocation_rate);
  }
  const points=[first,...events.keys(),last+1].sort((a,b)=>a-b).filter((n,i,a)=>i===0||n!==a[i-1]);
  let rate=0,weighted=0,peak=0,overStart="",overEnd="";
  for(let i=0;i<points.length-1;i++){
    const point=points[i];rate+=events.get(point)??0;
    const length=points[i+1]-point;weighted+=rate*length;peak=Math.max(peak,rate);
    if(rate>100){if(!overStart)overStart=dateString(point);overEnd=dateString(points[i+1]-1)}
  }
  return {average:Math.round(weighted/(last-first+1)*10)/10,peak,minimumAvailability:Math.max(0,100-peak),overStart,overEnd};
}
export function plannedProgress(start:string,end:string,today:string){
  return Math.max(0,Math.min(100,Math.round((dateNumber(today)-dateNumber(start)+1)/(dateNumber(end)-dateNumber(start)+1)*100)));
}
export function actualProgress(override:number|null,tasks:{id:string;parent_id:string|null;progress:number}[]){
  if(override!==null)return override;
  const parents=new Set(tasks.map(task=>task.parent_id).filter(Boolean));
  const leaves=tasks.filter(task=>!parents.has(task.id));
  return leaves.length?Math.round(leaves.reduce((sum,task)=>sum+task.progress,0)/leaves.length):0;
}
export function allocationLabel(rate:number){return rate>100?"과투입":rate>=80?"높은 투입":rate>=50?"적정":rate>0?"여유":"미투입"}
