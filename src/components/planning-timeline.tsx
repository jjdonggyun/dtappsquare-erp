"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
import {addDays,dateNumber} from "@/modules/project-resource/domain/metrics";
import type {projectAssignmentSchema} from "@/modules/project/infrastructure/repository";
import type {z} from "zod";
type Assignment=z.infer<typeof projectAssignmentSchema>;
type Leave={user_id:string;start_date:string;end_date:string;leave_type:string};
export function PlanningTimeline({start,end,assignments,people,projects,leave=[],editable=false}:{start:string;end:string;assignments:Assignment[];people:{id:string;name:string}[];projects:{id:string;project_name:string}[];leave?:Leave[];editable?:boolean}){
  const [zoom,setZoom]=useState<"day"|"week"|"month">("month"),[message,setMessage]=useState("");const router=useRouter();
  const count=dateNumber(end)-dateNumber(start)+1;const width=Math.max(900,count*(zoom==="day"?32:zoom==="week"?11:5));
  const projectNames=new Map(projects.map(row=>[row.id,row.project_name]));
  const ticks:{date:string;left:number}[]=[];for(let i=0;i<count;i++){
    const date=addDays(start,i),weekday=new Date(`${date}T00:00:00Z`).getUTCDay();
    if(zoom==="day"||zoom==="week"&&weekday===1||zoom==="month"&&date.endsWith("-01")||i===0)ticks.push({date,left:i/count*100});
  }
  const rows=people.filter(p=>assignments.some(a=>a.user_id===p.id)||leave.some(l=>l.user_id===p.id));
  async function update(row:Assignment,mode:"move"|"start"|"end",delta:number){
    const begin=addDays(row.planned_start_date,mode==="end"?0:delta),finish=addDays(row.planned_end_date,mode==="start"?0:delta);
    if(begin>finish)return;
    const response=await fetch("/api/project-resource",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"project_assignment.save",payload:{...row,planned_start_date:begin,planned_end_date:finish,actual_start_date:row.actual_start_date??"",actual_end_date:row.actual_end_date??"",memo:row.memo??""}})});
    const body=await response.json();setMessage(response.ok?(body.data?.message??"기간을 변경했습니다."):(body.error?.message??"변경하지 못했습니다."));if(response.ok)router.refresh();
  }
  return <div><div className="mb-3 flex items-center gap-2 text-xs"><span className="text-muted-foreground">보기</span>{(["day","week","month"] as const).map(value=><Button key={value} size="sm" variant={zoom===value?"default":"outline"} onClick={()=>setZoom(value)}>{value==="day"?"일":value==="week"?"주":"월"}</Button>)}<span className="ml-auto text-muted-foreground">{start} ~ {end}</span></div>
    {message&&<p role="status" className="mb-2 text-xs text-primary">{message}</p>}
    <div className="overflow-x-auto rounded-md border"><div style={{minWidth:width+160}}>
      <div className="flex border-b bg-muted text-[11px]"><div className="sticky left-0 z-10 w-40 shrink-0 border-r bg-muted px-3 py-3 font-semibold">직원</div><div className="relative h-10 flex-1" style={{width}}>{ticks.map(t=><span key={t.date} className="absolute top-0 h-full border-l px-1 pt-2 text-muted-foreground" style={{left:`${t.left}%`}}>{zoom==="month"?t.date.slice(0,7):t.date.slice(5)}</span>)}</div></div>
      {rows.map(person=>{const items=assignments.filter(a=>a.user_id===person.id&&a.planned_start_date<=end&&a.planned_end_date>=start);const days=leave.filter(l=>l.user_id===person.id);return <div key={person.id} className="flex border-b last:border-b-0"><div className="sticky left-0 z-10 w-40 shrink-0 border-r bg-card px-3 py-3 text-xs font-semibold">{person.name}</div><div className="relative min-h-9 flex-1 bg-card" data-track style={{width,height:Math.max(38,(items.length+days.length)*30+8)}}>
        {ticks.map(t=><i aria-hidden="true" key={t.date} className="pointer-events-none absolute inset-y-0 border-l border-border/60" style={{left:`${t.left}%`}}/>)}
        {items.map((row,index)=>{const left=Math.max(0,dateNumber(row.planned_start_date)-dateNumber(start))/count*100;const right=Math.min(count,dateNumber(row.planned_end_date)-dateNumber(start)+1)/count*100;return <div key={row.id} title={`${projectNames.get(row.project_id)??"프로젝트"} · ${row.project_role} · ${row.planned_start_date} ~ ${row.planned_end_date} · ${row.allocation_rate}%`} className={`absolute flex h-6 items-center overflow-hidden rounded bg-primary px-1 text-[10px] text-white ${editable?"cursor-grab touch-none":""}`} style={{left:`${left}%`,width:`${right-left}%`,top:5+index*30}} onPointerDown={editable?e=>{e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.dataset.origin=String(e.clientX);e.currentTarget.dataset.mode=(e.nativeEvent.offsetX<8?"start":e.nativeEvent.offsetX>e.currentTarget.clientWidth-8?"end":"move")}:undefined} onPointerUp={editable?e=>{const node=e.currentTarget;const moved=Math.round((e.clientX-Number(node.dataset.origin))/(node.parentElement?.clientWidth??width)*count);if(moved)void update(row,node.dataset.mode as "start"|"end"|"move",moved)}:undefined}><span className="truncate">{projectNames.get(row.project_id)} {row.allocation_rate}%</span></div>})}
        {days.map((row,index)=>{const left=Math.max(0,dateNumber(row.start_date)-dateNumber(start))/count*100;const right=Math.min(count,dateNumber(row.end_date)-dateNumber(start)+1)/count*100;return <div key={`${row.start_date}-${index}`} title={`휴가 · ${row.start_date} ~ ${row.end_date}`} className="absolute h-5 rounded bg-slate-200 px-1 text-[10px] text-slate-700" style={{left:`${left}%`,width:`${right-left}%`,top:5+(items.length+index)*30}}>휴가</div>})}
      </div></div>})}{!rows.length&&<p className="py-8 text-center text-xs text-muted-foreground">기간 내 투입 이력이 없습니다.</p>}
    </div></div>
    {editable&&<p className="mt-2 text-[11px] text-muted-foreground">바를 끌어 기간을 이동하고 양쪽 끝을 끌어 시작일·종료일을 조정할 수 있습니다. 정확한 날짜는 투입 인력 수정에서 입력하세요.</p>}
  </div>;
}
