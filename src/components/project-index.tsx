"use client";
import {useState} from "react";
import Link from "next/link";
import {CommandForm} from "@/components/command-form";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "@/components/ui/table";
import {projectStatuses,projectStatusLabels} from "@/modules/project/domain/contracts";
import {plannedProgress} from "@/modules/project-resource/domain/metrics";
import type {projectSchema,projectAssignmentSchema} from "@/modules/project/infrastructure/repository";
import type {projectPortfolioStaffing} from "@/modules/workforce-profile/infrastructure/repository";
import type {z} from "zod";
type Project=z.infer<typeof projectSchema>;type Assignment=z.infer<typeof projectAssignmentSchema>;
type Person={id:string;name:string;organization_id:string|null};
export function ProjectIndex({projects,assignments,portfolio,people,organizations,canWrite,canReadAll,today,accountId}:{projects:Project[];assignments:Assignment[];portfolio:Awaited<ReturnType<typeof projectPortfolioStaffing>>;people:Person[];organizations:{id:string;name:string}[];canWrite:boolean;canReadAll:boolean;today:string;accountId:string}){
  const [creating,setCreating]=useState(false),[query,setQuery]=useState(""),[customer,setCustomer]=useState(""),[manager,setManager]=useState(""),[status,setStatus]=useState(""),[organization,setOrganization]=useState(""),[start,setStart]=useState(""),[end,setEnd]=useState(""),[ongoing,setOngoing]=useState(false);
  const names=new Map(people.map(row=>[row.id,row.name]));const members=new Map<string,Assignment[]>();
  const staffingByProject=new Map(portfolio.map(row=>[row.project_id,row]));
  for(const row of assignments){const list=members.get(row.project_id)??[];list.push(row);members.set(row.project_id,list)}
  const filtered=projects.filter(row=>{
    const staff=members.get(row.id)??[];
    return (!query||`${row.project_code} ${row.project_name}`.toLowerCase().includes(query.toLowerCase()))&&
      (!customer||row.customer_name.toLowerCase().includes(customer.toLowerCase()))&&(!manager||row.project_manager_id===manager)&&
      (!status||row.status===status)&&(!organization||people.some(person=>person.organization_id===organization&&staff.some(item=>item.user_id===person.id)))&&
      (!start||row.planned_end_date>=start)&&(!end||row.planned_start_date<=end)&&(!ongoing||row.status==="IN_PROGRESS");
  });
  const stats=[
    ["전체 프로젝트",projects.length],["진행 중",projects.filter(p=>p.status==="IN_PROGRESS").length],
    ["예정",projects.filter(p=>["PLANNING","SCHEDULED"].includes(p.status)).length],
    ["완료",projects.filter(p=>p.status==="COMPLETED").length],
    ["지연 프로젝트",projects.filter(p=>p.planned_end_date<today&&!["COMPLETED","CANCELED"].includes(p.status)).length],
    ["전체 투입 인원",new Set(assignments.filter(a=>["PLANNED","CONFIRMED","IN_PROGRESS"].includes(a.status)).map(a=>a.user_id)).size],
    ["투입 가능 인원",people.filter(person=>assignments.filter(a=>a.user_id===person.id&&["PLANNED","CONFIRMED","IN_PROGRESS"].includes(a.status)&&a.planned_start_date<=today&&a.planned_end_date>=today).reduce((sum,a)=>sum+a.allocation_rate,0)<100).length],
    ["과투입 인원",people.filter(person=>assignments.filter(a=>a.user_id===person.id&&["PLANNED","CONFIRMED","IN_PROGRESS"].includes(a.status)&&a.planned_start_date<=today&&a.planned_end_date>=today).reduce((sum,a)=>sum+a.allocation_rate,0)>100).length],
  ] as const;
  return <>
    <div className="mb-5 grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">{stats.map(([label,value])=><Card key={label} className="gap-0 py-4"><CardContent className="px-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></CardContent></Card>)}</div>
    <Card className="mb-5"><CardHeader className="flex flex-row items-center justify-between"><CardTitle>프로젝트 검색</CardTitle>{canWrite&&<Button onClick={()=>setCreating(!creating)}>{creating?"닫기":"새 프로젝트"}</Button>}</CardHeader><CardContent>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input aria-label="프로젝트명 또는 코드" placeholder="프로젝트명 / 코드" value={query} onChange={e=>setQuery(e.target.value)}/>
        <Input aria-label="고객사" placeholder="고객사" value={customer} onChange={e=>setCustomer(e.target.value)}/>
        <select aria-label="PM" value={manager} onChange={e=>setManager(e.target.value)}><option value="">전체 PM</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select aria-label="상태" value={status} onChange={e=>setStatus(e.target.value)}><option value="">전체 상태</option>{projectStatuses.map(v=><option key={v} value={v}>{projectStatusLabels[v]}</option>)}</select>
        <Input aria-label="기간 시작" type="date" value={start} onChange={e=>setStart(e.target.value)}/><Input aria-label="기간 종료" type="date" value={end} onChange={e=>setEnd(e.target.value)}/>
        <select aria-label="조직" value={organization} onChange={e=>setOrganization(e.target.value)}><option value="">전체 조직</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={ongoing} onChange={e=>setOngoing(e.target.checked)}/> 진행 중 프로젝트만 보기</label>
      </div>
      {creating&&<div className="mt-5 border-t pt-5"><CommandForm endpoint="/api/project-resource" action="project.save" fields={[
        {name:"project_code",label:"프로젝트 코드",required:true},{name:"project_name",label:"프로젝트명",required:true},{name:"customer_name",label:"고객사",required:true},{name:"description",label:"설명"},
        {name:"planned_start_date",label:"계획 시작일",type:"date",required:true},{name:"planned_end_date",label:"계획 종료일",type:"date",required:true},{name:"actual_start_date",label:"실제 시작일",type:"date"},{name:"actual_end_date",label:"실제 종료일",type:"date"},
        {name:"status",label:"상태",type:"select",value:"PLANNING",required:true,options:projectStatuses.map(value=>({value,label:projectStatusLabels[value]}))},
        {name:"project_manager_id",label:"PM",type:"select",required:true,options:people.filter(p=>canReadAll||p.id===accountId).map(p=>({value:p.id,label:p.name}))},
      ]} submit="프로젝트 생성"/></div>}
    </CardContent></Card>
    <Card className="gap-0 py-0"><CardHeader className="border-b px-5 py-4"><CardTitle>프로젝트 목록 <span className="text-xs font-normal text-muted-foreground">{filtered.length}건</span></CardTitle></CardHeader><CardContent className="overflow-x-auto px-0"><Table><TableHeader><TableRow><TableHead className="pl-5">코드 / 프로젝트</TableHead><TableHead>고객사</TableHead><TableHead>PM</TableHead><TableHead>계획 기간</TableHead><TableHead>실제 기간</TableHead><TableHead>인원 / 평균</TableHead><TableHead>필요 / 충원</TableHead><TableHead>Open Issue</TableHead><TableHead>일정 진행률</TableHead><TableHead>상태</TableHead></TableRow></TableHeader><TableBody>{filtered.map(p=>{const active=(members.get(p.id)??[]).filter(a=>["PLANNED","CONFIRMED","IN_PROGRESS"].includes(a.status));const delayed=p.planned_end_date<today&&!["COMPLETED","CANCELED"].includes(p.status);const staffing=staffingByProject.get(p.id);return <TableRow key={p.id}><TableCell className="pl-5"><span className="text-[10px] text-muted-foreground">{p.project_code}</span><p><Link href={`/admin/projects/${p.id}`} className="font-semibold hover:text-primary">{p.project_name}</Link></p></TableCell><TableCell>{p.customer_name}</TableCell><TableCell>{names.get(p.project_manager_id)??"—"}</TableCell><TableCell className="whitespace-nowrap">{p.planned_start_date} ~ {p.planned_end_date}</TableCell><TableCell className="whitespace-nowrap">{p.actual_start_date??"—"} ~ {p.actual_end_date??"—"}</TableCell><TableCell>{new Set(active.map(a=>a.user_id)).size}명 / {active.length?Math.round(active.reduce((sum,a)=>sum+a.allocation_rate,0)/active.length):0}%</TableCell><TableCell>{staffing?<Badge variant="outline" className={staffing.filled_count<staffing.required_headcount?"border-amber-300 text-amber-900":""}>{staffing.filled_count} / {staffing.required_headcount}</Badge>:"—"}</TableCell><TableCell>{staffing?.open_issues??"—"}</TableCell><TableCell>{plannedProgress(p.planned_start_date,p.planned_end_date,today)}%</TableCell><TableCell><Badge variant="outline" className={delayed?"border-destructive text-destructive":""}>{delayed?"일정 지연":projectStatusLabels[p.status as keyof typeof projectStatusLabels]}</Badge></TableCell></TableRow>})}</TableBody></Table>{!filtered.length&&<p className="py-10 text-center text-xs text-muted-foreground">검색 결과가 없습니다.</p>}</CardContent></Card>
  </>;
}
